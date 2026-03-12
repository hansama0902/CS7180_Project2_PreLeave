import api from './api';

export interface CreateTripDto {
    startAddress: string;
    startLat?: number;
    startLng?: number;
    destAddress: string;
    destLat?: number;
    destLng?: number;
    arrivalTime: string;
    reminderLeadMinutes: number;
}

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

export interface GetTripsResponse {
    success: boolean;
    data: {
        upcoming: Trip[];
        history: Trip[];
    };
    error?: string;
}

export interface SingleTripResponse {
    success: boolean;
    data?: Trip;
    error?: string;
}

export interface CreateTripResponse {
    success: boolean;
    data?: Trip;
    error?: string;
    field?: string;
}

export interface DeleteTripResponse {
    success: boolean;
    data?: { id: string };
    error?: string;
}

export const getTrips = async (): Promise<GetTripsResponse> => {
    const response = await api.get<GetTripsResponse>('/trips');
    return response.data;
};

export const getTrip = async (id: string): Promise<SingleTripResponse> => {
    const response = await api.get<SingleTripResponse>(`/trips/${id}`);
    return response.data;
};

export const createTrip = async (data: CreateTripDto): Promise<CreateTripResponse> => {
    const response = await api.post<CreateTripResponse>('/trips', data);
    return response.data;
};

export const updateTripTransit = async (id: string, mode: string): Promise<SingleTripResponse> => {
    const response = await api.patch<SingleTripResponse>(`/trips/${id}/transit`, { mode });
    return response.data;
};

export const deleteTrip = async (id: string): Promise<DeleteTripResponse> => {
    const response = await api.delete<DeleteTripResponse>(`/trips/${id}`);
    return response.data;
};

export const refreshEta = async (id: string): Promise<SingleTripResponse> => {
    const response = await api.post<SingleTripResponse>(`/trips/${id}/refresh-eta`);
    return response.data;
};
