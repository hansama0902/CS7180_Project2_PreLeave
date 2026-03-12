import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:test@example.com';

let pushEnabled = false;

// Configure Web Push — guard against missing/invalid keys crashing the server
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        pushEnabled = true;
    } catch (err) {
        console.warn('Web Push disabled: invalid VAPID keys.', err);
    }
} else {
    console.warn('Web Push disabled: VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set.');
}

export const sendPushNotification = async (subscription: any, payload: any, ttl = 240) => {
    if (!pushEnabled) {
        console.warn('Push notification skipped: push not configured.');
        return false;
    }
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: ttl });
        return true;
    } catch (error) {
        console.error('Error sending push notification:', error);
        return false;
    }
};
