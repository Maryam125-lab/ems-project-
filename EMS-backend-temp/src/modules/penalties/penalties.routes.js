import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { validateParams } from '../../middleware/validate.js';
import {
  getPenaltyRules,
  createPenaltyRule,
  updatePenaltyRule,
  getPenalties,
  getMyPenalties,
  proposePenalty,
  approvePenalty,
  rejectPenalty,
  acknowledgePenalty,
} from './penalties.controller.js';

const router = Router();

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

router.use(verifyToken);

router.get('/penalty-rules', requirePermission('penalties:propose'), getPenaltyRules);
router.post('/penalty-rules', requirePermission('penalty_rules:write'), createPenaltyRule);
router.patch('/penalty-rules/:id', requirePermission('penalty_rules:write'), validateParams(uuidParamSchema), updatePenaltyRule);

router.get('/penalties', requirePermission('penalties:read_all'), getPenalties);
router.get('/penalties/mine', requirePermission('penalties:read_own'), getMyPenalties);
router.post('/penalties', requirePermission('penalties:propose'), proposePenalty);
router.patch('/penalties/:id/approve', requirePermission('penalties:review'), validateParams(uuidParamSchema), approvePenalty);
router.patch('/penalties/:id/reject', requirePermission('penalties:review'), validateParams(uuidParamSchema), rejectPenalty);
router.patch('/penalties/:id/ack', validateParams(uuidParamSchema), acknowledgePenalty);

export default router;
