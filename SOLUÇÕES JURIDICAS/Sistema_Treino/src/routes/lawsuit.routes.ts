import { Router } from 'express';
import { batchImportLawsuits, createLawsuit, getLawsuitById } from '../controllers/lawsuit.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

// Rota específica antes da rota com :id para evitar colisão de path.
router.post('/batch-import', asyncHandler(batchImportLawsuits));
router.post('/', asyncHandler(createLawsuit));
router.get('/:id', asyncHandler(getLawsuitById));

export default router;