import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTripStore } from '../stores/tripStore';
import { MapPin, Clock, ArrowRight, Bus, CarFront, CheckCircle2, RefreshCw } from 'lucide-react';
import { registerPushSubscription, hasPushPermission, isPushDenied } from '../services/pushNotificationService';

export default function TripResultPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentTrip, fetchTrip, selectTransit, isLoading, error } = useTripStore();
    const [selectedMode, setSelectedMode] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await useTripStore.getState().refreshEta(id as string);
        } catch (error) {
            console.error('Failed to refresh ETA:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (location.state?.trip) {
            useTripStore.setState({ currentTrip: location.state.trip, isLoading: false, error: null });
        } else if (id && (!currentTrip || currentTrip.id !== id)) {
            fetchTrip(id);
        }
    }, [id, fetchTrip, location.state, currentTrip?.id]);

    useEffect(() => {
        if (currentTrip && selectedMode === null) {
            const initialMode = currentTrip.selectedTransit 
                ? currentTrip.selectedTransit 
                : currentTrip.recommendedTransit;
            setSelectedMode(initialMode || null);
        }
    }, [currentTrip, selectedMode]);

    if (isLoading && !currentTrip) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex items-center space-x-2 text-blue-600">
                    <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xl font-semibold">Loading Trip Details...</span>
                </div>
            </div>
        );
    }

    if (error || !currentTrip) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md w-full text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Trip Not Found</h2>
                    <p className="text-red-500 mb-6">{error || 'The requested trip could not be loaded.'}</p>
                    <button
                        onClick={() => navigate('/homepage')}
                        className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 transition"
                    >
                        Return to Homepage
                    </button>
                </div>
            </div>
        );
    }

    const {
        startAddress,
        destAddress,
        requiredArrivalTime,
        recommendedTransit,
        bufferMinutes = 5,
        busEtaMinutes,
        carEtaMinutes,
        busLeaveBy,
        carLeaveBy
    } = currentTrip;

    const arrivalDateObj = new Date(requiredArrivalTime);
    const arrivalDateFormatted = arrivalDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const arrivalTimeFormatted = arrivalDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const formatTime = (isoString?: string | null) => {
        if (!isoString) return 'N/A';
        return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const isBusPassed = busLeaveBy ? currentTime > new Date(busLeaveBy) : false;
    const isCarPassed = carLeaveBy ? currentTime > new Date(carLeaveBy) : false;

    const isBusAvailable = !!(busEtaMinutes && busEtaMinutes > 0);
    const isCarAvailable = !!(carEtaMinutes && carEtaMinutes > 0);

    const actualSelectedMode = selectedMode === 'bus' && isBusAvailable ? 'bus' : 
                               (selectedMode === 'car' && isCarAvailable ? 'car' : 
                               (isCarAvailable ? 'car' : 'bus'));

    const displayLeaveBy = actualSelectedMode === 'bus' ? busLeaveBy : carLeaveBy;
    const transitText = actualSelectedMode === 'bus' ? 'public transit' : 'driving';
    
    // Can the user actually click to toggle? They can only toggle if BOTH are available.
    const isToggleable = isBusAvailable && isCarAvailable;

    const handleSave = async () => {
        if (!currentTrip || !id) return;
        
        const currentSavedMode = currentTrip.selectedTransit
            ? currentTrip.selectedTransit 
            : currentTrip.recommendedTransit;

        if (actualSelectedMode !== currentSavedMode) {
            setIsSaving(true);
            await selectTransit(id, actualSelectedMode);
            setIsSaving(false);
        }
        
        if (!hasPushPermission() && !isPushDenied()) {
            const wantPush = window.confirm("Would you like to enable departure reminders? We'll notify you 5 minutes before your suggested departure time.");
            if (wantPush) {
                await registerPushSubscription();
            } else {
                localStorage.setItem('pushDenied', 'true');
            }
        } else if (hasPushPermission()) {
            await registerPushSubscription();
        }

        navigate('/homepage');
    };

    const handlePlanAnother = () => {
        navigate('/trips/new');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-2xl">
                {/* Header Section */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Trip Planned!</h1>
                    </div>
                    <p className="mt-2 text-lg text-gray-600">Your smart departure schedule is ready.</p>
                </div>

                {/* Trip Summary Card */}
                <div className="bg-white shadow rounded-lg overflow-hidden mb-8 border border-gray-100">
                    <div className="p-6">
                        <div className="flex flex-col space-y-4">
                            <div className="flex items-start">
                                <MapPin className="h-5 w-5 text-gray-400 mt-1 mr-3 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">From</p>
                                    <p className="text-gray-900 font-medium">{startAddress}</p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <ArrowRight className="h-5 w-5 text-blue-500 mt-1 mr-3 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">To</p>
                                    <p className="text-gray-900 font-medium">{destAddress}</p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <Clock className="h-5 w-5 text-yellow-500 mt-1 mr-3 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Arrive By</p>
                                    <p className="text-gray-900 font-medium">{arrivalDateFormatted} at {arrivalTimeFormatted}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recommended Departure Card */}
                <div className={`${displayLeaveBy && currentTime > new Date(displayLeaveBy) ? 'bg-red-600' : 'bg-gradient-to-br from-blue-600 to-indigo-700'} rounded-2xl shadow-xl mb-8 transform hover:scale-105 transition duration-500 relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition duration-300 pointer-events-none"></div>
                    <div className="p-8 text-center text-white relative z-10">
                        <h2 className={`text-lg font-medium uppercase tracking-wide mb-2 ${displayLeaveBy && currentTime > new Date(displayLeaveBy) ? 'text-white' : 'text-blue-100'}`}>
                            {displayLeaveBy && currentTime > new Date(displayLeaveBy) ? '⚠️ Recommended departure time has passed' : 'Recommended Departure Time'}
                        </h2>
                        <div className="text-5xl font-extrabold tracking-tight mb-2 flex items-center justify-center transition-all duration-300">
                            <Clock className="h-10 w-10 mr-4 opacity-80" />
                            {formatTime(displayLeaveBy)}
                        </div>
                        <p className={`${displayLeaveBy && currentTime > new Date(displayLeaveBy) ? 'text-red-200' : 'text-blue-200'} text-sm transition-opacity duration-300`}>
                            (Includes a {bufferMinutes} min buffer for {transitText})
                        </p>
                    </div>
                </div>

                {/* Comparison Section */}
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-lg font-semibold text-gray-900">Transit Comparison</h3>
                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center p-2 border border-transparent text-sm font-medium rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0 self-center disabled:opacity-50 transition-colors"
                        aria-label="Refresh ETA"
                    >
                        <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {/* Bus Option */}
                    {isBusAvailable && currentTrip.busAvailable !== false ? (
                        <div 
                            onClick={() => isToggleable && setSelectedMode('bus')}
                            className={`relative bg-white rounded-xl shadow p-6 border-2 transition-all duration-200 ${
                                actualSelectedMode === 'bus' ? 'border-blue-500 ring-4 ring-blue-50 transform scale-[1.02]' : 'border-transparent hover:border-gray-300'
                            } ${isToggleable ? 'cursor-pointer hover:shadow-md' : ''}`}
                        >
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 flex space-x-1 whitespace-nowrap">
                                {isBusPassed ? (
                                    <span className="bg-red-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center">
                                        ⚠️ Passed
                                    </span>
                                ) : recommendedTransit === 'bus' ? (
                                    <span className="bg-green-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Recommended
                                    </span>
                                ) : actualSelectedMode === 'bus' ? (
                                    <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Selected
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-center justify-between mb-4 mt-2">
                                <div className="flex items-center">
                                    <div className={`p-2 rounded-lg transition-colors ${actualSelectedMode === 'bus' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                        <Bus className={`h-6 w-6 ${actualSelectedMode === 'bus' ? 'text-blue-600' : 'text-gray-600'}`} />
                                    </div>
                                    <span className="ml-3 text-lg font-bold text-gray-900">Bus</span>
                                </div>
                                <span className="text-xl font-semibold text-gray-700">{busEtaMinutes} min</span>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <p className="text-sm text-gray-500 mb-1">Leave to catch bus by:</p>
                                <p className="text-lg font-medium text-gray-900">{formatTime(busLeaveBy)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-xl shadow p-6 border-2 border-transparent opacity-60 flex flex-col justify-center items-center">
                            <Bus className="h-8 w-8 text-gray-400 mb-2" />
                            {currentTrip.busAvailable === false ? (
                                <>
                                    <p className="text-gray-500 font-medium line-through">Bus</p>
                                    <p className="text-red-500 font-semibold text-sm mt-1">⏰ Not enough time</p>
                                </>
                            ) : (
                                <p className="text-gray-500 font-medium">Bus path unavailable</p>
                            )}
                        </div>
                    )}

                    {/* Car Option */}
                    {isCarAvailable && currentTrip.carAvailable !== false ? (
                        <div 
                            onClick={() => isToggleable && setSelectedMode('car')}
                            className={`relative bg-white rounded-xl shadow p-6 border-2 transition-all duration-200 ${
                                actualSelectedMode === 'car' ? 'border-blue-500 ring-4 ring-blue-50 transform scale-[1.02]' : 'border-transparent hover:border-gray-300'
                            } ${isToggleable ? 'cursor-pointer hover:shadow-md' : ''}`}
                        >
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 flex space-x-1 whitespace-nowrap">
                                {isCarPassed ? (
                                    <span className="bg-red-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center">
                                        ⚠️ Passed
                                    </span>
                                ) : recommendedTransit === 'car' ? (
                                    <span className="bg-green-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Recommended
                                    </span>
                                ) : actualSelectedMode === 'car' ? (
                                    <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center">
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Selected
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-center justify-between mb-4 mt-2">
                                <div className="flex items-center">
                                    <div className={`p-2 rounded-lg transition-colors ${actualSelectedMode === 'car' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                        <CarFront className={`h-6 w-6 ${actualSelectedMode === 'car' ? 'text-blue-600' : 'text-gray-600'}`} />
                                    </div>
                                    <span className="ml-3 text-lg font-bold text-gray-900">Car / Uber</span>
                                </div>
                                <span className="text-xl font-semibold text-gray-700">{carEtaMinutes} min</span>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <p className="text-sm text-gray-500 mb-1">Start driving by:</p>
                                <p className="text-lg font-medium text-gray-900">{formatTime(carLeaveBy)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-xl shadow p-6 border-2 border-transparent opacity-60 flex flex-col justify-center items-center">
                            <CarFront className="h-8 w-8 text-gray-400 mb-2" />
                            {currentTrip.carAvailable === false ? (
                                <>
                                    <p className="text-gray-500 font-medium line-through">Car / Uber</p>
                                    <p className="text-red-500 font-semibold text-sm mt-1">⏰ Not enough time</p>
                                </>
                            ) : (
                                <p className="text-gray-500 font-medium">Car path unavailable</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`flex-1 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-200 flex justify-center items-center ${
                            isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isSaving ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </span>
                        ) : (
                            'Save Trip'
                        )}
                    </button>
                    <button
                        onClick={handlePlanAnother}
                        disabled={isSaving}
                        className="flex-1 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-3 px-6 rounded-lg shadow-sm transition duration-200 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Plan Another Trip
                    </button>
                </div>
            </div>
        </div>
    );
}
