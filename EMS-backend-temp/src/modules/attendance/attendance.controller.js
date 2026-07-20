import { sendSuccess } from '../../utils/respond.js';
import * as attendanceService from './attendance.service.js';

export async function getAttendanceSheet(req, res, next) {
  try {
    const result = await attendanceService.getAttendanceSheet(
      req.query.date,
      req.query.location_id,
      req.user.employee_id,
      req.user.role_id
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function saveAttendanceSheet(req, res, next) {
  try {
    const result = await attendanceService.saveAttendanceSheet(
      req.body.date,
      req.body.location_id,
      req.body.rows,
      req.user.user_id
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function acknowledgeAttendance(req, res, next) {
  try {
    const result = await attendanceService.acknowledgeAttendance(
      req.params.id,
      req.user.employee_id
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function submitSheetToHO(req, res, next) {
  try {
    const result = await attendanceService.submitSheetToHO(
      req.body.date,
      req.body.location_id,
      req.user.user_id
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function requestUnlock(req, res, next) {
  try {
    const result = await attendanceService.requestUnlock(
      req.body.date,
      req.body.location_id,
      req.body.reason,
      req.user.user_id
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function approveUnlock(req, res, next) {
  try {
    const result = await attendanceService.approveUnlock(
      req.body.date,
      req.body.location_id,
      req.user.user_id,
      req.body.unlock_reason
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getMonthlyReport(req, res, next) {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;

    const result = await attendanceService.getMonthlyReport(
      year,
      month,
      req.query.location_id,
      {
        employee_id: req.query.employee_id,
        department_id: req.query.department_id,
      }
    );
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployeeAttendanceLog(req, res, next) {
  try {
    const result = await attendanceService.getEmployeeAttendanceLog(req.params.id);
    return sendSuccess(res, result, 200);
  } catch (error) {
    return next(error);
  }
}
