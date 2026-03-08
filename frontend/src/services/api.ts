import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api',
    withCredentials: true, // Required to send and receive httpOnly cookies
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
