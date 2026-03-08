import { Link } from 'react-router-dom';
import { UserCircle } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
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

            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <div className="text-center py-20 bg-white rounded-lg shadow mt-6">
                    <h2 className="text-2xl font-semibold text-gray-700">Welcome to PreLeave</h2>
                    <p className="mt-2 text-gray-500">Your upcoming trips will appear here.</p>
                </div>
            </main>
        </div>
    );
}
