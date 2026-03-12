import { PrismaClient } from '@prisma/client';
import { recalculateTripEta } from '../controllers/tripController';

const prisma = new PrismaClient();

export const startEtaRefreshScheduler = () => {
    console.log('ETA refresh scheduler started (interval: 10 minutes)');

    // Run every 2 minutes, checking for trips that haven't been updated in 10 minutes
    setInterval(async () => {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60000);

            // Find trips that need refreshing 
            // (status pending, not past required arrival time, and eta_updated_at is older than 10 mins)
            const tripsToRefresh = await prisma.trip.findMany({
                where: {
                    status: 'pending',
                    required_arrival_time: {
                        gt: new Date()
                    },
                    eta_updated_at: {
                        lte: tenMinutesAgo
                    }
                },
                take: 10 // batch to prevent overwhelming HERE API
            });

            console.log(`ETA refresh: checking ${tripsToRefresh.length} active trips`);

            let updatedCount = 0;
            let skippedCount = 0; // We might not skip any here since query filters, but we record failures or logic skips

            for (const trip of tripsToRefresh) {
                try {
                    await recalculateTripEta(trip.id);
                    updatedCount++;
                } catch (error: any) {
                    skippedCount++;
                    console.error(`ETA refresh error for trip ${trip.id}: ${error.message || error}`);
                }
            }

            if (tripsToRefresh.length > 0) {
                console.log(`ETA refresh: updated ${updatedCount} trips, skipped ${skippedCount} expired trips`);
            }
        } catch (error) {
            console.error('Error in ETA refresh scheduler:', error);
        }
    }, 2 * 60000); // Check every 2 minutes
};
