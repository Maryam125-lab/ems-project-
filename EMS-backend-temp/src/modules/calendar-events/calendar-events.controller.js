import { z } from 'zod';
import { sendSuccess } from '../../utils/respond.js';
import * as calendarEventsService from './calendar-events.service.js';

const eventBodySchema = z.object({
  type: z.string().min(1),
  date: z.string().min(8),
  title: z.string().min(1),
  visibility: z.enum(['all', 'hr', 'employee']),
});

const eventPatchSchema = eventBodySchema.partial();

export async function getCalendarEvents(req, res, next) {
  try {
    const result = await calendarEventsService.getCalendarEvents({
      from: req.query.from,
      to: req.query.to,
      roleId: req.user.role_id,
    });
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function createCalendarEvent(req, res, next) {
  try {
    const parsed = eventBodySchema.safeParse(req.body);
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

    const result = await calendarEventsService.createCalendarEvent(parsed.data, req.user.user_id);
    return sendSuccess(res, result, 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateCalendarEvent(req, res, next) {
  try {
    const parsed = eventPatchSchema.safeParse(req.body);
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

    const result = await calendarEventsService.updateCalendarEvent(
      req.params.id,
      parsed.data,
      req.user.user_id
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}
