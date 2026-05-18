import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import * as promotionController from './promotions.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', requirePermission('employees:read'), promotionController.listPromotions);
router.post('/', requirePermission('employees:write'), promotionController.createPromotion);
router.patch('/:id/approve', requirePermission('employees:write'), promotionController.approvePromotion);
router.patch('/:id/reject', requirePermission('employees:write'), promotionController.rejectPromotion);

export default router;
