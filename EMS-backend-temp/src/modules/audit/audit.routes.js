import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import * as auditController from './audit.controller.js';

const router = Router();

router.use(verifyToken);
router.get('/', requirePermission('employees:read'), auditController.listLogs);

export default router;
