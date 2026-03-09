import { Router } from 'express';
import { createTrip, getTrips, deleteTrip } from '../controllers/tripController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all trip routes with authentication
router.use(authMiddleware);

router.post('/', createTrip);
router.get('/', getTrips);
router.delete('/:id', deleteTrip);

export default router;
