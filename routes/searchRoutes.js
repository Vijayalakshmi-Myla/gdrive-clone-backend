import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { search } from '../controllers/searchController.js';

const router = Router();
router.use(authMiddleware);
router.get('/', search);
export default router;
