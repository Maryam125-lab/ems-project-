import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { sendSuccess } from '../../utils/respond.js';
import * as authService from './auth.service.js';
import pool from '../../config/db.js';

const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z
    .string()
    .min(8)
    .regex(passwordPolicy, 'Password must contain upper, lower, digit, and symbol.'),
});

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

export async function login(req, res, next) {
  try {
    const user = await authService.login(req.body.email, req.body.password);

    const payload = {
      user_id: user.user_id,
      employee_id: user.employee_id,
      role_id: user.role_id,
      must_change_password: user.must_change_password,
    };

    const token = signToken(payload);

    res.cookie('ems_jwt', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    res.cookie('ems_csrf', randomUUID(), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    return sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          employee_id: user.employee_id,
          employee_name: user.employee_name,
          must_change_password: user.must_change_password,
        },
        token, // Return token for Bearer auth
      },
      200
    );
  } catch (error) {
    return next(error);
  }
}

export function logout(req, res) {
  res.clearCookie('ems_jwt', { path: '/' });
  res.clearCookie('ems_csrf', { path: '/' });
  return sendSuccess(res, null, 200);
}

export async function session(req, res) {
  const roleId = req.user.role_id;
  let roleName = 'employee';
  
  if (roleId) {
    const { rows } = await pool.query('SELECT role_name FROM public.roles WHERE id = $1', [roleId]);
    if (rows.length > 0) roleName = rows[0].role_name;
  }

  return sendSuccess(res, { ...req.user, role_name: roleName }, 200);
}

export async function changePassword(req, res, next) {
  try {
    await authService.changePassword(
      req.user.user_id,
      req.body.current_password,
      req.body.new_password
    );

    const newPayload = {
      user_id: req.user.user_id,
      employee_id: req.user.employee_id,
      role_id: req.user.role_id,
      must_change_password: false,
    };

    const token = signToken(newPayload);

    res.cookie('ems_jwt', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    return sendSuccess(res, { message: 'Password changed.' }, 200);
  } catch (error) {
    return next(error);
  }
}
