import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import * as announcementController from './announcements.controller.js';

const router = Router();

router.use(verifyToken);

router.get('/', announcementController.listAnnouncements);
router.post('/', requirePermission('employees:write'), announcementController.createAnnouncement);
router.patch('/:id', requirePermission('employees:write'), announcementController.updateAnnouncement);
router.delete('/:id', requirePermission('employees:write'), announcementController.deleteAnnouncement);

export default router;
