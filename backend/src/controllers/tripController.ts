import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { geocodeAddress, getCarEta, getTransitEta } from '../services/hereApiService';

const prisma = new PrismaClient();

const createTripSchema = z.object({
    startAddress: z.string().min(1, 'Start address is required'),
    startLat: z.number().optional(),
    startLng: z.number().optional(),
    destAddress: z.string().min(1, 'Destination address is required'),
    destLat: z.number().optional(),
    destLng: z.number().optional(),
    arrivalTime: z.string().datetime(),
    reminderLeadMinutes: z.number().int().min(5).max(120).default(60),
});

const mapTripToDto = (trip: any) => ({
    id: trip.id,
    userId: trip.user_id,
    startAddress: trip.start_address,
    startLat: trip.start_lat,
    startLng: trip.start_lng,
    destAddress: trip.dest_address,
    destLat: trip.dest_lat,
    destLng: trip.dest_lng,
    requiredArrivalTime: trip.required_arrival_time,
    reminderLeadMinutes: trip.reminder_lead_minutes,
    status: trip.status,
    recommendedTransit: trip.recommended_transit === 'uber' ? 'car' : trip.recommended_transit,
    selectedTransit: trip.selected_transit === 'uber' ? 'car' : trip.selected_transit,
    busEtaMinutes: trip.bus_eta_minutes,
    carEtaMinutes: trip.uber_eta_minutes,
    bufferMinutes: 5,
    busLeaveBy: trip.bus_leave_by,
    carLeaveBy: trip.car_leave_by,
    departureTime: trip.departure_time,
    createdAt: trip.created_at,
    busAvailable: trip.bus_leave_by ? new Date(trip.bus_leave_by) > new Date() : false,
    carAvailable: trip.car_leave_by ? new Date(trip.car_leave_by) > new Date() : false,
    etaUpdatedAt: trip.eta_updated_at,
});

// ---------------------------------------------------------------------------
// Shared ETA calculation helper (no DB writes)
// ---------------------------------------------------------------------------
interface TripCalcInput {
    startAddress: string;
    startLat?: number;
    startLng?: number;
    destAddress: string;
    destLat?: number;
    destLng?: number;
    arrivalTime: string;
    reminderLeadMinutes: number;
}

interface TripCalcResult {
    startAddress: string;
    startLat: number;
    startLng: number;
    destAddress: string;
    destLat: number;
    destLng: number;
    arrivalDate: Date;
    reminderLeadMinutes: number;
    busEtaMinutes: number;
    carEtaMinutes: number;
    busLeaveByDate: Date | null;
    carLeaveByDate: Date | null;
    busAvailable: boolean;
    carAvailable: boolean;
    recommendedTransit: string;
    departureDate: Date;
}

async function calculateTripEta(data: TripCalcInput, res: Response): Promise<TripCalcResult | null> {
    let startLat = data.startLat;
    let startLng = data.startLng;
    if (startLat === undefined || startLng === undefined) {
        try {
            const startCoords = await geocodeAddress(data.startAddress);
            startLat = startCoords.lat;
            startLng = startCoords.lng;
        } catch (err: any) {
            if (err.message?.includes('Address not found')) {
                res.status(400).json({ success: false, error: 'Could not find the start address. Please enter a valid address.', field: 'startAddress' });
                return null;
            }
            throw err;
        }
    }

    let destLat = data.destLat;
    let destLng = data.destLng;
    if (destLat === undefined || destLng === undefined) {
        try {
            const destCoords = await geocodeAddress(data.destAddress);
            destLat = destCoords.lat;
            destLng = destCoords.lng;
        } catch (err: any) {
            if (err.message?.includes('Address not found')) {
                res.status(400).json({ success: false, error: 'Could not find the destination address. Please enter a valid address.', field: 'destAddress' });
                return null;
            }
            throw err;
        }
    }

    const origin = { lat: startLat!, lng: startLng! };
    const dest = { lat: destLat!, lng: destLng! };
    const arrivalDate = new Date(data.arrivalTime);

    let carEtaMinutes = 0;
    let busEtaMinutes = 0;
    try {
        [carEtaMinutes, busEtaMinutes] = await Promise.all([
            getCarEta(origin, dest, arrivalDate).catch((e: any) => { console.error('Car ETA error:', e.message); return 0; }),
            getTransitEta(origin, dest, arrivalDate).catch((e: any) => { console.error('Transit ETA error:', e.message); return 0; }),
        ]);

        if (carEtaMinutes === 0 && busEtaMinutes === 0) {
            res.status(400).json({ success: false, error: 'No route found between the two addresses. Please check your addresses and try again.' });
            return null;
        }
    } catch (error) {
        console.error('Error fetching ETAs concurrently:', error);
        res.status(500).json({ success: false, error: 'Failed to find routes' });
        return null;
    }

    const busLeaveByDate = busEtaMinutes > 0 ? new Date(arrivalDate.getTime() - busEtaMinutes * 60000 - 5 * 60000) : null;
    const carLeaveByDate = carEtaMinutes > 0 ? new Date(arrivalDate.getTime() - carEtaMinutes * 60000 - 5 * 60000) : null;

    const now = new Date();
    const busAvailable = busLeaveByDate ? busLeaveByDate > now : false;
    const carAvailable = carLeaveByDate ? carLeaveByDate > now : false;

    if (!busAvailable && !carAvailable) {
        res.status(400).json({ success: false, error: 'The arrival time is too soon. Neither transit option can get you there on time. Please choose a later arrival time.' });
        return null;
    }

    let recommendedTransit = 'car';
    if (busAvailable && carAvailable) {
        recommendedTransit = busEtaMinutes <= carEtaMinutes * 1.5 ? 'bus' : 'car';
    } else if (busAvailable) {
        recommendedTransit = 'bus';
    }

    const selectedEtaMinutes = recommendedTransit === 'bus' ? busEtaMinutes : carEtaMinutes;
    const departureDate = new Date(arrivalDate.getTime() - selectedEtaMinutes * 60000 - 5 * 60000);

    return {
        startAddress: data.startAddress,
        startLat: startLat!,
        startLng: startLng!,
        destAddress: data.destAddress,
        destLat: destLat!,
        destLng: destLng!,
        arrivalDate,
        reminderLeadMinutes: data.reminderLeadMinutes,
        busEtaMinutes,
        carEtaMinutes,
        busLeaveByDate,
        carLeaveByDate,
        busAvailable,
        carAvailable,
        recommendedTransit,
        departureDate,
    };
}

// ---------------------------------------------------------------------------
// Preview — calculates ETAs without saving to DB
// ---------------------------------------------------------------------------
export const previewTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const validatedData = createTripSchema.parse(req.body);
        const calc = await calculateTripEta(validatedData, res);
        if (!calc) return; // response already sent inside helper

        const preview = {
            id: 'preview',
            userId,
            startAddress: calc.startAddress,
            startLat: calc.startLat,
            startLng: calc.startLng,
            destAddress: calc.destAddress,
            destLat: calc.destLat,
            destLng: calc.destLng,
            requiredArrivalTime: calc.arrivalDate.toISOString(),
            reminderLeadMinutes: calc.reminderLeadMinutes,
            status: 'pending',
            recommendedTransit: calc.recommendedTransit,
            selectedTransit: null,
            busEtaMinutes: calc.busEtaMinutes,
            carEtaMinutes: calc.carEtaMinutes,
            bufferMinutes: 5,
            busLeaveBy: calc.busLeaveByDate?.toISOString() ?? null,
            carLeaveBy: calc.carLeaveByDate?.toISOString() ?? null,
            departureTime: calc.departureDate.toISOString(),
            createdAt: new Date().toISOString(),
            busAvailable: calc.busAvailable,
            carAvailable: calc.carAvailable,
            etaUpdatedAt: null,
        };

        res.status(200).json({ success: true, data: preview });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        } else {
            console.error('Preview trip error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
};

// ---------------------------------------------------------------------------
// Create — saves trip to DB after user confirms Save
// ---------------------------------------------------------------------------
export const createTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const validatedData = createTripSchema.parse(req.body);
        const calc = await calculateTripEta(validatedData, res);
        if (!calc) return;

        const newTrip = await prisma.trip.create({
            data: {
                user_id: userId,
                start_address: calc.startAddress,
                start_lat: calc.startLat,
                start_lng: calc.startLng,
                dest_address: calc.destAddress,
                dest_lat: calc.destLat,
                dest_lng: calc.destLng,
                required_arrival_time: calc.arrivalDate,
                reminder_lead_minutes: calc.reminderLeadMinutes,
                status: 'pending',
                recommended_transit: calc.recommendedTransit,
                bus_eta_minutes: calc.busEtaMinutes,
                uber_eta_minutes: calc.carEtaMinutes,
                bus_leave_by: calc.busLeaveByDate,
                car_leave_by: calc.carLeaveByDate,
                departure_time: calc.departureDate,
            },
        });

        res.status(201).json({ success: true, data: mapTripToDto(newTrip) });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        } else {
            console.error('Create trip error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
};

export const getTrips = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const trips = await prisma.trip.findMany({
            where: { user_id: userId },
            orderBy: { required_arrival_time: 'asc' }, // Soonest first
        });

        const now = new Date();
        const cutoff = new Date(now.getTime() - 10 * 60 * 1000); // 10-minute grace period
        const upcoming: any[] = [];
        const history: any[] = [];

        trips.forEach((trip) => {
            // A manually completed trip always goes to history, regardless of arrival time
            if (trip.status === 'completed' || trip.status === 'cancelled') {
                history.push(mapTripToDto(trip));
            } else if (trip.required_arrival_time > cutoff) {
                upcoming.push(mapTripToDto(trip));
            } else {
                // Arrival time has passed — auto-mark as completed
                trip.status = 'completed';
                prisma.trip.update({ where: { id: trip.id }, data: { status: 'completed' } }).catch(console.error);
                history.push(mapTripToDto(trip));
            }
        });

        res.status(200).json({
            success: true,
            data: {
                upcoming,
                history,
            },
        });
    } catch (error) {
        console.error('Get trips error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const getTripById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const tripId = req.params.id;

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
        });

        if (!trip) {
            res.status(404).json({ success: false, error: 'Trip not found' });
            return;
        }

        if (trip.user_id !== userId) {
            res.status(403).json({ success: false, error: 'Forbidden' });
            return;
        }

        res.status(200).json({ success: true, data: mapTripToDto(trip) });
    } catch (error) {
        console.error('Get trip by ID error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const deleteTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const tripId = req.params.id;

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
        });

        if (!trip) {
            res.status(404).json({ success: false, error: 'Trip not found' });
            return;
        }

        if (trip.user_id !== userId) {
            res.status(403).json({ success: false, error: 'Forbidden' });
            return;
        }

        await prisma.trip.delete({
            where: { id: tripId },
        });

        res.status(200).json({ success: true, data: { id: tripId } });
    } catch (error) {
        console.error('Delete trip error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const completeTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const tripId = req.params.id;

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
        });

        if (!trip) {
            res.status(404).json({ success: false, error: 'Trip not found' });
            return;
        }

        if (trip.user_id !== userId) {
            res.status(403).json({ success: false, error: 'Forbidden' });
            return;
        }

        const updatedTrip = await prisma.trip.update({
            where: { id: tripId },
            data: { status: 'completed' },
        });

        res.status(200).json({ success: true, data: mapTripToDto(updatedTrip) });
    } catch (error) {
        console.error('Complete trip error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const recalculateTripEta = async (tripId: string) => {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new Error('Trip not found');

    if (!trip.start_lat || !trip.start_lng || !trip.dest_lat || !trip.dest_lng) {
        throw new Error('Coordinates missing for trip');
    }

    const origin = { lat: trip.start_lat, lng: trip.start_lng };
    const dest = { lat: trip.dest_lat, lng: trip.dest_lng };
    const arrivalDate = trip.required_arrival_time;

    let carEtaMinutes = 0;
    let busEtaMinutes = 0;
    
    try {
        [carEtaMinutes, busEtaMinutes] = await Promise.all([
            getCarEta(origin, dest, arrivalDate).catch((e: any) => 0),
            getTransitEta(origin, dest, arrivalDate).catch((e: any) => 0)
        ]);
    } catch (err: any) {
        console.error('Error in underlying ETA refresh execution:', err);
    }

    const busLeaveByDate = busEtaMinutes > 0 ? new Date(arrivalDate.getTime() - busEtaMinutes * 60000 - 5 * 60000) : null;
    const carLeaveByDate = carEtaMinutes > 0 ? new Date(arrivalDate.getTime() - carEtaMinutes * 60000 - 5 * 60000) : null;

    const now = new Date();
    const busAvailable = busLeaveByDate ? busLeaveByDate > now : false;
    const carAvailable = carLeaveByDate ? carLeaveByDate > now : false;

    let recommendedTransit = 'car';
    if (busAvailable && carAvailable) {
        recommendedTransit = busEtaMinutes <= carEtaMinutes * 1.5 ? 'bus' : 'car';
    } else if (busAvailable) {
        recommendedTransit = 'bus';
    } else {
        recommendedTransit = 'car';
    }

    if (trip.recommended_transit && trip.recommended_transit !== recommendedTransit) {
        console.log(`Recommendation changed for trip ${tripId}: ${trip.recommended_transit} -> ${recommendedTransit}`);
    }

    const selectedTransit = trip.selected_transit || recommendedTransit;
    const selectedEtaMinutes = selectedTransit === 'bus' ? busEtaMinutes : carEtaMinutes;
    const departureDate = new Date(arrivalDate.getTime() - selectedEtaMinutes * 60000 - 5 * 60000);

    const updatedTrip = await prisma.trip.update({
        where: { id: tripId },
        data: {
            recommended_transit: recommendedTransit,
            bus_eta_minutes: busEtaMinutes,
            uber_eta_minutes: carEtaMinutes,
            bus_leave_by: busLeaveByDate,
            car_leave_by: carLeaveByDate,
            departure_time: departureDate,
            eta_updated_at: new Date()
        }
    });

    return updatedTrip;
};

export const refreshEta = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const tripId = req.params.id;

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const tripCheck = await prisma.trip.findUnique({ where: { id: tripId } });
        if (!tripCheck || tripCheck.user_id !== userId) {
            res.status(404).json({ success: false, error: 'Trip not found' });
            return;
        }

        const updatedTrip = await recalculateTripEta(tripId);
        res.status(200).json({ success: true, data: mapTripToDto(updatedTrip) });
    } catch (error: any) {
        console.error('Refresh ETA error:', error);
        res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
    }
};
