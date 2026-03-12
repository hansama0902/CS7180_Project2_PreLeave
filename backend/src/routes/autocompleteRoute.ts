import { Router } from 'express';
import { getSuggestions } from '../controllers/autocompleteController';

const router = Router();

// GET /api/autocomplete?q=<query>
router.get('/', getSuggestions);

export default router;
