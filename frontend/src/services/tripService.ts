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
    recommendedTransit?: 'bus' | 'uber' | null;
    busEtaMinutes?: number | null;
    uberEtaMinutes?: number | null;
    departureTime?: string | null;
    createdAt: string;
}

export interface GetTripsResponse {
    success: boolean;
    data: {
        upcoming: Trip[];
        history: Trip[];
    };
    error?: string;
}

export interface CreateTripResponse {
    success: boolean;
    data?: Trip;
    error?: string;
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

export const createTrip = async (data: CreateTripDto): Promise<CreateTripResponse> => {
    const response = await api.post<CreateTripResponse>('/trips', data);
    return response.data;
};

export const deleteTrip = async (id: string): Promise<DeleteTripResponse> => {
    const response = await api.delete<DeleteTripResponse>(`/trips/${id}`);
    return response.data;
};
