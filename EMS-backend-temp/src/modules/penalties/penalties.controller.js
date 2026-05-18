import { z } from 'zod';
import { sendSuccess } from '../../utils/respond.js';
import { AppError } from '../../utils/errors.js';
import * as penaltiesService from './penalties.service.js';

const ruleSchema = z.object({
  name: z.string().min(1),
  amount_pkr: z.number().nonnegative(),
  type: z.enum(['flat', 'percentage']),
});

const rulePatchSchema = ruleSchema.partial().extend({ is_active: z.boolean().optional() });

const proposeSchema = z.object({
  employee_id: z.string().min(3).max(10),
  rule_id: z.string().uuid(),
  date: z.string().min(8),
  reason: z.string().optional().nullable(),
});

const rejectSchema = z.object({ reviewNote: z.string().min(1) });

export async function getPenaltyRules(req, res, next) {
  try {
    const roleName = await penaltiesService.roleInfo(req.user.role_id);
    const isSuperAdmin = roleName === 'super_admin';
    const result = await penaltiesService.getPenaltyRules(isSuperAdmin);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function createPenaltyRule(req, res, next) {
  try {
    const parsed = ruleSchema.safeParse(req.body);
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

    const result = await penaltiesService.createPenaltyRule({
      ...parsed.data,
      created_by: req.user.user_id,
    });
    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updatePenaltyRule(req, res, next) {
  try {
    const parsed = rulePatchSchema.safeParse(req.body);
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

    const result = await penaltiesService.updatePenaltyRule(req.params.id, parsed.data);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getPenalties(req, res, next) {
  try {
    const result = await penaltiesService.listPenalties({
      status: req.query.status,
      employee_id: req.query.employee_id,
    });
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getMyPenalties(req, res, next) {
  try {
    const result = await penaltiesService.listMyPenalties(req.user.employee_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function proposePenalty(req, res, next) {
  try {
    const parsed = proposeSchema.safeParse(req.body);
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

    const result = await penaltiesService.proposePenalty({
      ...parsed.data,
      proposed_by: req.user.user_id,
    });

    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function approvePenalty(req, res, next) {
  try {
    const result = await penaltiesService.approvePenalty(req.params.id, req.user.user_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function rejectPenalty(req, res, next) {
  try {
    const parsed = rejectSchema.safeParse(req.body);
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

    const result = await penaltiesService.rejectPenalty(req.params.id, req.user.user_id, parsed.data.reviewNote);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function acknowledgePenalty(req, res, next) {
  try {
    const result = await penaltiesService.acknowledgeEmployeePenalty(
      req.params.id,
      req.user.employee_id
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}
