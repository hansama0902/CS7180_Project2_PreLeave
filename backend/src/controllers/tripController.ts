import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';

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

        // Calculate a dummy departure time (dummy ETA ~30 mins + lead minutes)
        // In reality, this would use a routing API.
        const arrivalDate = new Date(validatedData.arrivalTime);
        const dummyEtaMinutes = Math.floor(Math.random() * 30) + 15; // 15-45 mins

        const departureDate = new Date(arrivalDate.getTime() - dummyEtaMinutes * 60000);

        const newTrip = await prisma.trip.create({
            data: {
                user_id: userId,
                start_address: validatedData.startAddress,
                start_lat: validatedData.startLat,
                start_lng: validatedData.startLng,
                dest_address: validatedData.destAddress,
                dest_lat: validatedData.destLat,
                dest_lng: validatedData.destLng,
                required_arrival_time: arrivalDate,
                reminder_lead_minutes: validatedData.reminderLeadMinutes,
                status: 'pending',
                recommended_transit: Math.random() > 0.5 ? 'bus' : 'uber', // Mock recommendation
                bus_eta_minutes: Math.floor(Math.random() * 30) + 15,
                uber_eta_minutes: Math.floor(Math.random() * 20) + 10,
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
