import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
    withCredentials: true, // Required to send and receive httpOnly cookies
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRedirecting = false;

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            useAuthStore.getState().clearUser();

            if (!isRedirecting) {
                isRedirecting = true;
                const highestId = window.setInterval(() => {}, 0);
                for (let i = 0; i < highestId; i++) {
                    window.clearInterval(i);
                }
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
