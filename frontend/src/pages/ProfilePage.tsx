import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTripStore } from '../stores/tripStore';
import api from '../services/api';

export default function ProfilePage() {
    const user = useAuthStore((state) => state.user);
    const clearUser = useAuthStore((state) => state.clearUser);
    const { historyTrips, fetchTrips, deleteTrip, isLoading } = useTripStore();
    const navigate = useNavigate();
    const username = user?.email || "Guest";

    useEffect(() => {
        fetchTrips();
    }, [fetchTrips]);

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            clearUser();
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link
                            to="/homepage"
                            className="text-gray-500 hover:text-gray-900 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 inline-flex items-center"
                            aria-label="Back to Home"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">PreLeave</h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <div className="bg-white rounded-lg shadow p-6 mb-8 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
                        <p className="text-gray-600 mt-1">Logged in as <span className="font-semibold text-gray-900">{username}</span></p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        aria-label="Logout"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Trip History</h3>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {isLoading ? (
                            <li className="px-6 py-4 text-center text-gray-500">
                                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2 align-middle"></div>
                                Loading history...
                            </li>
                        ) : historyTrips.length > 0 ? (
                            historyTrips.map((trip) => (
                                <li key={trip.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {trip.startAddress} <span className="text-gray-400 mx-1">&rarr;</span> {trip.destAddress}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Arrive by: {new Date(trip.requiredArrivalTime).toLocaleString()}
                                        </p>
                                        {trip.recommendedTransit && (
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 capitalize ${trip.recommendedTransit === 'bus' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {trip.recommendedTransit} recommended
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/trips/new')}
                                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                            aria-label="Reuse"
                                        >
                                            <RefreshCw className="w-4 h-4 mr-1.5 text-gray-400" />
                                            Reuse
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteTrip(trip.id)}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                            aria-label="Delete"
                                        >
                                            <Trash2 className="w-4 h-4 mr-1.5" />
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            ))
                        ) : (
                            <li className="px-6 py-4 text-center text-gray-500">
                                No trip history yet.
                            </li>
                        )}
                    </ul>
                </div>
            </main>
        </div>
    );
}
