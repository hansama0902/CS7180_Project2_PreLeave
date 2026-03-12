import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTripStore } from '../stores/tripStore';
import { planTripSchema, PlanTripFormData } from '../schemas/trip.schema';
import { MapPin, Clock } from 'lucide-react';
import api from '../services/api';

interface Suggestion {
    label: string;
    address: any;
}

export default function PlanPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const createPreview = useTripStore((state) => state.createPreview);
    const [formWarning, setFormWarning] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<PlanTripFormData>({
        resolver: zodResolver(planTripSchema),
    });

    const [startQuery, setStartQuery] = useState('');
    const [destQuery, setDestQuery] = useState('');
    const [startSuggestions, setStartSuggestions] = useState<Suggestion[]>([]);
    const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
    const [showStartDropdown, setShowStartDropdown] = useState(false);
    const [showDestDropdown, setShowDestDropdown] = useState(false);
    const [loadingStart, setLoadingStart] = useState(false);
    const [loadingDest, setLoadingDest] = useState(false);

    const startDropdownRef = useRef<HTMLDivElement>(null);
    const destDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (startDropdownRef.current && !startDropdownRef.current.contains(event.target as Node)) {
                setShowStartDropdown(false);
            }
            if (destDropdownRef.current && !destDropdownRef.current.contains(event.target as Node)) {
                setShowDestDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // Handle pre-filling from state (for Reuse feature) or just setting current time
        if (location.state?.startAddress) {
            setValue('startAddress', location.state.startAddress, { shouldValidate: true });
        }
        if (location.state?.destAddress) {
            setValue('destAddress', location.state.destAddress, { shouldValidate: true });
        }

        // Set date to today
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        setValue('arrivalDate', formattedDate, { shouldValidate: true });

        // Set time: either from state or fallback to nearest 5 minutes
        if (location.state?.arrivalTime) {
            // Parse time from ISO string, ensuring it is shown in local time
            const originalDate = new Date(location.state.arrivalTime);
            const hours = String(originalDate.getHours()).padStart(2, '0');
            const mins = String(originalDate.getMinutes()).padStart(2, '0');
            setValue('arrivalTime', `${hours}:${mins}`, { shouldValidate: true });
        } else {
            const minutes = now.getMinutes();
            const remainder = minutes % 5;
            const addMinutes = remainder === 0 ? 0 : 5 - remainder;
            now.setMinutes(minutes + addMinutes);
            now.setSeconds(0);
            now.setMilliseconds(0);
            
            const hours = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            setValue('arrivalTime', `${hours}:${mins}`, { shouldValidate: true });
        }

        // Clear state so it doesn't stay around if the user navigates away and back
        window.history.replaceState({}, document.title);
    }, [location.state, setValue]);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (startQuery.length < 3) {
                setStartSuggestions([]);
                return;
            }
            setLoadingStart(true);
            try {
                const res = await api.get(`/autocomplete?q=${encodeURIComponent(startQuery)}`);
                if (res.data.success) {
                    setStartSuggestions(res.data.data);
                }
            } catch (err) {
                console.error('Autocomplete error:', err);
            } finally {
                setLoadingStart(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchSuggestions();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [startQuery]);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (destQuery.length < 3) {
                setDestSuggestions([]);
                return;
            }
            setLoadingDest(true);
            try {
                const res = await api.get(`/autocomplete?q=${encodeURIComponent(destQuery)}`);
                if (res.data.success) {
                    setDestSuggestions(res.data.data);
                }
            } catch (err) {
                console.error('Autocomplete error:', err);
            } finally {
                setLoadingDest(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchSuggestions();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [destQuery]);

    const handleSelectStart = (suggestion: Suggestion) => {
        setValue('startAddress', suggestion.label, { shouldValidate: true });
        setStartQuery('');
        setShowStartDropdown(false);
        setFormWarning(null);
        setFormError(null);
    };

    const handleSelectDest = (suggestion: Suggestion) => {
        setValue('destAddress', suggestion.label, { shouldValidate: true });
        setDestQuery('');
        setShowDestDropdown(false);
        setFormWarning(null);
        setFormError(null);
    };

    const onSubmit = async (data: PlanTripFormData) => {
        setFormWarning(null);
        setFormError(null);
        try {
            const arrivalIsoString = new Date(`${data.arrivalDate}T${data.arrivalTime}`).toISOString();
            
            const arrivalDateTime = new Date(arrivalIsoString);
            const now = new Date();
            const diffMinutes = (arrivalDateTime.getTime() - now.getTime()) / 60000;
            
            if (diffMinutes <= 0) {
                setFormError("Arrival time has already passed. Please select a future time.");
                return; // block submission
            }
            if (diffMinutes < 15) {
                setFormWarning("Note: Arrival time is very close. Some transit options may not be feasible.");
            }

            const result = await createPreview({
                startAddress: data.startAddress,
                destAddress: data.destAddress,
                arrivalTime: arrivalIsoString,
            });
            
            if (!result.success) {
                setFormError(result.error || "Failed to plan trip");
                return;
            }

            if (result.data) {
                navigate('/trip-result/preview', { state: { preview: result.data } });
            }
        } catch (err: any) {
            setFormError(err.message || 'An unexpected error occurred');
        }
    };

    const { onChange: formStartChange, ...startRest } = register('startAddress');
    const { onChange: formDestChange, ...destRest } = register('destAddress');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Plan a New Trip
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Enter your trip details to get smart departure recommendations.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {formError && (
                        <div className="mb-4 bg-red-500 border border-red-600 rounded-md p-4">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <span className="text-white text-base leading-none">❌</span>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-white font-medium">
                                        {formError}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    {formWarning && (
                        <div className="mb-4 bg-yellow-100 border border-yellow-300 rounded-md p-4">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <span className="text-yellow-800 text-base leading-none">⚠️</span>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-yellow-800 font-medium whitespace-pre-wrap">
                                        {formWarning}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <form 
                        className="space-y-6" 
                        onSubmit={handleSubmit(onSubmit)} 
                        onChange={() => {
                            setFormWarning(null);
                            setFormError(null);
                        }}
                        noValidate
                    >

                        <div ref={startDropdownRef} className="relative">
                            <label htmlFor="startAddress" className="block text-sm font-medium text-gray-700">
                                Start Address
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="startAddress"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="e.g. 123 Main St"
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.startAddress ? 'border-red-300' : ''}`}
                                    {...startRest}
                                    onChange={(e) => {
                                        formStartChange(e);
                                        setStartQuery(e.target.value);
                                        setShowStartDropdown(true);
                                    }}
                                />
                            </div>
                            
                            {showStartDropdown && (startQuery.length >= 3) && (
                                <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200">
                                    {loadingStart ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading suggestions...
                                        </div>
                                    ) : startSuggestions.length > 0 ? (
                                        <ul className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                            {startSuggestions.map((suggestion, idx) => (
                                                <li
                                                    key={idx}
                                                    onClick={() => handleSelectStart(suggestion)}
                                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 text-gray-900"
                                                >
                                                    <span className="block truncate">{suggestion.label}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="px-4 py-2 text-sm text-gray-500">No matching addresses found.</div>
                                    )}
                                </div>
                            )}

                            {errors.startAddress && (
                                <p className="mt-2 text-sm text-red-600">{errors.startAddress.message}</p>
                            )}
                        </div>

                        <div ref={destDropdownRef} className="relative">
                            <label htmlFor="destAddress" className="block text-sm font-medium text-gray-700">
                                Destination Address
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPin className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="destAddress"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="e.g. 456 Work Ave"
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.destAddress ? 'border-red-300' : ''}`}
                                    {...destRest}
                                    onChange={(e) => {
                                        formDestChange(e);
                                        setDestQuery(e.target.value);
                                        setShowDestDropdown(true);
                                    }}
                                />
                            </div>
                            
                            {showDestDropdown && (destQuery.length >= 3) && (
                                <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200">
                                    {loadingDest ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading suggestions...
                                        </div>
                                    ) : destSuggestions.length > 0 ? (
                                        <ul className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                            {destSuggestions.map((suggestion, idx) => (
                                                <li
                                                    key={idx}
                                                    onClick={() => handleSelectDest(suggestion)}
                                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 text-gray-900"
                                                >
                                                    <span className="block truncate">{suggestion.label}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="px-4 py-2 text-sm text-gray-500">No matching addresses found.</div>
                                    )}
                                </div>
                            )}

                            {errors.destAddress && (
                                <p className="mt-2 text-sm text-red-600">{errors.destAddress.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="arrivalDate" className="block text-sm font-medium text-gray-700">
                                Required Arrival Date
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Clock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="arrivalDate"
                                    type="date"
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.arrivalDate ? 'border-red-300' : ''}`}
                                    {...register('arrivalDate')}
                                />
                            </div>
                            {errors.arrivalDate && (
                                <p className="mt-2 text-sm text-red-600">{errors.arrivalDate.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="arrivalTime" className="block text-sm font-medium text-gray-700">
                                Required Arrival Time
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Clock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="arrivalTime"
                                    type="time"
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.arrivalTime ? 'border-red-300' : ''}`}
                                    {...register('arrivalTime')}
                                />
                            </div>
                            {errors.arrivalTime && (
                                <p className="mt-2 text-sm text-red-600">{errors.arrivalTime.message}</p>
                            )}
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Planning...
                                    </span>
                                ) : (
                                    'Plan Trip'
                                )}
                            </button>
                        </div>
                    </form>
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => navigate('/homepage')}
                            className="text-sm font-medium text-blue-600 hover:text-blue-500"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
