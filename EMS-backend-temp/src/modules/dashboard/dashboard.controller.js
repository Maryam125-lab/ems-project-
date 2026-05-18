import { sendSuccess } from '../../utils/respond.js';
import { AppError } from '../../utils/errors.js';
import * as dashboardService from './dashboard.service.js';

export async function getHRMetrics(req, res, next) {
  try {
    const range = req.query.range === '12m' ? '12m' : '6m';
    const data = await dashboardService.getHRMetrics(range);
    return sendSuccess(res, data, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployeeSelfMetrics(req, res, next) {
  try {
    const data = await dashboardService.getEmployeeSelfMetrics(req.user.employee_id);
    return sendSuccess(res, data, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getPendingActions(req, res, next) {
  try {
    const data = await dashboardService.getPendingActions();
    return sendSuccess(res, data, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getUrgentAlerts(req, res, next) {
  try {
    const days = Number(req.query.days || 30);
    const data = await dashboardService.getUrgentAlerts(days);
    return sendSuccess(res, data, 200);
  } catch (error) {
    return next(error);
  }
}
