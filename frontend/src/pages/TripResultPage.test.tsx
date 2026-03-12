import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TripResultPage from './TripResultPage';
import { useTripStore } from '../stores/tripStore';

// Mock the store
vi.mock('../stores/tripStore', () => ({
    useTripStore: vi.fn(),
}));

// Mock react-router-dom
const mockedUseNavigate = vi.fn();
const mockedUseParams = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual as any,
        useNavigate: () => mockedUseNavigate,
        useParams: () => mockedUseParams(),
    };
});

describe('TripResultPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedUseParams.mockReturnValue({ id: 'trip-123' });
    });

    const createMockTrip = (overrides = {}) => {
        const mockDate = new Date();
        mockDate.setDate(mockDate.getDate() + 1); // Set to tomorrow so times are in the future
        mockDate.setHours(17, 30, 0, 0);
        return {
            id: 'trip-123',
            startAddress: '937 Helen Ave, San Leandro, CA',
            destAddress: '5000 MacArthur Blvd, Oakland, CA',
            requiredArrivalTime: mockDate.toISOString(),
            recommendedTransit: 'car',
            busEtaMinutes: 45,
            carEtaMinutes: 20,
            bufferMinutes: 5,
            busLeaveBy: new Date(mockDate.getTime() - 45 * 60000 - 5 * 60000).toISOString(),
            carLeaveBy: new Date(mockDate.getTime() - 20 * 60000 - 5 * 60000).toISOString(),
            departureTime: new Date(mockDate.getTime() - 20 * 60000 - 5 * 60000).toISOString(),
            ...overrides,
        };
    };

    it('renders loading state initially', () => {
        (useTripStore as any).mockReturnValue({
            currentTrip: null,
            fetchTrip: vi.fn(),
            selectTransit: vi.fn(),
            isLoading: true,
            error: null,
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);
        expect(screen.getByText('Loading Trip Details...')).toBeInTheDocument();
    });

    it('renders error state when trip fetch fails', () => {
        (useTripStore as any).mockReturnValue({
            currentTrip: null,
            fetchTrip: vi.fn(),
            selectTransit: vi.fn(),
            isLoading: false,
            error: 'Failed to fetch trip details',
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);
        expect(screen.getByText('Trip Not Found')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch trip details')).toBeInTheDocument();
    });

    it('renders trip details properly and defaults to recommended mode', async () => {
        const mockFetchTrip = vi.fn();
        const mockTrip = createMockTrip();

        (useTripStore as any).mockReturnValue({
            currentTrip: mockTrip,
            fetchTrip: mockFetchTrip,
            selectTransit: vi.fn(),
            isLoading: false,
            error: null,
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);

        expect(screen.getByText('937 Helen Ave, San Leandro, CA')).toBeInTheDocument();
        expect(screen.getByText('5000 MacArthur Blvd, Oakland, CA')).toBeInTheDocument();
        expect(screen.getByText('45 min')).toBeInTheDocument();
        expect(screen.getByText('20 min')).toBeInTheDocument();

        // Default should be Car (Recommended)
        expect(screen.getByText('(Includes a 5 min buffer for driving)')).toBeInTheDocument();
        // Since it's the default and only selection, there should be "Recommended" but no explicit "Selected" override badge initially
        expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('updates departure time card when Bus is clicked', async () => {
        const mockTrip = createMockTrip();
        const mockSelectTransit = vi.fn();

        (useTripStore as any).mockReturnValue({
            currentTrip: mockTrip,
            fetchTrip: vi.fn(),
            selectTransit: mockSelectTransit,
            isLoading: false,
            error: null,
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);

        // Verify initial state
        expect(screen.getByText('(Includes a 5 min buffer for driving)')).toBeInTheDocument();

        // Click on Bus card (by clicking the Bus text or icon, we can find it)
        const busElement = screen.getByText('Bus').closest('div.relative.bg-white') as HTMLElement;
        fireEvent.click(busElement);

        // Verify UI updates instantly (local state)
        await waitFor(() => {
            expect(screen.getByText('(Includes a 5 min buffer for public transit)')).toBeInTheDocument();
        });
        
        // Ensure "Selected" badge appears on Bus
        expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('auto-selects Car and disables Bus when Bus is unavailable', async () => {
        const mockTrip = createMockTrip({
            busEtaMinutes: null,
            busLeaveBy: null,
            recommendedTransit: 'car',
        });

        (useTripStore as any).mockReturnValue({
            currentTrip: mockTrip,
            fetchTrip: vi.fn(),
            selectTransit: vi.fn(),
            isLoading: false,
            error: null,
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);

        expect(screen.getByText('Bus path unavailable')).toBeInTheDocument();
        
        const carElement = screen.getByText('Car / Uber').closest('div.relative.bg-white') as HTMLElement;
        fireEvent.click(carElement); // shouldn't trigger state issues, isToggleable is false
    });

    it('sends selectTransit request ONLY if selection changed when saving', async () => {
        const mockTrip = createMockTrip();
        const mockSelectTransit = vi.fn().mockResolvedValue({ success: true });

        (useTripStore as any).mockReturnValue({
            currentTrip: mockTrip,
            fetchTrip: vi.fn(),
            selectTransit: mockSelectTransit,
            isLoading: false,
            error: null,
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);
        
        // NO CHANGE SCENARIO
        const saveButton = screen.getByText('Save Trip');
        fireEvent.click(saveButton);
        
        expect(mockSelectTransit).not.toHaveBeenCalled();
        expect(mockedUseNavigate).toHaveBeenCalledWith('/homepage');
    });

    it('sends selectTransit request if selection changed when saving', async () => {
        const mockTrip = createMockTrip();
        const mockSelectTransit = vi.fn().mockResolvedValue({ success: true });

        (useTripStore as any).mockReturnValue({
            currentTrip: mockTrip,
            fetchTrip: vi.fn(),
            selectTransit: mockSelectTransit,
            isLoading: false,
            error: null,
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);
        
        // CHANGE SCENARIO
        const busElement = screen.getByText('Bus').closest('div.relative.bg-white') as HTMLElement;
        fireEvent.click(busElement);
        
        const saveButton = screen.getByText('Save Trip');
        fireEvent.click(saveButton);

        expect(mockSelectTransit).toHaveBeenCalledWith('trip-123', 'bus');
        await waitFor(() => {
            expect(mockedUseNavigate).toHaveBeenCalledWith('/homepage');
        });
    });

    it('navigates to new trip page when Plan Another is clicked', () => {
        const mockTrip = createMockTrip();

        (useTripStore as any).mockReturnValue({
            currentTrip: mockTrip,
            fetchTrip: vi.fn(),
            selectTransit: vi.fn(),
            isLoading: false,
            error: null,
        });

        render(<BrowserRouter><TripResultPage /></BrowserRouter>);
        
        const planAnotherBtn = screen.getByText('Plan Another Trip');
        fireEvent.click(planAnotherBtn);
        
        expect(mockedUseNavigate).toHaveBeenCalledWith('/trips/new');
    });
});
