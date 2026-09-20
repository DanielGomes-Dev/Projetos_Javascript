import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { createClient, getClientById, listClients } from "../controllers/client.controller";
import { batchImportLawsuits } from "../controllers/lawsuit.controller";


const router = Router();

router.post('/', asyncHandler(createClient));
router.get('/', asyncHandler(listClients));
router.get('/:id', asyncHandler(getClientById));

export default router;