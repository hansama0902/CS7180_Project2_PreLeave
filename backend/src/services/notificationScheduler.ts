import { PrismaClient } from '@prisma/client';
import { sendPushNotification } from './pushService';

const prisma = new PrismaClient();

export const startNotificationScheduler = () => {
    console.log('Starting push notification scheduler...');
    
    // Check every 30 seconds
    setInterval(async () => {
        try {
            const now = new Date();
            // Look ahead to capture both within 30 min (for 30m reminder) and 5 min (for 5m reminder)
            const lookahead30 = new Date(now.getTime() + 30 * 60000);

            // Find trips where EITHER they need a 30m OR 5m reminder
            const trips = await prisma.trip.findMany({
                where: {
                    status: { in: ['pending', 'reminded'] }
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
                console.log(`Checking ${trips.length} trips for notifications.`);
            }

            for (const trip of trips) {
                // If the trip already sent standard 5 minute, we actually don't need to process it anymore
                if (trip.notified && trip.notified_30min) {
                    continue;
                }

                // Determine the single unified departure time and mode
                // Fallback to recommendedTransit if user hasn't explicitly selected
                let resolvedMode = trip.selected_transit || trip.recommended_transit || 'bus';
                let isBus = resolvedMode === 'bus';
                let selectedDepartureTime = isBus ? trip.bus_leave_by : trip.car_leave_by;

                // Backend fallback: if recommended mode passed but other is valid, auto-switch
                if (!trip.selected_transit) {
                    const currentModeDate = selectedDepartureTime ? new Date(selectedDepartureTime) : null;
                    if (!currentModeDate || currentModeDate <= now) {
                        const otherMode = isBus ? 'car' : 'bus';
                        const otherDepartureTime = otherMode === 'bus' ? trip.bus_leave_by : trip.car_leave_by;
                        const otherModeDate = otherDepartureTime ? new Date(otherDepartureTime) : null;
                        
                        if (otherModeDate && otherModeDate > now) {
                            resolvedMode = otherMode;
                            isBus = resolvedMode === 'bus';
                            selectedDepartureTime = otherDepartureTime;
                            
                            await prisma.trip.update({
                                where: { id: trip.id },
                                data: { recommended_transit: resolvedMode }
                            });
                            console.log(`Recommendation fallback for trip ${trip.id}: changed to ${resolvedMode} because previous option expired.`);
                        }
                    }
                }

                // If somehow no departure time exists or it hasn't generated yet, skip
                if (!selectedDepartureTime) {
                    continue;
                }

                const departureDate = new Date(selectedDepartureTime);
                const diffMinutes = (departureDate.getTime() - now.getTime()) / 60000;
                
                // If we are way past the event, skip edge cases where it lingered
                if (diffMinutes < -60) {
                    continue; // Skip if they're over an hour late
                }

                if (trip.user && trip.user.push_subscriptions.length > 0) {
                    const transitName = isBus ? 'public transit' : 'driving';
                    const eta = isBus ? trip.bus_eta_minutes : trip.uber_eta_minutes;

                    const formattedDeparture = departureDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    
                    const sendToAllSubscriptions = async (payload: any, ttl: number) => {
                        let successCount = 0;
                        const promises = trip.user.push_subscriptions.map(sub => {
                            const pushSub = {
                                endpoint: sub.endpoint,
                                keys: { p256dh: sub.p256dh, auth: sub.auth },
                            };
                            return sendPushNotification(pushSub, payload, ttl).then(success => {
                                if (success) successCount++;
                            });
                        });
                        await Promise.allSettled(promises);
                        return successCount > 0;
                    };

                    let shouldUpdateSettings = false;
                    let newNotified30 = trip.notified_30min;
                    let newNotified5 = trip.notified;

                    // Condition 1: 30-minute reminder (if diff is 25-30 mins OR less and we haven't sent it yet)
                    if (!newNotified30 && diffMinutes <= 30 && diffMinutes > 0) {
                        const payload30 = {
                            title: "🔔 Departure in 30 minutes",
                            body: `Trip: ${trip.start_address} → ${trip.dest_address} | Leave by ${formattedDeparture} (${transitName}, ~${eta} min) | Start getting ready!`,
                            icon: "/logo.png",
                            badge: "/badge.png",
                            data: { tripId: trip.id, url: `/trip-result/${trip.id}` },
                            requireInteraction: true,
                            actions: [
                                { action: "open", title: "View Trip" },
                                { action: "dismiss", title: "Dismiss" }
                            ]
                        };
                        const sent = await sendToAllSubscriptions(payload30, 25 * 60); // 25 min TTL
                        if (sent) {
                            console.log(`30-min reminder sent for trip ${trip.id} (user: ${trip.user_id})`);
                            shouldUpdateSettings = true;
                            newNotified30 = true;
                        }
                    }

                    // Condition 2: 5-minute URGENT reminder
                    if (!newNotified5 && diffMinutes <= 5 && diffMinutes >= -15) { // Adding a small past-buffer in case the scheduler slipped 
                        const payload5 = {
                            title: "🚨 Time to leave NOW!",
                            body: `Trip: ${trip.start_address} → ${trip.dest_address} | You need to leave RIGHT NOW to arrive on time | Recommended: ${transitName} (~${eta} min)`,
                            icon: "/logo.png",
                            badge: "/badge.png",
                            data: { tripId: trip.id, url: `/trip-result/${trip.id}`, startAddress: trip.start_address, destAddress: trip.dest_address },
                            requireInteraction: true,
                            urgency: "high",
                            actions: [
                                { action: "open", title: "View Trip" },
                                { action: "navigate", title: "Open Maps" }
                            ]
                        };
                        const sent = await sendToAllSubscriptions(payload5, 4 * 60); // 4 min TTL
                        if (sent) {
                            console.log(`5-min URGENT reminder sent for trip ${trip.id} (user: ${trip.user_id})`);
                            shouldUpdateSettings = true;
                            newNotified5 = true;
                        }
                    }

                    if (shouldUpdateSettings) {
                        await prisma.trip.update({
                            where: { id: trip.id },
                            data: { 
                                notified_30min: newNotified30,
                                notified: newNotified5,
                                status: 'reminded' 
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error in notification scheduler:', error);
        }
    }, 30000); // 30 seconds
};
