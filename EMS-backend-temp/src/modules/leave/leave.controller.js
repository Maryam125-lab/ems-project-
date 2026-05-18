import { sendSuccess } from '../../utils/respond.js';
import * as leaveService from './leave.service.js';

export async function getLeaveRequests(req, res, next) {
  try {
    const result = await leaveService.getLeaveRequests({
      status: req.query.status,
      employee_id: req.query.employee_id,
      department_id: req.query.department_id,
    });
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getMyLeaveRequests(req, res, next) {
  try {
    const result = await leaveService.getMyLeaveRequests(req.user.employee_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function submitLeaveRequest(req, res, next) {
  try {
    const result = await leaveService.submitLeaveRequest(req.user.employee_id, {
      ...req.body,
      created_by: req.user.user_id,
    });
    return sendSuccess(res, result, 201);
  } catch (error) {
    if (error.code === 'CAPACITY_EXCEEDED' && error.details) {
      return res.status(409).json({ success: false, error: { code: error.code, message: error.message, ...error.details } });
    }
    return next(error);
  }
}

export async function approveLeave(req, res, next) {
  try {
    const result = await leaveService.approveLeave(req.params.id, req.user.user_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function rejectLeave(req, res, next) {
  try {
    const result = await leaveService.rejectLeave(req.params.id, req.user.user_id, req.body.reason);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function earlyReturn(req, res, next) {
  try {
    const result = await leaveService.earlyReturn(req.params.id, req.user.user_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getLeaveBalances(req, res, next) {
  try {
    const result = await leaveService.getLeaveBalancesAll({
      department_id: req.query.department_id,
      location_id: req.query.location_id,
      shift_id: req.query.shift_id,
      year: req.query.year ? Number(req.query.year) : undefined,
    });
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getMyLeaveBalances(req, res, next) {
  try {
    const result = await leaveService.getLeaveBalances(req.user.employee_id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getLeaveCalendar(req, res, next) {
  try {
    const result = await leaveService.getLeaveCalendar({
      month: Number(req.query.month || new Date().getMonth() + 1),
      year: Number(req.query.year || new Date().getFullYear()),
      department_id: req.query.department_id,
      branch_id: req.query.branch_id,
    });
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}
