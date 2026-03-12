import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import * as tripController from '../src/controllers/tripController';

// 1. Mock the Prisma client
vi.mock('@prisma/client', () => {
    const mockPrisma = {
        trip: {
            create: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
    };
    return { PrismaClient: vi.fn(() => mockPrisma) };
});

// 2. Mock the middleware
vi.mock('../src/middleware/authMiddleware', () => ({
    authMiddleware: (req: any, res: any, next: any) => {
        req.userId = 'test-user-id';
        next();
    },
}));

// 3. Mock the here API Service layer directly to avoid fetch parsing logic
vi.mock('../src/services/hereApiService', () => ({
    geocodeAddress: vi.fn().mockResolvedValue({ lat: 10, lng: 10 }),
    getCarEta: vi.fn().mockResolvedValue(20),     // 20 minutes
    getTransitEta: vi.fn().mockResolvedValue(40), // 40 minutes
}));

import { geocodeAddress, getCarEta, getTransitEta } from '../src/services/hereApiService';

describe('Trip Controller Integration', () => {
    let app: Express;
    let prisma: any;

    beforeEach(() => {
        vi.clearAllMocks();
        prisma = new PrismaClient();

        app = express();
        app.use(express.json());
        // Standardize the route to match how it would be in tripRoutes.ts
        app.post('/api/trips', (req: any, res: any, next) => {
            req.userId = 'test-user-id';
            next();
        }, tripController.createTrip);
    });

    describe('POST /api/trips', () => {
        it('should successfully create a trip with missing coordinates by geocoding', async () => {
            const mockTripCreated = {
                id: 'trip-123',
                user_id: 'test-user-id',
                start_address: 'Start',
                start_lat: 10,
                start_lng: 10,
                dest_address: 'Dest',
                dest_lat: 10,
                dest_lng: 10,
                required_arrival_time: new Date('2030-03-10T12:00:00Z'),
                reminder_lead_minutes: 60,
                status: 'pending',
                recommended_transit: 'car',
                bus_eta_minutes: 40,
                uber_eta_minutes: 20,
                departure_time: new Date('2030-03-10T11:35:00Z'), // 12:00 - 20m - 5m buffer
                created_at: new Date('2030-03-10T11:30:00Z'),
            };

            prisma.trip.create.mockResolvedValue(mockTripCreated);

            const payload = {
                startAddress: 'Start',
                destAddress: 'Dest',
                arrivalTime: '2030-03-10T12:00:00.000Z',
            };

            const response = await request(app)
                .post('/api/trips')
                .send(payload);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            // Verify hereApiService was called
            expect(geocodeAddress).toHaveBeenCalledTimes(2);
            expect(getCarEta).toHaveBeenCalledTimes(1);
            expect(getTransitEta).toHaveBeenCalledTimes(1);

            // Verify mapping
            expect(response.body.data.id).toBe('trip-123');
            expect(response.body.data.recommendedTransit).toBe('car');
        });

        it('should handle API validation failures', async () => {
            const response = await request(app)
                .post('/api/trips')
                .send({
                    startAddress: '', // Invalid empty string
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Validation failed');
            expect(geocodeAddress).not.toHaveBeenCalled();
        });

        it('should recover if routing ETA APIs fail to retrieve data', async () => {
            // Mock a scenario where API throws errors
            vi.mocked(getCarEta).mockRejectedValueOnce(new Error('API Down'));
            vi.mocked(getTransitEta).mockRejectedValueOnce(new Error('API Down'));

            const payload = {
                startAddress: 'Start',
                destAddress: 'Dest',
                arrivalTime: '2030-03-10T12:00:00.000Z',
            };

            const response = await request(app)
                .post('/api/trips')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No route found between the two addresses. Please check your addresses and try again.');
            expect(prisma.trip.create).not.toHaveBeenCalled();
        });
    });
});
