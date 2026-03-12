import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodeAddress, getCarEta, getTransitEta } from '../src/services/hereApiService';

describe('hereApiService', () => {
    beforeEach(() => {
        // Mock the global fetch object
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('geocodeAddress', () => {
        it('should return coordinates for a valid address', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    items: [
                        { position: { lat: 37.7749, lng: -122.4194 } }
                    ]
                })
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            const result = await geocodeAddress('San Francisco');
            expect(result).toEqual({ lat: 37.7749, lng: -122.4194 });
            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Check url contains query
            const calledUrl = (global.fetch as any).mock.calls[0][0];
            expect(calledUrl).toContain('q=San+Francisco');
        });

        it('should throw an error if no results are found', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ items: [] })
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            await expect(geocodeAddress('Invalid Address 12345')).rejects.toThrow('Address not found');
        });

        it('should throw an error if the API request fails', async () => {
            const mockResponse = {
                ok: false,
                statusText: 'Internal Server Error'
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            await expect(geocodeAddress('Boston')).rejects.toThrow('Geocoding failed');
        });
    });

    describe('getCarEta', () => {
        const origin = { lat: 37.7749, lng: -122.4194 };
        const dest = { lat: 37.3382, lng: -121.8863 };
        const arrivalTime = new Date('2026-03-10T12:00:00Z');

        it('should return ETA in minutes for a valid car route', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    routes: [
                        {
                            sections: [
                                { summary: { duration: 3600 } }, // 60 mins
                                { summary: { duration: 600 } }   // 10 mins
                            ]
                        }
                    ]
                })
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            const result = await getCarEta(origin, dest, arrivalTime);
            expect(result).toBe(70); // 3600 + 600 = 4200s = 70m

            const calledUrl = (global.fetch as any).mock.calls[0][0];
            expect(calledUrl).toContain('transportMode=car');
        });

        it('should throw an error if no car routes are found', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ routes: [] })
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            await expect(getCarEta(origin, dest, arrivalTime)).rejects.toThrow('No route found');
        });
    });

    describe('getTransitEta', () => {
        const origin = { lat: 37.7749, lng: -122.4194 };
        const dest = { lat: 37.3382, lng: -121.8863 };
        const arrivalTime = new Date('2026-03-10T12:00:00Z');

        it('should return ETA in minutes for a valid public transit route', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    routes: [
                        {
                            sections: [
                                { summary: { duration: 1800 } } // 30 mins
                            ]
                        }
                    ]
                })
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            const result = await getTransitEta(origin, dest, arrivalTime);
            expect(result).toBe(30);

            const calledUrl = (global.fetch as any).mock.calls[0][0];
            expect(calledUrl).toContain('https://transit.router.hereapi.com/v8/routes');
        });

        it('should throw an error for 204 No Content (No Route)', async () => {
            const mockResponse = {
                ok: false,
                status: 204,
                statusText: 'No Content'
            };
            (global.fetch as any).mockResolvedValue(mockResponse);

            await expect(getTransitEta(origin, dest, arrivalTime)).rejects.toThrow('No route found for publicTransport');
        });
    });
});
