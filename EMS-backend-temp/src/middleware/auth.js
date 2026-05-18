import jwt from 'jsonwebtoken';
import { sendError } from '../utils/respond.js';

export function verifyToken(req, res, next) {
  // Check both cookie and Authorization header
  let token = req.cookies?.ems_jwt;
  let source = 'cookie';

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      source = 'header';
    }
  }

  console.log(`[AUTH DEBUG] Request to ${req.originalUrl} | Token found: ${!!token} | Source: ${source}`);

  if (!token) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required.', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      user_id: decoded.user_id,
      employee_id: decoded.employee_id,
      role_id: decoded.role_id,
      must_change_password: decoded.must_change_password,
    };

    const isChangePasswordRoute =
      req.method === 'POST' &&
      (req.path === '/change-password' ||
        req.originalUrl?.endsWith('/api/auth/change-password'));

    if (req.user.must_change_password === true && !isChangePasswordRoute) {
      return sendError(
        res,
        'MUST_CHANGE_PASSWORD',
        'Password must be changed before continuing.',
        403
      );
    }

    return next();
  } catch {
    return sendError(res, 'UNAUTHORIZED', 'Invalid or expired token.', 401);
  }
}

verifyToken.__auth = true;
