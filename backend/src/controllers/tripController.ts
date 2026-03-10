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
    recommendedTransit: trip.recommended_transit,
    busEtaMinutes: trip.bus_eta_minutes,
    uberEtaMinutes: trip.uber_eta_minutes,
    departureTime: trip.departure_time,
    createdAt: trip.created_at,
});

export const createTrip = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const validatedData = createTripSchema.parse(req.body);

        // Map and lookup coordinates using HERE API if missing
        let startLat = validatedData.startLat;
        let startLng = validatedData.startLng;
        if (startLat === undefined || startLng === undefined) {
            try {
                const startCoords = await geocodeAddress(validatedData.startAddress);
                startLat = startCoords.lat;
                startLng = startCoords.lng;
            } catch (err: any) {
                if (err.message && err.message.includes('Address not found')) {
                    res.status(400).json({ success: false, error: 'Could not find the start address. Please enter a valid address.', field: 'startAddress' });
                    return;
                }
                throw err;
            }
        }

        let destLat = validatedData.destLat;
        let destLng = validatedData.destLng;
        if (destLat === undefined || destLng === undefined) {
            try {
                const destCoords = await geocodeAddress(validatedData.destAddress);
                destLat = destCoords.lat;
                destLng = destCoords.lng;
            } catch (err: any) {
                if (err.message && err.message.includes('Address not found')) {
                    res.status(400).json({ success: false, error: 'Could not find the destination address. Please enter a valid address.', field: 'destAddress' });
                    return;
                }
                throw err;
            }
        }

        const origin = { lat: startLat, lng: startLng };
        const dest = { lat: destLat, lng: destLng };
        const arrivalDate = new Date(validatedData.arrivalTime);

        // Fetch ETAs concurrently
        let carEtaMinutes = 0;
        let busEtaMinutes = 0;
        try {
            [carEtaMinutes, busEtaMinutes] = await Promise.all([
                getCarEta(origin, dest, arrivalDate).catch((e: any) => {
                    console.error('Car ETA error:', e.message);
                    return 0; // Fallback to 0 if no route
                }),
                getTransitEta(origin, dest, arrivalDate).catch((e: any) => {
                    console.error('Transit ETA error:', e.message);
                    return 0; // Fallback to 0 if no route
                })
            ]);

            if (carEtaMinutes === 0 && busEtaMinutes === 0) {
                res.status(400).json({ success: false, error: 'No route found between the two addresses. Please check your addresses and try again.' });
                return;
            }
        } catch (error) {
            console.error('Error fetching ETAs concurrently:', error);
            res.status(500).json({ success: false, error: 'Failed to find routes' });
            return;
        }

        // Determine recommended transit
        let recommendedTransit = 'car';
        if (busEtaMinutes > 0 && carEtaMinutes > 0) {
            recommendedTransit = busEtaMinutes <= carEtaMinutes + 15 ? 'bus' : 'uber';
        } else if (busEtaMinutes > 0) {
            recommendedTransit = 'bus';
        } else if (carEtaMinutes > 0) {
            recommendedTransit = 'uber';
        }

        const selectedEtaMinutes = recommendedTransit === 'bus' ? busEtaMinutes : carEtaMinutes;

        // Departure time calculation = Required Arrival Time - (Selected ETA + Buffer Minutes)
        const departureDate = new Date(arrivalDate.getTime() - selectedEtaMinutes * 60000 - 5 * 60000); // adding a 5 minute safety buffer

        const newTrip = await prisma.trip.create({
            data: {
                user_id: userId,
                start_address: validatedData.startAddress,
                start_lat: startLat,
                start_lng: startLng,
                dest_address: validatedData.destAddress,
                dest_lat: destLat,
                dest_lng: destLng,
                required_arrival_time: arrivalDate,
                reminder_lead_minutes: validatedData.reminderLeadMinutes,
                status: 'pending',
                recommended_transit: recommendedTransit,
                bus_eta_minutes: busEtaMinutes,
                uber_eta_minutes: carEtaMinutes,
                departure_time: departureDate,
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
        const upcoming: any[] = [];
        const history: any[] = [];

        trips.forEach((trip) => {
            if (trip.required_arrival_time > now) {
                upcoming.push(mapTripToDto(trip));
            } else {
                // If it's passed its arrival time, mark as completed (in memory here, or DB update later)
                if (trip.status === 'pending' || trip.status === 'reminded') {
                    trip.status = 'completed';
                    // We don't necessarily need to await the DB update right here for the read query
                    // but it would be good to update it. We can do it asynchronously.
                    prisma.trip.update({ where: { id: trip.id }, data: { status: 'completed' } }).catch(console.error);
                }
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
