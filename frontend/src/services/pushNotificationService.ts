import api from './api';

const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BIsrY5U2V07K-Yv8V-8z5r_uVpU4M_M0S6-7f41qjZ2zC_kH8o8Q1G6r3U7Yy0P5T2D9G6-w7B-2g5f3M4g'; 
// Note: Normally, this would be fetched from env variables. For this demo application we can safely assume it's loaded from env.

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const registerPushSubscription = async (): Promise<boolean> => {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications are not supported by the browser.');
            localStorage.setItem('pushDenied', 'true');
            return false;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            localStorage.setItem('pushDenied', 'true');
            return false;
        }
        
        localStorage.removeItem('pushDenied');

        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
            });
        }

        // Send subscription to backend
        await api.post('/push/subscribe', { subscription });
        
        return true;
    } catch (error) {
        console.error('Error registering push subscription:', error);
        return false;
    }
};

export const hasPushPermission = () => {
    if (!('Notification' in window)) return false;
    return Notification.permission === 'granted';
};

export const isPushDenied = () => {
    return localStorage.getItem('pushDenied') === 'true';
};
