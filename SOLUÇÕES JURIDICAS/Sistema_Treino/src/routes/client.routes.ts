import { Router } from 'express';
import { createClient, getClientById, listClients } from '../controllers/client.controller.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

router.post('/', asyncHandler(createClient));
router.get('/', asyncHandler(listClients));
router.get('/:id', asyncHandler(getClientById));

export default router;