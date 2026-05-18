import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

export async function getDirectory({ branch_id, department_id, search, callerRole }) {
  const params = [];
  const where = [];

  if (branch_id) {
    params.push(branch_id);
    where.push(`de.branch_id = $${params.length}`);
  }

  if (department_id) {
    params.push(department_id);
    where.push(`de.department_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(de.name ILIKE $${params.length} OR de.email ILIKE $${params.length} OR de.employee_id ILIKE $${params.length})`);
  }

  const rows = await pool.query(
    `
      SELECT
        de.id,
        de.employee_id,
        de.name,
        de.email,
        de.phone_internal,
        CASE
          WHEN $${params.length + 1} = 'employee' AND de.phone_mobile_public = false THEN NULL
          ELSE de.phone_mobile
        END AS phone_mobile,
        de.phone_mobile_public,
        de.role_title,
        de.department_id,
        d.department_name,
        de.branch_id,
        wl.location_name AS branch_name,
        de.availability,
        de.created_at,
        de.updated_at
      FROM public.directory_entries de
      LEFT JOIN public.departments d ON d.id = de.department_id
      LEFT JOIN public.work_locations wl ON wl.id = de.branch_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY de.name ASC
    `,
    [...params, callerRole]
  );

  return rows.rows;
}

export async function createEntry(data, createdBy) {
  const result = await pool.query(
    `
      INSERT INTO public.directory_entries (
        employee_id,
        name,
        email,
        phone_internal,
        phone_mobile,
        phone_mobile_public,
        role_title,
        department_id,
        branch_id,
        availability,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      data.employee_id || null,
      data.name,
      data.email || null,
      data.phone_internal || null,
      data.phone_mobile || null,
      data.phone_mobile_public ?? false,
      data.role_title || null,
      data.department_id || null,
      data.branch_id || null,
      data.availability || null,
      createdBy,
    ]
  );

  return result.rows[0];
}

export async function updateEntry(id, data, updatedBy) {
  const fields = [];
  const values = [];

  for (const key of [
    'employee_id',
    'name',
    'email',
    'phone_internal',
    'phone_mobile',
    'phone_mobile_public',
    'role_title',
    'department_id',
    'branch_id',
    'availability',
  ]) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      values.push(data[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) {
    const existing = await pool.query(`SELECT * FROM public.directory_entries WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Directory entry not found.');
    }
    return existing.rows[0];
  }

  values.push(updatedBy);
  values.push(id);

  const result = await pool.query(
    `
      UPDATE public.directory_entries
      SET ${fields.join(', ')}, updated_at = now(), created_by = COALESCE(created_by, $${values.length - 1})
      WHERE id = $${values.length}
      RETURNING *
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Directory entry not found.');
  }

  return result.rows[0];
}

export async function autoPopulateFromEmployee(employeeId) {
  const source = await pool.query(
    `
      SELECT
        ei.employee_id,
        ei.name,
        u.email,
        ec.contact_1 AS phone_mobile,
        ji.department_id,
        ji.work_location_id AS branch_id,
        d.title AS role_title
      FROM public.employee_info ei
      LEFT JOIN public.users u ON u.employee_id = ei.employee_id
      LEFT JOIN public.emergency_contacts ec ON ec.employee_id = ei.employee_id
      LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
      LEFT JOIN public.designations d ON d.id = ji.designation_id
      WHERE ei.employee_id = $1
      LIMIT 1
    `,
    [employeeId]
  );


  if (source.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Employee not found for directory population.');
  }

  const emp = source.rows[0];

  const insert = await pool.query(
    `
      INSERT INTO public.directory_entries (
        employee_id,
        name,
        email,
        phone_mobile,
        phone_mobile_public,
        role_title,
        department_id,
        branch_id,
        availability
      )
      VALUES ($1, $2, $3, $4, false, $5, $6, $7, 'available')
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [
      emp.employee_id,
      emp.name,
      emp.email || null,
      emp.phone_mobile || null,
      emp.role_title || null,
      emp.department_id || null,
      emp.branch_id || null,
    ]
  );

  return insert.rows[0] || null;
}
