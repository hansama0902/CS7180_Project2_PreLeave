import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:test@example.com';

// Configure Web Push
webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

export const sendPushNotification = async (subscription: any, payload: any) => {
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return true;
    } catch (error) {
        console.error('Error sending push notification:', error);
        return false;
    }
};
