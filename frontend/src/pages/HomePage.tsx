import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCircle, Plus, MapPin, Clock, Navigation, Trash2, RefreshCw } from 'lucide-react';
import { useTripStore } from '../stores/tripStore';
import OnScreenAlert from '../components/OnScreenAlert';

export default function HomePage() {
    const navigate = useNavigate();
    const { upcomingTrips, fetchTrips, isLoading, deleteTrip } = useTripStore();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [refreshingTrips, setRefreshingTrips] = useState<Record<string, boolean>>({});
    const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const handleRefresh = async (tripId: string) => {
        setRefreshingTrips((prev) => ({ ...prev, [tripId]: true }));
        try {
            await useTripStore.getState().refreshEta(tripId);
        } catch (error) {
            console.error('Failed to refresh ETA:', error);
        } finally {
            setRefreshingTrips((prev) => ({ ...prev, [tripId]: false }));
        }
    };

    useEffect(() => {
        fetchTrips();
        const timeIntervalId = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        fetchIntervalRef.current = setInterval(async () => {
            const result = await useTripStore.getState().fetchTrips();
            if (result && result.status === 401 && fetchIntervalRef.current) {
                clearInterval(fetchIntervalRef.current);
            }
        }, 120000);
        return () => {
            clearInterval(timeIntervalId);
            if (fetchIntervalRef.current) {
                clearInterval(fetchIntervalRef.current);
            }
        };
    }, [fetchTrips]);
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <OnScreenAlert />
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900">PreLeave</h1>
                    <nav>
                        <Link
                            to="/profile"
                            className="text-gray-500 hover:text-gray-900 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 inline-flex items-center"
                            aria-label="User Profile"
                        >
                            <UserCircle className="w-8 h-8" />
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Upcoming Trips</h2>
                    <button
                        onClick={() => navigate('/trips/new')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        Plan New Trip
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-20 bg-white rounded-lg shadow border border-gray-200">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading your trips...</p>
                    </div>
                ) : upcomingTrips.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-lg shadow border border-gray-200">
                        <Navigation className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming trips</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by planning a new trip.</p>
                        <div className="mt-6">
                            <button
                                onClick={() => navigate('/trips/new')}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                                Plan Trip
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {upcomingTrips.map((trip) => {
                            const isBusPassed = trip.busLeaveBy ? currentTime > new Date(trip.busLeaveBy) : false;
                            const isCarPassed = trip.carLeaveBy ? currentTime > new Date(trip.carLeaveBy) : false;
                            const allPassed = isBusPassed && isCarPassed;

                            return (
                            <div key={trip.id} className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
                                {allPassed && (
                                    <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center">
                                        <span className="text-red-600 text-sm font-medium">⚠️ All transit options have passed their suggested departure times</span>
                                    </div>
                                )}
                                <div className="px-4 py-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex flex-col gap-1 mb-2">
                                            <div className="flex items-center text-sm font-medium text-gray-900">
                                                <MapPin className="mr-2 h-4 w-4 text-green-500" />
                                                From: {trip.startAddress}
                                            </div>
                                            <div className="flex items-center text-sm font-medium text-gray-900">
                                                <MapPin className="mr-2 h-4 w-4 text-red-500" />
                                                To: {trip.destAddress}
                                            </div>
                                        </div>
                                        <div className="flex items-center text-sm text-gray-500">
                                            <Clock className="mr-2 h-5 w-5 text-gray-400" />
                                            Arrive by: {new Date(trip.requiredArrivalTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                        </div>
                                        {trip.etaUpdatedAt && (
                                            <div className="text-xs text-blue-500 italic mt-1">
                                                ETA updated at {new Date(trip.etaUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 sm:mt-0 sm:ml-6 flex-shrink-0 flex items-center justify-between sm:justify-start w-full sm:w-auto">
                                        <div className="flex space-x-4 mr-4 w-full sm:w-auto">
                                            {/* Bus Card */}
                                            {trip.busEtaMinutes && trip.busAvailable !== false ? (
                                                <div className={`flex flex-col items-center justify-center p-3 rounded-lg border flex-1 ${trip.recommendedTransit === 'bus' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-gray-50'} w-32`}>
                                                    <div className="text-xl mb-1">🚌</div>
                                                    <div className="font-bold text-gray-900">{trip.busEtaMinutes} min</div>
                                                    {trip.busLeaveBy && (
                                                        <div className="text-xs text-gray-500 whitespace-nowrap">
                                                            Leave {new Date(trip.busLeaveBy).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                    {isBusPassed ? (
                                                        <div className="mt-1 text-[10px] text-red-600 font-bold whitespace-nowrap">⚠️ Passed</div>
                                                    ) : trip.recommendedTransit === 'bus' ? (
                                                        <div className="mt-1 text-[10px] uppercase tracking-wider font-bold text-green-700 flex items-center">
                                                           <span className="mr-1">✓</span> Recommended
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-200 bg-gray-50 w-32 text-center text-gray-400 opacity-60 flex-1">
                                                    <div className="text-xl mb-1 opacity-50">🚌</div>
                                                    {trip.busAvailable === false ? (
                                                        <>
                                                            <div className="text-[10px] font-bold line-through text-gray-400">Bus</div>
                                                            <div className="text-[10px] mt-1 text-red-500 font-semibold leading-tight">⏰ Not enough</div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs italic">No route</div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Car Card */}
                                            {trip.carEtaMinutes && trip.carAvailable !== false ? (
                                                <div className={`flex flex-col items-center justify-center p-3 rounded-lg border flex-1 ${trip.recommendedTransit === 'car' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-gray-50'} w-32`}>
                                                    <div className="text-xl mb-1">🚗</div>
                                                    <div className="font-bold text-gray-900">{trip.carEtaMinutes || '...'} min</div>
                                                    {trip.carLeaveBy && (
                                                        <div className="text-xs text-gray-500 whitespace-nowrap">
                                                            Leave {new Date(trip.carLeaveBy).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                    {isCarPassed ? (
                                                        <div className="mt-1 text-[10px] text-red-600 font-bold whitespace-nowrap">⚠️ Passed</div>
                                                    ) : trip.recommendedTransit === 'car' ? (
                                                        <div className="mt-1 text-[10px] uppercase tracking-wider font-bold text-green-700 flex items-center">
                                                            <span className="mr-1">✓</span> Recommended
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-3 rounded-lg border border-gray-200 bg-gray-50 w-32 text-center text-gray-400 opacity-60 flex-1">
                                                    <div className="text-xl mb-1 opacity-50">🚗</div>
                                                    {trip.carAvailable === false ? (
                                                        <>
                                                            <div className="text-[10px] font-bold line-through text-gray-400">Car / Uber</div>
                                                            <div className="text-[10px] mt-1 text-red-500 font-semibold leading-tight">⏰ Not enough</div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs italic">No route</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => handleRefresh(trip.id)}
                                                disabled={refreshingTrips[trip.id]}
                                                className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0 self-center disabled:opacity-50 transition-colors"
                                                aria-label={`Refresh ETA for trip to ${trip.destAddress}`}
                                            >
                                                <RefreshCw className={`h-5 w-5 ${refreshingTrips[trip.id] ? 'animate-spin text-blue-500' : ''}`} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteTrip(trip.id)}
                                                className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shrink-0 self-center transition-colors"
                                                aria-label={`Delete trip to ${trip.destAddress}`}
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
