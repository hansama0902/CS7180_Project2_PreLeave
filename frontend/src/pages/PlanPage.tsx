import { useState } from 'react';
import { useForm, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../stores/tripStore';
import { planTripSchema, PlanTripFormData } from '../schemas/trip.schema';
import { MapPin, Clock } from 'lucide-react';

export default function PlanPage() {
    const navigate = useNavigate();
    const addTrip = useTripStore((state) => state.addTrip);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<PlanTripFormData>({
        resolver: zodResolver(planTripSchema),
    });

    const onSubmit = async (data: PlanTripFormData) => {
        setSubmitError(null);
        try {
            const arrivalIsoString = new Date(`${data.arrivalDate}T${data.arrivalTime}`).toISOString();
            const result = await addTrip({
                startAddress: data.startAddress,
                destAddress: data.destAddress,
                arrivalTime: arrivalIsoString,
            });
            
            if (result.success) {
                navigate('/homepage');
            } else {
                if (result.field && (result.field === 'startAddress' || result.field === 'destAddress')) {
                    setError(result.field as Path<PlanTripFormData>, { type: 'server', message: result.error });
                } else {
                    setSubmitError(result.error || 'An unexpected error occurred');
                }
            }
        } catch (err: any) {
            setSubmitError(err.message || 'An unexpected error occurred');
        }
    };

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
                    {submitError && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <p className="text-sm text-red-600">
                                        {submitError}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>

                        <div>
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
                                    placeholder="e.g. 123 Main St"
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.startAddress ? 'border-red-300' : ''
                                        }`}
                                    {...register('startAddress')}
                                />
                            </div>
                            {errors.startAddress && (
                                <p className="mt-2 text-sm text-red-600">{errors.startAddress.message}</p>
                            )}
                        </div>

                        <div>
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
                                    placeholder="e.g. 456 Work Ave"
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.destAddress ? 'border-red-300' : ''
                                        }`}
                                    {...register('destAddress')}
                                />
                            </div>
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
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.arrivalDate ? 'border-red-300' : ''
                                        }`}
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
                                    className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm text-gray-900 border-gray-300 rounded-md py-2 px-3 border ${errors.arrivalTime ? 'border-red-300' : ''
                                        }`}
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
