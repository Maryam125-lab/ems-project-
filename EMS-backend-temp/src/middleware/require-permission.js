import pool from '../config/db.js';
import { sendError } from '../utils/respond.js';

const rolePermissionCache = new Map();
const roleNameCache = new Map();

async function getRoleName(roleId) {
  if (roleNameCache.has(roleId)) {
    return roleNameCache.get(roleId);
  }

  const result = await pool.query(
    `SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`,
    [roleId]
  );

  const roleName = result.rows[0]?.role_name || null;
  roleNameCache.set(roleId, roleName);
  return roleName;
}

async function getPermissionsForRole(roleId) {
  if (rolePermissionCache.has(roleId)) {
    return rolePermissionCache.get(roleId);
  }

  const result = await pool.query(
    `
      SELECT p.permission_key
      FROM public.role_permissions rp
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1
    `,
    [roleId]
  );

  const permissionSet = new Set(result.rows.map((row) => row.permission_key));
  rolePermissionCache.set(roleId, permissionSet);
  return permissionSet;
}

export function requirePermission(permissionKey) {
  const middleware = async (req, res, next) => {
    console.log(`[PERM DEBUG] requirePermission called for ${permissionKey}`);
    try {
      const roleId = req.user?.role_id;

      if (!roleId) {
        console.warn(`[PERM WARN] No role_id found for user ${req.user?.user_id}. Access denied to ${permissionKey}`);
        return sendError(res, 'FORBIDDEN', 'Insufficient permissions (no role assigned).', 403);
      }

      const roleName = await getRoleName(roleId);
      if (roleName === 'super_admin') {
        return next();
      }

      const permissions = await getPermissionsForRole(roleId);
      console.log(`[PERM DEBUG] User Role ID: ${roleId} | Required: ${permissionKey} | Has it: ${permissions.has(permissionKey)}`);
      
      if (!permissions.has(permissionKey)) {
        console.warn(`[PERM WARN] Access denied for user ${req.user?.user_id} to ${permissionKey}`);
        return sendError(res, 'FORBIDDEN', 'Insufficient permissions.', 403);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

  middleware.__perm = { mode: 'all', keys: [permissionKey] };
  return middleware;
}

export function requirePermissionOrSelf(permissionKey, paramName = 'employeeId') {
  const middleware = async (req, res, next) => {
    try {
      if (req.user?.employee_id && req.params[paramName] === req.user.employee_id) {
        return next();
      }
      
      const roleId = req.user?.role_id;
      if (!roleId) {
        return sendError(res, 'FORBIDDEN', 'Insufficient permissions.', 403);
      }

      const roleName = await getRoleName(roleId);
      if (roleName === 'super_admin') {
        return next();
      }

      const permissions = await getPermissionsForRole(roleId);
      if (!permissions.has(permissionKey)) {
        return sendError(res, 'FORBIDDEN', 'Insufficient permissions.', 403);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

  middleware.__perm = { mode: 'all', keys: [permissionKey] };
  return middleware;
}
