import { Router } from 'express';
import { getProfile } from '../controllers/userController';

const router = Router();

// In a real app, this would be protected by an auth middleware.
// For now, we'll just implement the mock endpoint to fulfill the PRD's frontend requirements.
router.get('/profile', getProfile);

export default router;
