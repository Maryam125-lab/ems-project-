import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { validate, validateParams } from '../../middleware/validate.js';
import {
  getAttendanceSheet,
  saveAttendanceSheet,
  submitSheetToHO,
  requestUnlock,
  approveUnlock,
  acknowledgeAttendance,
  getMonthlyReport,
  getEmployeeAttendanceLog,
} from './attendance.controller.js';

const router = Router();

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const saveSheetSchema = z.object({
  date: z.string().min(8),
  location_id: z.string().uuid(),
  rows: z.array(
    z.object({
      employee_id: z.string().min(3).max(10),
      check_in: z.string().optional().nullable(),
      check_out: z.string().optional().nullable(),
      status: z.enum(['present', 'absent', 'late', 'half_day', 'on_leave']),
      notes: z.string().optional().nullable(),
      ack: z.boolean().optional(),
    })
  ),
});

const submitSchema = z.object({
  date: z.string().min(8),
  location_id: z.string().uuid(),
});

const requestUnlockSchema = z.object({
  date: z.string().min(8),
  location_id: z.string().uuid(),
  reason: z.string().min(3),
});

const approveUnlockSchema = z.object({
  date: z.string().min(8),
  location_id: z.string().uuid(),
  unlock_reason: z.string().min(3),
});

router.use(verifyToken);

router.get('/', requirePermission('attendance:read'), getAttendanceSheet);
router.put('/save', requirePermission('attendance:write'), validate(saveSheetSchema), saveAttendanceSheet);
router.post('/submit', requirePermission('attendance:submit_ho'), validate(submitSchema), submitSheetToHO);
router.post(
  '/unlock-request',
  requirePermission('attendance:write'),
  validate(requestUnlockSchema),
  requestUnlock
);
router.post(
  '/unlock-approve',
  requirePermission('attendance:unlock'),
  validate(approveUnlockSchema),
  approveUnlock
);
router.patch('/:id/ack', validateParams(uuidParamSchema), acknowledgeAttendance);
router.get('/report', requirePermission('attendance:read'), getMonthlyReport);
router.get('/employee/:id', requirePermission('attendance:read'), getEmployeeAttendanceLog);

export default router;
