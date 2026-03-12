import { useState, useEffect } from 'react';
import { useTripStore } from '../stores/tripStore';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

export default function OnScreenAlert() {
    const { upcomingTrips } = useTripStore();
    const navigate = useNavigate();
    const [alertTrip, setAlertTrip] = useState<any | null>(null);
    const [alertType, setAlertType] = useState<'30min' | '5min' | null>(null);
    const [dismissedTrips, setDismissedTrips] = useState<Set<string>>(new Set());

    useEffect(() => {
        const checkUpcomingTrips = () => {
            const now = new Date();
            let triggeredTrip = null;
            let triggeredType: '30min' | '5min' | null = null;

            console.debug('[OnScreenAlert] Checking', upcomingTrips.length, 'trips at', now.toISOString());

            for (const trip of upcomingTrips) {
                let resolvedMode = trip.selectedTransit || trip.recommendedTransit;
                let isBusMode = resolvedMode === 'bus';
                let selectedDepartureTime = isBusMode ? trip.busLeaveBy : trip.carLeaveBy;

                // Auto-switch fallback if the chosen mode has expired but the other is still valid
                if (!trip.selectedTransit) {
                    const currentModeDate = selectedDepartureTime ? new Date(selectedDepartureTime) : null;
                    const isCurrentExpired = !currentModeDate || currentModeDate <= now;

                    if (isCurrentExpired) {
                        const otherMode = isBusMode ? 'car' : 'bus';
                        const otherDepartureTime = otherMode === 'bus' ? trip.busLeaveBy : trip.carLeaveBy;
                        const otherModeDate = otherDepartureTime ? new Date(otherDepartureTime) : null;
                        const isOtherValid = otherModeDate && otherModeDate > now;

                        if (isOtherValid) {
                            resolvedMode = otherMode;
                            selectedDepartureTime = otherDepartureTime;
                        }
                    }
                }

                if (!resolvedMode || !selectedDepartureTime) {
                    console.debug('[OnScreenAlert] Trip', trip.id, 'skipped: no resolved mode or departure time');
                    continue;
                }

                const leaveDate = new Date(selectedDepartureTime);
                const diffMins = (leaveDate.getTime() - now.getTime()) / 60000;

                console.debug('[OnScreenAlert] Trip', trip.id, 'diffMins:', diffMins.toFixed(1), 'mode:', resolvedMode, 'status:', trip.status);

                // 5-min alert: fires regardless of remind status (on-screen ≠ push)
                if (diffMins >= 0 && diffMins <= 5 && !dismissedTrips.has(`${trip.id}-5min`)) {
                    triggeredTrip = trip;
                    triggeredType = '5min';
                    break;
                }

                // 30-min alert: skip if already reminded or completed
                if (diffMins > 25 && diffMins <= 30 && !dismissedTrips.has(`${trip.id}-30min`) &&
                    trip.status !== 'reminded' && trip.status !== 'completed') {
                    triggeredTrip = trip;
                    triggeredType = '30min';
                    // don't break — a 5min alert on another trip takes precedence
                }
            }

            if (triggeredTrip && (!alertTrip || alertTrip.id !== triggeredTrip.id || alertType !== triggeredType)) {
                console.debug('[OnScreenAlert] 🔔 Triggering alert', triggeredType, 'for trip', triggeredTrip.id);
                setAlertTrip(triggeredTrip);
                setAlertType(triggeredType);

                // 30-min alerts auto-dismiss after 60s
                if (triggeredType === '30min') {
                    setTimeout(() => {
                        setAlertTrip((prev: any) => prev?.id === triggeredTrip.id ? null : prev);
                        setAlertType(null);
                        setDismissedTrips(prev => new Set(prev).add(`${triggeredTrip.id}-30min`));
                    }, 60000);
                }
            }
        };

        const intervalId = setInterval(checkUpcomingTrips, 30000); // Check every 30s
        checkUpcomingTrips(); // Also run immediately

        return () => clearInterval(intervalId);
    }, [upcomingTrips, alertTrip, alertType, dismissedTrips]);

    const handleDismiss = () => {
        if (alertTrip && alertType) {
            setDismissedTrips(prev => new Set(prev).add(`${alertTrip.id}-${alertType}`));
        }
        setAlertTrip(null);
        setAlertType(null);
    };

    const handleViewTrip = () => {
        if (alertTrip) {
            navigate(`/trip-result/${alertTrip.id}`);
            if (alertType) {
                setDismissedTrips(prev => new Set(prev).add(`${alertTrip.id}-${alertType}`));
            }
            setAlertTrip(null);
            setAlertType(null);
        }
    };

    if (!alertTrip || !alertType) return null;

    const resolvedMode = alertTrip.selectedTransit || alertTrip.recommendedTransit;
    const transitName = resolvedMode === 'bus' ? 'public transit' : 'driving';

    return (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 cursor-default ${alertType === '5min' ? 'animate-bounce' : 'shadow-lg'}`}>
            <div className={`${alertType === '5min' ? 'bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-400' : 'bg-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-300'} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4 transition-colors duration-300`}>
                <div className="text-3xl">{alertType === '5min' ? '🚨' : '🔔'}</div>
                <div className="flex-1 min-w-[200px]">
                    <h3 className="font-extrabold text-lg">
                        {alertType === '5min' ? 'Time to leave NOW!' : '30 minutes until departure'}
                    </h3>
                    <p className="text-sm font-medium opacity-90">
                        {alertType === '5min' 
                            ? `Leave now for your trip to ${alertTrip.destAddress} (${transitName})`
                            : `Start getting ready for your trip to ${alertTrip.destAddress} (${transitName})`
                        }
                    </p>
                </div>
                <div className="flex flex-col space-y-2 border-l border-white/20 pl-4 ml-2">
                    <button 
                        onClick={handleViewTrip}
                        className={`bg-white text-xs font-bold px-4 py-2 rounded-lg shadow transition ${alertType === '5min' ? 'text-red-700 hover:bg-red-50' : 'text-orange-600 hover:bg-orange-50'}`}
                    >
                        View Trip
                    </button>
                    <button 
                        onClick={handleDismiss}
                        className="text-white hover:text-white/70 transition p-1 text-center flex justify-center w-full focus:outline-none focus:ring-2 focus:ring-white/50 rounded"
                        aria-label="Dismiss alert"
                    >
                        <X className="w-5 h-5 mx-auto" />
                    </button>
                </div>
            </div>
        </div>
    );
}
