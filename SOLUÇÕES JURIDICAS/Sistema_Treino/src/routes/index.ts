import { Router } from 'express';
import clientRoutes from './client.routes.js';
import lawsuitRoutes from './lawsuit.routes.js';

const router = Router();

router.use('/clients', clientRoutes);
router.use('/lawsuits', lawsuitRoutes);

export default router;