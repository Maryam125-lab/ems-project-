import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import {
  getConfigEntity,
  createConfigEntity,
  updateConfigEntity,
} from './config.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/:entity', requirePermission('config:read'), getConfigEntity);
router.post('/:entity', requirePermission('config:write'), createConfigEntity);
router.patch('/:entity/:id', requirePermission('config:write'), updateConfigEntity);

export default router;
