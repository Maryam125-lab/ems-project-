import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

const entityConfig = {
  departments: {
    table: 'departments',
    createFields: ['department_code', 'department_name', 'parent_department_id', 'is_active'],
    updateFields: ['department_code', 'department_name', 'parent_department_id', 'is_active'],
  },
  designations: {
    table: 'designations',
    createFields: ['title', 'is_active'],
    updateFields: ['title', 'is_active'],
  },
  'employment-types': {
    table: 'employment_types',
    createFields: ['type_name', 'is_active'],
    updateFields: ['type_name', 'is_active'],
  },
  'job-statuses': {
    table: 'job_statuses',
    createFields: ['status_name', 'is_active'],
    updateFields: ['status_name', 'is_active'],
  },
  'work-modes': {
    table: 'work_modes',
    createFields: ['mode_name', 'is_active'],
    updateFields: ['mode_name', 'is_active'],
  },
  'work-locations': {
    table: 'work_locations',
    createFields: ['location_name', 'is_active'],
    updateFields: ['location_name', 'is_active'],
  },
  shifts: {
    table: 'shifts',
    createFields: ['name', 'start_time', 'end_time', 'late_after_minutes', 'is_active'],
    updateFields: ['name', 'start_time', 'end_time', 'late_after_minutes', 'is_active'],
  },
  'leave-types': {
    table: 'leave_types',
    createFields: ['name', 'is_active'],
    updateFields: ['name', 'is_active'],
  },
  'leave-policies': {
    table: 'leave_policies',
    createFields: ['department_id', 'leave_type_id', 'days_allowed', 'year', 'is_active'],
    updateFields: ['department_id', 'leave_type_id', 'days_allowed', 'year', 'is_active'],
  },
  'leave-capacity': {
    table: 'leave_capacity_config',
    createFields: ['department_id', 'max_percent', 'is_active'],
    updateFields: ['department_id', 'max_percent', 'is_active'],
  },
  'penalty-rules': {
    table: 'penalty_rules',
    createFields: ['name', 'amount_pkr', 'type', 'is_active'],
    updateFields: ['name', 'amount_pkr', 'type', 'is_active'],
  },
};

function getEntityConfig(entity) {
  const config = entityConfig[entity];
  if (!config) {
    throw new AppError(404, 'NOT_FOUND', 'Config entity not found.');
  }
  return config;
}

function pickFields(payload, fields) {
  const out = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      out[field] = payload[field];
    }
  }
  return out;
}

export async function isSuperAdmin(roleId) {
  const result = await pool.query(
    `SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`,
    [roleId]
  );

  return result.rows[0]?.role_name === 'super_admin';
}

export async function getDepartments({ includeInactive = false } = {}) {
  const result = await pool.query(
    `
      SELECT *
      FROM public.departments
      WHERE ($1::boolean = true OR is_active = true)
      ORDER BY department_name ASC
    `,
    [includeInactive]
  );

  return result.rows;
}

export async function createDepartment({
  department_code,
  department_name,
  parent_department_id,
  is_active = true,
}) {
  const duplicate = await pool.query(
    `SELECT 1 FROM public.departments WHERE department_code = $1 LIMIT 1`,
    [department_code]
  );

  if (duplicate.rowCount > 0) {
    throw new AppError(409, 'CONFLICT', 'Department code already exists.');
  }

  const result = await pool.query(
    `
      INSERT INTO public.departments (
        department_code,
        department_name,
        parent_department_id,
        is_active
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [department_code, department_name, parent_department_id || null, is_active]
  );

  return result.rows[0];
}

export async function updateDepartment(id, data) {
  const updates = [];
  const params = [];
  const allowedFields = ['department_code', 'department_name', 'parent_department_id', 'is_active'];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      params.push(data[field]);
      updates.push(`${field} = $${params.length}`);
    }
  }

  if (updates.length === 0) {
    const existing = await pool.query(`SELECT * FROM public.departments WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Department not found.');
    }
    return existing.rows[0];
  }

  params.push(id);
  const result = await pool.query(
    `
      UPDATE public.departments
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${params.length}
      RETURNING *
    `,
    params
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Department not found.');
  }

  return result.rows[0];
}

export async function getEntityRecords(entity, { isSuperAdminCaller }) {
  if (entity === 'departments') {
    return getDepartments({ includeInactive: isSuperAdminCaller });
  }

  const { table } = getEntityConfig(entity);
  const result = await pool.query(
    `
      SELECT *
      FROM public.${table}
      WHERE ($1::boolean = true OR is_active = true)
      ORDER BY created_at DESC
    `,
    [isSuperAdminCaller]
  );

  return result.rows;
}

export async function createEntityRecord(entity, payload) {
  if (entity === 'departments') {
    return createDepartment(payload);
  }

  const { table, createFields } = getEntityConfig(entity);
  const data = pickFields(payload, createFields);

  const fields = Object.keys(data);
  const values = Object.values(data);

  if (fields.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'No fields provided for creation.');
  }

  const placeholders = fields.map((_, idx) => `$${idx + 1}`).join(', ');

  const result = await pool.query(
    `
      INSERT INTO public.${table} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `,
    values
  );

  return result.rows[0];
}

export async function updateEntityRecord(entity, id, payload) {
  if (entity === 'departments') {
    return updateDepartment(id, payload);
  }

  const { table, updateFields } = getEntityConfig(entity);
  const data = pickFields(payload, updateFields);

  const fields = Object.keys(data);
  if (fields.length === 0) {
    const existing = await pool.query(`SELECT * FROM public.${table} WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found.');
    }
    return existing.rows[0];
  }

  const values = Object.values(data);
  const updates = fields.map((field, idx) => `${field} = $${idx + 1}`);

  values.push(id);

  const result = await pool.query(
    `
      UPDATE public.${table}
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Record not found.');
  }

  return result.rows[0];
}
