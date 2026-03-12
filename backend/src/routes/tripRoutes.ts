import { Router } from 'express';
import { createTrip, getTrips, getTripById, updateTripTransitMode, deleteTrip, refreshEta } from '../controllers/tripController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all trip routes with authentication
router.use(authMiddleware);

router.post('/', createTrip);
router.get('/', getTrips);
router.get('/:id', getTripById);
router.patch('/:id/transit', updateTripTransitMode);
router.post('/:id/refresh-eta', refreshEta);
router.delete('/:id', deleteTrip);

export default router;
