import { Router } from "express";
import clientRoutes from './client.routes';
import lawsuitRoutes from './lawsuit.routes';

const router = Router();


router.use('/clients', clientRoutes);
router.use('/lawsuits', lawsuitRoutes);

export default router;