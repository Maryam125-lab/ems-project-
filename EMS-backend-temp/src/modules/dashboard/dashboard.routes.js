import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import {
	getHRMetrics,
	getEmployeeSelfMetrics,
	getPendingActions,
	getUrgentAlerts,
} from './dashboard.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/metrics', requirePermission('dashboard:read'), getHRMetrics);
router.get('/me', getEmployeeSelfMetrics);
router.get('/pending-actions', requirePermission('pending_actions:read'), getPendingActions);
router.get('/urgent-alerts', requirePermission('alerts:read'), getUrgentAlerts);

export default router;
