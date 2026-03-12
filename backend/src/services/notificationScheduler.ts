import { PrismaClient } from '@prisma/client';
import { sendPushNotification } from './pushService';

const prisma = new PrismaClient();

export const startNotificationScheduler = () => {
    console.log('Starting push notification scheduler...');
    
    // Check every 30 seconds
    setInterval(async () => {
        try {
            const now = new Date();
            // Look ahead 5 minutes
            const lookahead = new Date(now.getTime() + 5 * 60000);

            // Find all pending trips that have a selected transit mode
            // and where the relevant leaveBy date is between now and lookahead,
            // and haven't been notified yet.
            const trips = await prisma.trip.findMany({
                where: {
                    status: 'pending',
                    selected_transit: { not: null },
                    notified: false,
                    OR: [
                        {
                            selected_transit: 'bus',
                            bus_leave_by: {
                                lte: lookahead,
                                gte: now
                            }
                        },
                        {
                            selected_transit: 'car',
                            car_leave_by: {
                                lte: lookahead,
                                gte: now
                            }
                        }
                    ]
                },
                include: {
                    user: {
                        include: {
                            push_subscriptions: true
                        }
                    }
                }
            });

            if (trips.length > 0) {
                console.log(`Found ${trips.length} trips requiring departure notifications.`);
            }

            for (const trip of trips) {
                if (trip.user && trip.user.push_subscriptions.length > 0) {
                    const isBus = trip.selected_transit === 'bus';
                    const transitName = isBus ? 'public transit' : 'driving';
                    const eta = isBus ? trip.bus_eta_minutes : trip.uber_eta_minutes; // note the DB uses uber_eta_minutes here
                    
                    const payload = {
                        title: "🚗 Time to leave!",
                        body: `From ${trip.start_address} to ${trip.dest_address} — leave now (approx. ${eta} min ${transitName})`,
                        icon: "/logo.png",
                        data: { tripId: trip.id, url: `/trip-result/${trip.id}` }
                    };

                    let successCount = 0;
                    const promises = trip.user.push_subscriptions.map(sub => {
                        const pushSub = {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        };
                        return sendPushNotification(pushSub, payload).then(success => {
                            if (success) successCount++;
                        });
                    });

                    await Promise.allSettled(promises);
                    
                    if (successCount > 0) {
                        // Mark as notified so we don't spam them
                        await prisma.trip.update({
                            where: { id: trip.id },
                            data: { notified: true, status: 'reminded' }
                        });
                        console.log(`Notified user for trip ${trip.id}`);
                    }
                }
            }

        } catch (error) {
            console.error('Error in notification scheduler:', error);
        }
    }, 30000); // 30 seconds
};
