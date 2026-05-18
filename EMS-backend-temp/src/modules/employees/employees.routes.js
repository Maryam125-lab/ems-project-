import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission, requirePermissionOrSelf } from '../../middleware/require-permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updatePersonalInfo,
  updateJobInfo,
  updateExtraInfo,
  resendCredentials,
} from './employees.controller.js';
import {
  createEmployeeSchema,
  updatePersonalInfoSchema,
  updateJobInfoSchema,
  updateExtraInfoSchema,
} from './employees.schema.js';

const router = Router();

router.use(verifyToken);

router.get('/', requirePermission('employees:read'), getEmployees);
router.get('/:employeeId', requirePermissionOrSelf('employees:read'), getEmployeeById);
router.post('/', requirePermission('employees:write'), validate(createEmployeeSchema), createEmployee);
router.patch(
  '/:employeeId/personal',
  requirePermission('employees:write'),
  validate(updatePersonalInfoSchema),
  updatePersonalInfo
);
router.patch(
  '/:employeeId/job',
  requirePermission('employees:write'),
  validate(updateJobInfoSchema),
  updateJobInfo
);
router.patch(
  '/:employeeId/extra',
  requirePermission('employees:write'),
  validate(updateExtraInfoSchema),
  updateExtraInfo
);
router.post(
  '/:employeeId/resend-credentials',
  requirePermission('employees:write'),
  resendCredentials
);

export default router;
