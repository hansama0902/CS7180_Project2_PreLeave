import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { sendPushNotification } from '../services/pushService';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const subscribeSchema = z.object({
    subscription: z.object({
        endpoint: z.string(),
        keys: z.object({
            p256dh: z.string(),
            auth: z.string(),
        }),
    }),
});

router.post('/subscribe', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const { subscription } = subscribeSchema.parse(req.body);

        // Save subscription
        await prisma.pushSubscription.create({
            data: {
                userId: userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
        });

        res.status(201).json({ success: true, data: { message: 'Subscribed successfully' } });
    } catch (error) {
        console.error('Push subscribe error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/unsubscribe', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const { endpoint } = req.body;
        if (endpoint) {
            await prisma.pushSubscription.deleteMany({
                where: {
                    userId: userId,
                    endpoint: endpoint,
                },
            });
        } else {
             await prisma.pushSubscription.deleteMany({
                where: {
                    userId: userId,
                },
            });
        }

        res.status(200).json({ success: true, data: { message: 'Unsubscribed successfully' } });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/test', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId },
        });

        if (subscriptions.length === 0) {
            res.status(404).json({ success: false, error: 'No active subscriptions' });
            return;
        }

        const payload = {
            title: "🚗 Test Notification",
            body: "This is a test push notification from PreLeave.",
            icon: "/logo.png",
            data: { url: "/homepage" }
        };

        const promises = subscriptions.map((sub) => {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };
            return sendPushNotification(pushSub, payload);
        });

        await Promise.all(promises);

        res.status(200).json({ success: true, message: 'Test notification sent' });
    } catch (error) {
        console.error('Push test error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
