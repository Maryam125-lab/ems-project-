import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { validate, validateParams } from '../../middleware/validate.js';
import {
  getLeaveRequests,
  getMyLeaveRequests,
  submitLeaveRequest,
  approveLeave,
  rejectLeave,
  earlyReturn,
  getLeaveBalances,
  getMyLeaveBalances,
  getLeaveCalendar,
} from './leave.controller.js';

const router = Router();

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const submitLeaveSchema = z.object({
  leave_type_id: z.string().uuid(),
  start_date: z.string().min(8),
  end_date: z.string().min(8),
  reason: z.string().optional().nullable(),
});

const rejectSchema = z.object({
  reason: z.string().min(2),
});

router.use(verifyToken);

router.get('/', requirePermission('leave:read'), getLeaveRequests);
router.get('/mine', getMyLeaveRequests);
router.post('/', validate(submitLeaveSchema), submitLeaveRequest);
router.patch('/:id/approve', requirePermission('leave:approve'), validateParams(uuidParamSchema), approveLeave);
router.patch(
  '/:id/reject',
  requirePermission('leave:approve'),
  validateParams(uuidParamSchema),
  validate(rejectSchema),
  rejectLeave
);
router.patch('/:id/early-return', requirePermission('leave:approve'), validateParams(uuidParamSchema), earlyReturn);
router.get('/balances', requirePermission('leave:read'), getLeaveBalances);
router.get('/balances/mine', getMyLeaveBalances);
router.get('/calendar', requirePermission('leave:read'), getLeaveCalendar);

export default router;
