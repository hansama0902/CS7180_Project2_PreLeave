import { create } from 'zustand';
import * as tripService from '../services/tripService';

export interface Trip {
    id: string;
    userId: string;
    startAddress: string;
    startLat?: number | null;
    startLng?: number | null;
    destAddress: string;
    destLat?: number | null;
    destLng?: number | null;
    requiredArrivalTime: string;
    reminderLeadMinutes: number;
    status: 'pending' | 'reminded' | 'completed' | 'cancelled';
    recommendedTransit?: 'bus' | 'uber' | null;
    busEtaMinutes?: number | null;
    uberEtaMinutes?: number | null;
    departureTime?: string | null;
    createdAt: string;
}

interface TripState {
    upcomingTrips: Trip[];
    historyTrips: Trip[];
    isLoading: boolean;
    error: string | null;
    fetchTrips: () => Promise<void>;
    addTrip: (tripData: Omit<Trip, 'id' | 'createdAt' | 'status' | 'userId' | 'requiredArrivalTime' | 'reminderLeadMinutes'> & { arrivalTime: string, reminderLeadMinutes?: number }) => Promise<void>;
    deleteTrip: (id: string) => Promise<void>;
}

export const useTripStore = create<TripState>((set) => ({
    upcomingTrips: [],
    historyTrips: [],
    isLoading: false,
    error: null,
    fetchTrips: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await tripService.getTrips();
            if (response.success) {
                set({
                    upcomingTrips: response.data.upcoming,
                    historyTrips: response.data.history,
                    isLoading: false
                });
            } else {
                set({ error: response.error || 'Failed to fetch trips', isLoading: false });
            }
        } catch (err: any) {
            set({ error: err.response?.data?.error || 'Failed to fetch trips', isLoading: false });
        }
    },
    addTrip: async (tripData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await tripService.createTrip({
                startAddress: tripData.startAddress,
                destAddress: tripData.destAddress,
                arrivalTime: new Date(tripData.arrivalTime).toISOString(),
                reminderLeadMinutes: tripData.reminderLeadMinutes || 60,
            });
            if (response.success && response.data) {
                // To keep it simple, just re-fetch all trips after adding instead of doing logic locally
                set({ isLoading: false });
                const store = useTripStore.getState();
                await store.fetchTrips();
            } else {
                set({ error: response.error || 'Failed to create trip', isLoading: false });
            }
        } catch (err: any) {
            set({ error: err.response?.data?.error || 'Failed to create trip', isLoading: false });
        }
    },
    deleteTrip: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await tripService.deleteTrip(id);
            if (response.success) {
                set({ isLoading: false });
                const store = useTripStore.getState();
                await store.fetchTrips();
            } else {
                set({ error: response.error || 'Failed to delete trip', isLoading: false });
            }
        } catch (err: any) {
            set({ error: err.response?.data?.error || 'Failed to delete trip', isLoading: false });
        }
    },
}));
