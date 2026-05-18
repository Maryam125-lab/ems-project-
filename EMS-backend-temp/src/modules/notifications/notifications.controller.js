import { z } from 'zod';
import { sendSuccess } from '../../utils/respond.js';
import * as notificationsService from './notifications.service.js';

const createNotificationSchema = z
  .object({
    user_id: z.string().uuid().optional().nullable(),
    role: z.string().min(1).optional().nullable(),
    type: z.string().min(1),
    message: z.string().min(1),
  })
  .refine((payload) => Boolean(payload.user_id || payload.role), {
    message: 'Either user_id or role is required.',
    path: ['user_id'],
  });

export async function getMyNotifications(req, res, next) {
  try {
    const result = await notificationsService.getMyNotifications(req.user.user_id, req.user.role_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function markRead(req, res, next) {
  try {
    const result = await notificationsService.markRead(req.params.id, req.user.user_id, req.user.role_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function createNotification(req, res, next) {
  try {
    const parsed = createNotificationSchema.safeParse(req.body);
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

    const result = await notificationsService.createNotification({
      ...parsed.data,
      created_by: req.user.user_id,
    });
    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}
