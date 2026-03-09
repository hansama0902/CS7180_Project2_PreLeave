import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from './ProfilePage';
import { useAuthStore } from '../stores/authStore';
import { useTripStore } from '../stores/tripStore';
import api from '../services/api';

vi.mock('../services/api');
const mockNavigate = vi.fn();

vi.mock('../stores/tripStore', () => ({
    useTripStore: vi.fn(() => ({
        historyTrips: [
            {
                id: '1',
                startAddress: '123 Main St',
                destAddress: '456 Market St',
                requiredArrivalTime: '2026-03-08T10:00:00Z',
                recommendedTransit: 'bus' as const,
            },
            {
                id: '2',
                startAddress: '789 Oak Ave',
                destAddress: '321 Pine Rd',
                requiredArrivalTime: '2026-03-09T14:30:00Z',
                recommendedTransit: 'uber' as const,
            }
        ],
        fetchTrips: vi.fn(),
        deleteTrip: vi.fn(),
        isLoading: false
    })),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...(actual as object),
        useNavigate: () => mockNavigate,
    };
});

describe('ProfilePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuthStore.setState({ user: { id: '123', email: 'test@example.com' } });
    });
    it('renders the header and back button', () => {
        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        expect(screen.getByText('PreLeave')).toBeInTheDocument();

        // The link should have aria-label="Back to Home"
        const backLink = screen.getByRole('link', { name: /back to home/i });
        expect(backLink).toBeInTheDocument();
        expect(backLink).toHaveAttribute('href', '/homepage');
    });

    it('renders the user profile information from store', () => {
        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Logged in as')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('renders trip history with reuse and delete buttons', () => {
        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        expect(screen.getByText('Trip History')).toBeInTheDocument();

        // Check for some mock data
        expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
        expect(screen.getByText(/456 Market St/)).toBeInTheDocument();

        const reuseButtons = screen.getAllByRole('button', { name: /reuse/i });
        expect(reuseButtons.length).toBeGreaterThan(0);

        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('handles logout flow correctly', async () => {
        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        const logoutBtn = screen.getByRole('button', { name: /logout/i });
        expect(logoutBtn).toBeInTheDocument();

        vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });

        fireEvent.click(logoutBtn);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/auth/logout');
            // The user should have been cleared in the store
            expect(useAuthStore.getState().user).toBeNull();
            // The user should be redirected to login
            expect(mockNavigate).toHaveBeenCalledWith('/login');
        });
    });

    it('calls deleteTrip when the delete button is clicked', () => {
        const mockDeleteTrip = vi.fn();
        // Override the mock to inject our mockDeleteTrip
        vi.mocked(useTripStore).mockReturnValue({
            historyTrips: [
                {
                    id: '1',
                    startAddress: '123 Main St',
                    destAddress: '456 Market St',
                    requiredArrivalTime: '2026-03-08T10:00:00Z',
                    recommendedTransit: 'bus' as const,
                }
            ],
            fetchTrips: vi.fn(),
            deleteTrip: mockDeleteTrip,
            isLoading: false
        } as any);

        render(
            <BrowserRouter>
                <ProfilePage />
            </BrowserRouter>
        );

        const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
        expect(deleteButtons.length).toBeGreaterThan(0);

        fireEvent.click(deleteButtons[0]);
        expect(mockDeleteTrip).toHaveBeenCalledWith('1');
    });
});
