import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import tripRoutes from './routes/tripRoutes';
import autocompleteRoutes from './routes/autocompleteRoute';
import pushRoutes from './routes/pushRoutes';
import { startNotificationScheduler } from './services/notificationScheduler';
import { startEtaRefreshScheduler } from './services/etaRefreshScheduler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(
    cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/autocomplete', autocompleteRoutes);
app.use('/api/push', pushRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok' } });
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
        startNotificationScheduler();
        startEtaRefreshScheduler();
    });
}

export default app;
