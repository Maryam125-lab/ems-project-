import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { validateParams } from '../../middleware/validate.js';
import {
  getMyNotifications,
  markRead,
  createNotification,
} from './notifications.controller.js';

const router = Router();

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

router.use(verifyToken);

router.get('/', getMyNotifications);
router.patch('/:id/read', validateParams(uuidParamSchema), markRead);
router.post('/', requirePermission('notifications:write'), createNotification);

export default router;
