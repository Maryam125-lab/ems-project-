import { z } from 'zod';
import { sendSuccess } from '../../utils/respond.js';
import { AppError } from '../../utils/errors.js';
import {
  getEntityRecords,
  createEntityRecord,
  updateEntityRecord,
  isSuperAdmin,
} from './config.service.js';

const idSchema = z.object({ id: z.string().uuid() });

const entitySchemaMap = {
  departments: z.object({
    department_code: z.string().min(1).optional(),
    department_name: z.string().min(1).optional(),
    parent_department_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
  }),
  designations: z.object({ title: z.string().min(1), is_active: z.boolean().optional() }),
  'employment-types': z.object({ type_name: z.string().min(1), is_active: z.boolean().optional() }),
  'job-statuses': z.object({ status_name: z.string().min(1), is_active: z.boolean().optional() }),
  'work-modes': z.object({ mode_name: z.string().min(1), is_active: z.boolean().optional() }),
  'work-locations': z.object({ location_name: z.string().min(1), is_active: z.boolean().optional() }),
  shifts: z.object({
    name: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    late_after_minutes: z.number().int().nonnegative(),
    is_active: z.boolean().optional(),
  }),
  'leave-types': z.object({ name: z.string().min(1), is_active: z.boolean().optional() }),
  'leave-policies': z.object({
    department_id: z.string().uuid(),
    leave_type_id: z.string().uuid(),
    days_allowed: z.number().int().nonnegative(),
    year: z.number().int().min(2000),
    is_active: z.boolean().optional(),
  }),
  'leave-capacity': z.object({
    department_id: z.string().uuid(),
    max_percent: z.number().int().min(1).max(100),
    is_active: z.boolean().optional(),
  }),
  'penalty-rules': z.object({
    name: z.string().min(1),
    amount_pkr: z.number().nonnegative(),
    type: z.enum(['flat', 'percentage']),
    is_active: z.boolean().optional(),
  }),
};

function getEntitySchema(entity, isPatch = false) {
  const schema = entitySchemaMap[entity];
  if (!schema) {
    throw new AppError(404, 'NOT_FOUND', 'Config entity not found.');
  }
  return isPatch ? schema.partial() : schema;
}

export async function getConfigEntity(req, res, next) {
  try {
    const superAdmin = await isSuperAdmin(req.user.role_id);
    const records = await getEntityRecords(req.params.entity, {
      isSuperAdminCaller: superAdmin,
    });
    return sendSuccess(res, records, 200);
  } catch (error) {
    return next(error);
  }
}

export async function createConfigEntity(req, res, next) {
  try {
    const schema = getEntitySchema(req.params.entity, false);
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          details: parse.error.issues,
        },
      });
    }

    const record = await createEntityRecord(req.params.entity, parse.data);
    return sendSuccess(res, record, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateConfigEntity(req, res, next) {
  try {
    const idParse = idSchema.safeParse(req.params);
    if (!idParse.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          details: idParse.error.issues,
        },
      });
    }

    const schema = getEntitySchema(req.params.entity, true);
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          details: parse.error.issues,
        },
      });
    }

    const record = await updateEntityRecord(req.params.entity, req.params.id, parse.data);
    return sendSuccess(res, record, 200);
  } catch (error) {
    return next(error);
  }
}
