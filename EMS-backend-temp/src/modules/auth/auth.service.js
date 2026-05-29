import bcrypt from 'bcrypt';
import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function generateTempPassword() {
  const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowers = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppers + lowers + digits + symbols;

  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];

  const passwordChars = [
    pick(uppers),
    pick(lowers),
    pick(digits),
    pick(symbols),
  ];

  while (passwordChars.length < 12) {
    passwordChars.push(pick(all));
  }

  for (let i = passwordChars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
}

export async function login(email, password) {
  const result = await pool.query(
    `
      SELECT u.id, u.email, u.employee_id, u.role_id, u.password, u.must_change_password, e.name as employee_name
      FROM public.users u
      LEFT JOIN public.employee_info e ON u.employee_id = e.employee_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  return {
    user_id: user.id,
    employee_id: user.employee_id,
    role_id: user.role_id,
    must_change_password: user.must_change_password,
    email: user.email,
    employee_name: user.employee_name,
    id: user.id,
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const result = await pool.query(
    `
      SELECT id, password
      FROM public.users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found.');
  }

  const currentMatches = await bcrypt.compare(currentPassword, user.password);
  if (!currentMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }

  if (currentPassword === newPassword) {
    throw new AppError(409, 'SAME_PASSWORD', 'New password must be different.');
  }

  const newHashedPassword = await hashPassword(newPassword);

  await pool.query(
    `
      UPDATE public.users
      SET password = $2,
          must_change_password = false,
          password_changed_at = now()
      WHERE id = $1
    `,
    [userId, newHashedPassword]
  );
}