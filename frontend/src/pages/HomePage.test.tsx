import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import HomePage from './HomePage';
import { useTripStore } from '../stores/tripStore';

// Mock the navigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock the Zustand store
vi.mock('../stores/tripStore', () => ({
    useTripStore: vi.fn(),
}));

describe('HomePage', () => {
    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <HomePage />
            </BrowserRouter>
        );
    };

    it('renders the header and user profile link', () => {
        vi.mocked(useTripStore).mockReturnValue({ upcomingTrips: [], fetchTrips: vi.fn(), isLoading: false });
        renderComponent();

        expect(screen.getByText('PreLeave')).toBeInTheDocument();

        // The link should have aria-label="User Profile"
        const profileLink = screen.getByRole('link', { name: /user profile/i });
        expect(profileLink).toBeInTheDocument();
        expect(profileLink).toHaveAttribute('href', '/profile');
    });

    it('renders the empty state message when there are no upcoming trips', () => {
        vi.mocked(useTripStore).mockReturnValue({ upcomingTrips: [], fetchTrips: vi.fn(), isLoading: false });
        renderComponent();

        expect(screen.getByText('No upcoming trips')).toBeInTheDocument();
        expect(screen.getByText('Get started by planning a new trip.')).toBeInTheDocument();
        // Should have "Plan New Trip" in header, and "Plan Trip" in empty state
        expect(screen.getAllByRole('button', { name: /plan/i }).length).toBeGreaterThan(0);
    });

    it('renders list of trips when there are upcoming trips in the store', () => {
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 2);

        const mockTrips = [
            {
                id: '1',
                startAddress: 'Home',
                destAddress: 'Office',
                arrivalTime: futureDate.toISOString(),
                requiredArrivalTime: futureDate.toISOString(),
                status: 'pending' as const,
                createdAt: new Date().toISOString(),
                recommendedTransit: 'bus' as const,
                departureTime: new Date().toISOString()
            }
        ];

        vi.mocked(useTripStore).mockReturnValue({ upcomingTrips: mockTrips, fetchTrips: vi.fn(), isLoading: false });
        renderComponent();

        expect(screen.getByText(/Office/)).toBeInTheDocument();
        expect(screen.getByText(/take bus/i)).toBeInTheDocument();
        // Missing the empty state
        expect(screen.queryByText('No upcoming trips')).not.toBeInTheDocument();
    });

    it('calls deleteTrip when the delete button is clicked', () => {
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 2);

        const mockTrips = [
            {
                id: '1',
                startAddress: 'Home',
                destAddress: 'Office',
                arrivalTime: futureDate.toISOString(),
                requiredArrivalTime: futureDate.toISOString(),
                status: 'pending' as const,
                createdAt: new Date().toISOString(),
                recommendedTransit: 'bus' as const,
                departureTime: new Date().toISOString()
            }
        ];

        const mockDeleteTrip = vi.fn();
        vi.mocked(useTripStore).mockReturnValue({
            upcomingTrips: mockTrips,
            fetchTrips: vi.fn(),
            deleteTrip: mockDeleteTrip,
            isLoading: false
        });

        renderComponent();

        const deleteButton = screen.getByRole('button', { name: /delete trip to office/i });
        expect(deleteButton).toBeInTheDocument();

        deleteButton.click();
        expect(mockDeleteTrip).toHaveBeenCalledWith('1');
    });
});
