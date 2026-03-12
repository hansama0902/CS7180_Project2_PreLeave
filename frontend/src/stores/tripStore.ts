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
    recommendedTransit?: 'bus' | 'car' | null;
    selectedTransit?: 'bus' | 'car' | null;
    busEtaMinutes?: number | null;
    carEtaMinutes?: number | null;
    bufferMinutes?: number;
    busLeaveBy?: string | null;
    carLeaveBy?: string | null;
    departureTime?: string | null;
    createdAt: string;
    busAvailable?: boolean;
    carAvailable?: boolean;
    etaUpdatedAt?: string | null;
}

interface TripState {
    upcomingTrips: Trip[];
    historyTrips: Trip[];
    currentTrip: Trip | null;
    previewTrip: Trip | null;
    isLoading: boolean;
    error: string | null;
    fetchTrips: () => Promise<any>;
    fetchTrip: (id: string) => Promise<void>;
    createPreview: (tripData: { startAddress: string; destAddress: string; arrivalTime: string; reminderLeadMinutes?: number }) => Promise<{ success: boolean; error?: string; field?: string; data?: Trip }>;
    addTrip: (tripData: Omit<Trip, 'id' | 'createdAt' | 'status' | 'userId' | 'requiredArrivalTime' | 'reminderLeadMinutes'> & { arrivalTime: string, reminderLeadMinutes?: number }) => Promise<{ success: boolean; error?: string; field?: string; data?: Trip }>;
    deleteTrip: (id: string) => Promise<void>;
    refreshEta: (id: string) => Promise<void>;
    completeTrip: (id: string) => Promise<void>;
}

export const useTripStore = create<TripState>((set) => ({
    upcomingTrips: [],
    historyTrips: [],
    currentTrip: null,
    previewTrip: null,
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
            return { success: false, status: err.response?.status };
        }
    },
    fetchTrip: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await tripService.getTrip(id);
            if (response.success && response.data) {
                set({ currentTrip: response.data, isLoading: false });
            } else {
                set({ error: response.error || 'Failed to fetch trip details', isLoading: false });
            }
        } catch (err: any) {
            set({ error: err.response?.data?.error || 'Failed to fetch trip details', isLoading: false });
        }
    },
    createPreview: async (tripData) => {
        if (useTripStore.getState().isLoading) {
            return { success: false, error: 'Already loading' };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await tripService.previewTripService({
                startAddress: tripData.startAddress,
                destAddress: tripData.destAddress,
                arrivalTime: new Date(tripData.arrivalTime).toISOString(),
                reminderLeadMinutes: tripData.reminderLeadMinutes || 60,
            });
            if (response.success && response.data) {
                set({ isLoading: false, previewTrip: response.data as Trip });
                return { success: true, data: response.data as Trip };
            } else {
                set({ error: response.error || 'Preview failed', isLoading: false });
                return { success: false, error: response.error || 'Preview failed', field: response.field };
            }
        } catch (error: any) {
            const message = error.response?.data?.error || 'Preview failed';
            set({ error: message, isLoading: false });
            return { success: false, error: message };
        }
    },
    addTrip: async (tripData) => {
        // Guard against double-invocation (React 18 StrictMode or rapid clicks)
        if (useTripStore.getState().isLoading) {
            return { success: false, error: 'A trip is already being created' };
        }
        set({ isLoading: true, error: null });
        try {
            const response = await tripService.createTrip({
                startAddress: tripData.startAddress,
                destAddress: tripData.destAddress,
                arrivalTime: new Date(tripData.arrivalTime).toISOString(),
                reminderLeadMinutes: tripData.reminderLeadMinutes || 60,
            });
            if (response.success && response.data) {
                set({ isLoading: false, currentTrip: response.data });
                const store = useTripStore.getState();
                await store.fetchTrips();
                return { success: true, data: response.data };
            } else {
                set({ error: response.error || 'Failed to create trip', isLoading: false });
                return { success: false, error: response.error || 'Failed to create trip', field: response.field };
            }
        } catch (error: any) {
            const message = error.response?.data?.error || 'Failed to create trip';
            set({ error: message, isLoading: false });
            return { success: false, error: message };
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
    refreshEta: async (id: string) => {
        try {
            const { data } = await tripService.refreshEta(id);
            if (data) {
                set((state) => ({
                    currentTrip: state.currentTrip?.id === id ? data : state.currentTrip,
                    upcomingTrips: state.upcomingTrips.map((t) => (t.id === id ? data : t)),
                }));
            }
        } catch (error: any) {
            console.error('Failed to refresh ETA:', error);
        }
    },
    completeTrip: async (id: string) => {
        // 1. Snapshot the trip before touching state
        const tripToComplete = useTripStore.getState().upcomingTrips.find((t) => t.id === id);
        if (!tripToComplete) return;

        // 2. Optimistic update: immediately move trip to history in local state
        const completedTrip = { ...tripToComplete, status: 'completed' as const };
        set((state) => ({
            upcomingTrips: state.upcomingTrips.filter((t) => t.id !== id),
            historyTrips: [completedTrip, ...state.historyTrips],
        }));

        try {
            const response = await tripService.completeTrip(id);
            if (!response.success) {
                // Revert on API-level failure
                console.error('Complete trip failed:', response.error);
                set((state) => ({
                    upcomingTrips: [tripToComplete, ...state.upcomingTrips],
                    historyTrips: state.historyTrips.filter((t) => t.id !== id),
                    error: response.error || 'Failed to complete trip',
                }));
            }
        } catch (error: any) {
            // Revert on network/exception failure
            console.error('Complete trip exception:', error);
            set((state) => ({
                upcomingTrips: [tripToComplete, ...state.upcomingTrips],
                historyTrips: state.historyTrips.filter((t) => t.id !== id),
                error: 'Failed to complete trip — please try again',
            }));
        }
    },
}));
