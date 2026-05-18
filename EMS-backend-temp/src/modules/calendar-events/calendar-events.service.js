import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

async function getRoleName(roleId) {
  const result = await pool.query(
    `SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`,
    [roleId]
  );
  return result.rows[0]?.role_name || null;
}

export async function getCalendarEvents({ from, to, roleId }) {
  const roleName = await getRoleName(roleId);

  const filters = ['date >= $1', 'date <= $2'];
  const params = [from, to];

  if (roleName === 'employee') {
    filters.push(`visibility IN ('all', 'employee')`);
  }

  const result = await pool.query(
    `
      SELECT *
      FROM public.calendar_events
      WHERE ${filters.join(' AND ')}
      ORDER BY date ASC, created_at DESC
    `,
    params
  );

  return result.rows;
}

export async function createCalendarEvent(payload, userId) {
  const result = await pool.query(
    `
      INSERT INTO public.calendar_events (type, date, title, visibility, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING *
    `,
    [payload.type, payload.date, payload.title, payload.visibility, userId]
  );

  return result.rows[0];
}

export async function updateCalendarEvent(id, payload, userId) {
  const fields = [];
  const values = [];

  for (const key of ['type', 'date', 'title', 'visibility']) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      values.push(payload[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) {
    const existing = await pool.query(`SELECT * FROM public.calendar_events WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Calendar event not found.');
    }
    return existing.rows[0];
  }

  values.push(userId);
  values.push(id);

  const result = await pool.query(
    `
      UPDATE public.calendar_events
      SET ${fields.join(', ')}, updated_by = $${values.length - 1}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Calendar event not found.');
  }

  return result.rows[0];
}
