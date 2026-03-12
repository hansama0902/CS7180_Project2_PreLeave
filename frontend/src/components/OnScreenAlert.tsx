import { useState, useEffect } from 'react';
import { useTripStore } from '../stores/tripStore';
import { hasPushPermission } from '../services/pushNotificationService';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export default function OnScreenAlert() {
    const { upcomingTrips } = useTripStore();
    const navigate = useNavigate();
    const [alertTrip, setAlertTrip] = useState<any | null>(null);

    useEffect(() => {
        // Fallback alert is only needed if push is denied or not supported
        if (hasPushPermission()) {
            return;
        }

        const checkUpcomingTrips = () => {
            const now = new Date();
            let triggeredTrip = null;

            for (const trip of upcomingTrips) {
                if (trip.status !== 'reminded' && trip.status !== 'completed' && trip.selectedTransit) {
                    const isBus = trip.selectedTransit === 'bus';
                    const leaveBy = isBus ? trip.busLeaveBy : trip.carLeaveBy;
                    if (leaveBy) {
                        const leaveDate = new Date(leaveBy);
                        const diffMins = (leaveDate.getTime() - now.getTime()) / 60000;
                        
                        // Alert if it's strictly within the 5 minute window
                        if (diffMins >= 0 && diffMins <= 5) {
                            triggeredTrip = trip;
                            break;
                        }
                    }
                }
            }

            if (triggeredTrip && (!alertTrip || alertTrip.id !== triggeredTrip.id)) {
                setAlertTrip(triggeredTrip);
            }
        };

        const intervalId = setInterval(checkUpcomingTrips, 30000); // Check every 30s
        checkUpcomingTrips();

        return () => clearInterval(intervalId);
    }, [upcomingTrips, alertTrip]);

    const handleDismiss = () => {
        setAlertTrip(null);
    };

    const handleViewTrip = () => {
        if (alertTrip) {
            navigate(`/trip-result/${alertTrip.id}`);
            setAlertTrip(null);
        }
    };

    if (!alertTrip) return null;

    const transitName = alertTrip.selectedTransit === 'bus' ? 'public transit' : 'driving';

    return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce cursor-default">
            <div className="bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4">
                <div className="text-3xl">🚗</div>
                <div className="flex-1">
                    <h3 className="font-extrabold text-lg">Time to leave!</h3>
                    <p className="text-sm font-medium opacity-90">
                        Leave now for your trip to {alertTrip.destAddress} ({transitName})
                    </p>
                </div>
                <div className="flex flex-col space-y-2">
                    <button 
                        onClick={handleViewTrip}
                        className="bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:bg-red-50 transition"
                    >
                        View Trip
                    </button>
                    <button 
                        onClick={handleDismiss}
                        className="text-white hover:text-red-200 transition p-1 text-center flex justify-center w-full"
                    >
                        <X className="w-5 h-5 mx-auto" />
                    </button>
                </div>
            </div>
        </div>
    );
}
