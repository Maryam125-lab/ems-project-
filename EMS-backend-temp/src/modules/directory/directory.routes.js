import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { validateParams } from '../../middleware/validate.js';
import { getDirectory, createEntry, updateEntry } from './directory.controller.js';

const router = Router();

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

router.use(verifyToken);

router.get('/', requirePermission('directory:read'), getDirectory);
router.post('/', requirePermission('directory:write'), createEntry);
router.patch('/:id', requirePermission('directory:write'), validateParams(uuidParamSchema), updateEntry);

export default router;
