import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

async function getRoleNameByRoleId(roleId) {
  const result = await pool.query(
    `SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`,
    [roleId]
  );
  return result.rows[0]?.role_name || null;
}

export async function getMyNotifications(userId, roleId) {
  const userRole = await getRoleNameByRoleId(roleId);

  const notifications = await pool.query(
    `
      SELECT *
      FROM public.notifications
      WHERE user_id = $1
         OR (role IS NOT NULL AND role = $2)
      ORDER BY created_at DESC
    `,
    [userId, userRole]
  );

  const unread = await pool.query(
    `
      SELECT COUNT(*)::int AS unread_count
      FROM public.notifications
      WHERE is_read = false
        AND (user_id = $1 OR (role IS NOT NULL AND role = $2))
    `,
    [userId, userRole]
  );

  return {
    notifications: notifications.rows,
    unread_count: unread.rows[0]?.unread_count || 0,
  };
}

export async function markRead(notificationId, userId, roleId) {
  const userRole = await getRoleNameByRoleId(roleId);

  const notificationResult = await pool.query(
    `
      SELECT *
      FROM public.notifications
      WHERE id = $1
      LIMIT 1
    `,
    [notificationId]
  );

  if (notificationResult.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  }

  const notification = notificationResult.rows[0];
  const ownsByUser = notification.user_id === userId;
  const ownsByRole = notification.role && notification.role === userRole;

  if (!ownsByUser && !ownsByRole) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot modify this notification.');
  }

  const updated = await pool.query(
    `
      UPDATE public.notifications
      SET is_read = true,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [notificationId]
  );

  return updated.rows[0];
}

export async function createNotification({ user_id, role, type, message, created_by }) {
  if (!user_id && !role) {
    throw new AppError(400, 'BAD_REQUEST', 'Either user_id or role is required.');
  }

  const result = await pool.query(
    `
      INSERT INTO public.notifications (user_id, role, type, message, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [user_id || null, role || null, type, message, created_by || null]
  );

  return result.rows[0];
}
