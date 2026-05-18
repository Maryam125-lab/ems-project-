import { z } from 'zod';
import pool from '../../config/db.js';
import { sendSuccess } from '../../utils/respond.js';
import * as directoryService from './directory.service.js';

const createSchema = z.object({
  employee_id: z.string().min(3).max(10).optional().nullable(),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone_internal: z.string().optional().nullable(),
  phone_mobile: z.string().optional().nullable(),
  phone_mobile_public: z.boolean().optional(),
  role_title: z.string().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  availability: z.enum(['available', 'busy', 'out_of_office']).optional().nullable(),
});

const updateSchema = createSchema.partial();

async function getCallerRoleName(roleId) {
  const role = await pool.query(`SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`, [roleId]);
  return role.rows[0]?.role_name || 'employee';
}

export async function getDirectory(req, res, next) {
  try {
    const callerRole = await getCallerRoleName(req.user.role_id);
    const result = await directoryService.getDirectory({
      branch_id: req.query.branch_id,
      department_id: req.query.department_id,
      search: req.query.search,
      callerRole,
    });
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function createEntry(req, res, next) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          details: parsed.error.issues,
        },
      });
    }

    const result = await directoryService.createEntry(parsed.data, req.user.user_id);
    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateEntry(req, res, next) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          details: parsed.error.issues,
        },
      });
    }

    const result = await directoryService.updateEntry(req.params.id, parsed.data, req.user.user_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}
