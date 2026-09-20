import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { batchImportLawsuits, createLawsuit, getLawsuitById } from "../controllers/lawsuit.controller";

const router = Router();

router.post('/batch-import', asyncHandler(batchImportLawsuits));

router.post('/', asyncHandler(createLawsuit));
router.get('/:id', asyncHandler(getLawsuitById));

export default router;
