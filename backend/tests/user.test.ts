import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('User Endpoints', () => {
    describe('GET /api/users/profile', () => {
        it('returns the profile for the logged in user', async () => {
            const response = await request(app).get('/api/users/profile');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('username', 'NiceguyLang');
            expect(response.body.data).toHaveProperty('trips');
            expect(Array.isArray(response.body.data.trips)).toBe(true);
            expect(response.body.data.trips.length).toBeGreaterThan(0);
        });
    });
});
