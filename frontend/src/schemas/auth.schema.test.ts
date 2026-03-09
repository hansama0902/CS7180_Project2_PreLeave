import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from './auth.schema';

describe('Auth Schema Validation', () => {
    it('should validate a correct email and password for login', () => {
        const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' });
        expect(result.success).toBe(true);
    });

    it('should validate a correct payload for registration', () => {
        const result = registerSchema.safeParse({ email: 'test@example.com', password: 'password123', agreeToTerms: true });
        expect(result.success).toBe(true);
    });

    it('should invalidate an incorrect email', () => {
        const result = loginSchema.safeParse({ email: 'invalid-email', password: 'password123' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Invalid email address');
        }
    });

    it('should invalidate a short password during registration', () => {
        const result = registerSchema.safeParse({ email: 'test@example.com', password: '123', agreeToTerms: true });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Password must be at least 6 characters');
        }
    });

    it('should invalidate missing terms agreement during registration', () => {
        const result = registerSchema.safeParse({ email: 'test@example.com', password: 'password123' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('You must agree to the terms to proceed');
        }
    });
});
