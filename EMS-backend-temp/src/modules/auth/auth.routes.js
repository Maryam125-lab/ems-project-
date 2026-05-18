import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import pool from '../../config/db.js';
import bcrypt from 'bcrypt';
import { sendSuccess } from '../../utils/respond.js';
import { AppError } from '../../utils/errors.js';
import {
  login,
  logout,
  session,
  changePassword,
  loginSchema,
  changePasswordSchema,
} from './auth.controller.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/logout', verifyToken, logout);
router.get('/session', (req, res, next) => {
    console.log('[DEBUG] Session route hit, headers:', req.headers.authorization ? 'has auth header' : 'no auth header', 'cookies:', Object.keys(req.cookies || {}));
    next();
}, verifyToken, session);
router.post('/change-password', verifyToken, validate(changePasswordSchema), changePassword);

// Employee Self-Registration: Employee uses their Employee ID to create a login
router.post('/register', async (req, res, next) => {
  try {
    const { employee_id, email, password } = req.body;

    if (!employee_id || !email || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'employee_id, email and password are required.');
    }

    if (password.length < 8) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.');
    }

    // Check if employee exists in employee_info
    const empCheck = await pool.query(
      `SELECT employee_id FROM public.employee_info WHERE employee_id = $1`,
      [employee_id.toUpperCase()]
    );
    if (empCheck.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Employee ID not found. Please check your Employee ID.');
    }

    // Check if user already has an account with this employee_id
    const userCheck = await pool.query(
      `SELECT id, email FROM public.users WHERE employee_id = $1`,
      [employee_id.toUpperCase()]
    );
    if (userCheck.rowCount > 0) {
      const existing = userCheck.rows[0];
      // If the email is the old auto-generated one, allow update
      if (!existing.email.includes('@esspl.com.pk') && existing.email !== email) {
        throw new AppError(409, 'ALREADY_REGISTERED', 'An account already exists for this Employee ID.');
      }
    }

    // Check email not already taken by another user
    const emailCheck = await pool.query(
      `SELECT id FROM public.users WHERE email = $1 AND employee_id != $2`,
      [email, employee_id.toUpperCase()]
    );
    if (emailCheck.rowCount > 0) {
      throw new AppError(409, 'EMAIL_TAKEN', 'This email is already registered to another account.');
    }

    // Get employee role
    const roleRes = await pool.query(`SELECT id FROM public.roles WHERE role_name = 'employee' LIMIT 1`);
    const roleId = roleRes.rows[0]?.id;
    if (!roleId) throw new AppError(500, 'CONFIG_ERROR', 'Employee role not configured.');

    const hashedPassword = await bcrypt.hash(password, 10);

    if (userCheck.rowCount > 0) {
      // Update existing record
      await pool.query(
        `UPDATE public.users SET email=$1, password=$2, must_change_password=false, updated_at=now() WHERE employee_id=$3`,
        [email, hashedPassword, employee_id.toUpperCase()]
      );
    } else {
      // Insert new user
      await pool.query(
        `INSERT INTO public.users (email, password, role_id, employee_id, must_change_password) VALUES ($1, $2, $3, $4, false)`,
        [email, hashedPassword, roleId, employee_id.toUpperCase()]
      );
    }

    return sendSuccess(res, { message: 'Account created successfully. You can now log in.' }, 201);
  } catch (error) {
    return next(error);
  }
});

export default router;

