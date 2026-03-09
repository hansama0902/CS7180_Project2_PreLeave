import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// In a real app, this should be a secure, random string imported from env vars.
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret';

const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = registerSchema.parse(req.body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            res.status(409).json({ success: false, error: 'User already exists' });
            return;
        }

        const password_hash = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email,
                password_hash,
            },
        });

        // Generate tokens
        const accessToken = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(201).json({
            success: true,
            data: {
                user: { id: newUser.id, email: newUser.email },
                accessToken,
            },
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                res.status(409).json({ success: false, error: 'User already exists' });
            } else {
                console.error('Registration Prisma error:', error);
                res.status(500).json({ success: false, error: 'Database error' });
            }
        } else {
            console.error('Registration error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Generic error message for security
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        // Generate tokens
        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        // Set refresh token in httpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json({
            success: true,
            data: {
                user: { id: user.id, email: user.email },
                accessToken,
            },
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
        } else {
            console.error('Login error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    // Clear the httpOnly cookie
    res.clearCookie('refreshToken');
    res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
};
