import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

async function getRoleName(roleId) {
  const result = await pool.query(`SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`, [roleId]);
  return result.rows[0]?.role_name || null;
}

export async function getPenaltyRules(isSuperAdmin) {
  const result = await pool.query(
    `
      SELECT *
      FROM public.penalty_rules
      WHERE ($1::boolean = true OR is_active = true)
      ORDER BY created_at DESC
    `,
    [isSuperAdmin]
  );

  return result.rows;
}

export async function createPenaltyRule({ name, amount_pkr, type, created_by }) {
  if (!['flat', 'percentage'].includes(type)) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid penalty rule type.');
  }

  const result = await pool.query(
    `
      INSERT INTO public.penalty_rules (name, amount_pkr, type, created_by, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `,
    [name, amount_pkr, type, created_by]
  );

  return result.rows[0];
}

export async function updatePenaltyRule(id, data) {
  const fields = [];
  const values = [];

  for (const key of ['name', 'amount_pkr', 'type', 'is_active']) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      values.push(data[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) {
    const existing = await pool.query(`SELECT * FROM public.penalty_rules WHERE id = $1`, [id]);
    if (existing.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Penalty rule not found.');
    }
    return existing.rows[0];
  }

  values.push(id);

  const result = await pool.query(
    `
      UPDATE public.penalty_rules
      SET ${fields.join(', ')}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Penalty rule not found.');
  }

  return result.rows[0];
}

export async function proposePenalty({ employee_id, rule_id, date, reason, remarks, proposed_by }) {
  const finalReason = reason || remarks || null;
  const rule = await pool.query(
    `SELECT * FROM public.penalty_rules WHERE id = $1 AND is_active = true LIMIT 1`,
    [rule_id]
  );

  if (rule.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Penalty rule not found or inactive.');
  }

  const created = await pool.query(
    `
      INSERT INTO public.employee_penalties (
        employee_id,
        rule_id,
        date,
        reason,
        status,
        proposed_by,
        submitted_to_ho_at
      )
      VALUES ($1, $2, $3, $4, 'pending', $5, now())
      RETURNING *
    `,
    [employee_id, rule_id, date, finalReason, proposed_by]
  );

  const employee = await pool.query(
    `SELECT name FROM public.employee_info WHERE employee_id = $1 LIMIT 1`,
    [employee_id]
  );

  await pool.query(
    `
      INSERT INTO public.notifications (user_id, role, type, message, created_by)
      VALUES
      (NULL, 'super_admin', 'penalty_proposed', $1, $2),
      (NULL, 'hr', 'penalty_proposed', $1, $2)
    `,
    [
      `New penalty proposed for ${employee.rows[0]?.name || employee_id} by Branch HR. Rule: ${rule.rows[0].name}. Awaiting review.`,
      proposed_by,
    ]
  );

  return created.rows[0];
}

export async function approvePenalty(penaltyId, reviewedByUserId) {
  const result = await pool.query(
    `
      UPDATE public.employee_penalties
      SET status = 'approved',
          reviewed_by = $2,
          reviewed_at = now(),
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [penaltyId, reviewedByUserId]
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Penalty not found.');
  }

  await pool.query(
    `
      INSERT INTO public.notifications (user_id, role, type, message, created_by)
      SELECT u.id, NULL, 'penalty_approved', $2, $3
      FROM public.users u
      WHERE u.employee_id = $1
    `,
    [result.rows[0].employee_id, 'Your penalty has been approved.', reviewedByUserId]
  );

  return result.rows[0];
}

export async function rejectPenalty(penaltyId, reviewedByUserId, reviewNote) {
  const result = await pool.query(
    `
      UPDATE public.employee_penalties
      SET status = 'rejected',
          reviewed_by = $2,
          reviewed_at = now(),
          review_note = $3,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [penaltyId, reviewedByUserId, reviewNote || null]
  );

  if (result.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Penalty not found.');
  }

  if (result.rows[0].proposed_by) {
    await pool.query(
      `
        INSERT INTO public.notifications (user_id, role, type, message, created_by)
        VALUES ($1, NULL, 'penalty_rejected', $2, $3)
      `,
      [result.rows[0].proposed_by, 'A proposed penalty was rejected.', reviewedByUserId]
    );
  }

  return result.rows[0];
}

export async function acknowledgeEmployeePenalty(penaltyId, employeeId) {
  const check = await pool.query(
    `SELECT * FROM public.employee_penalties WHERE id = $1 LIMIT 1`,
    [penaltyId]
  );

  if (check.rowCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Penalty not found.');
  }

  const penalty = check.rows[0];

  if (penalty.employee_id !== employeeId) {
    throw new AppError(403, 'FORBIDDEN', 'You can acknowledge only your own penalty.');
  }

  if (penalty.status !== 'approved') {
    throw new AppError(409, 'INVALID_STATE', 'Penalty must be approved before acknowledgement.');
  }

  const updated = await pool.query(
    `
      UPDATE public.employee_penalties
      SET employee_ack = true,
          employee_acked_at = now(),
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [penaltyId]
  );

  return updated.rows[0];
}

export async function listPenalties(filters = {}) {
  const params = [];
  const where = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`ep.status = $${params.length}`);
  }

  if (filters.employee_id) {
    params.push(filters.employee_id);
    where.push(`ep.employee_id = $${params.length}`);
  }

  const result = await pool.query(
    `
      SELECT
        ep.*,
        ep.reason as remarks,
        pr.name AS penalty_type,
        pr.amount_pkr AS amount,
        pr.type,
        ei.name AS employee_name
      FROM public.employee_penalties ep
      JOIN public.penalty_rules pr ON pr.id = ep.rule_id
      JOIN public.employee_info ei ON ei.employee_id = ep.employee_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ep.created_at DESC
    `,
    params
  );

  return result.rows;
}

export async function listMyPenalties(employeeId) {
  const result = await pool.query(
    `
      SELECT
        ep.*,
        pr.name AS rule_name,
        pr.amount_pkr,
        pr.type,
        proposer_emp.name AS proposed_by_name,
        reviewer_emp.name AS reviewed_by_name
      FROM public.employee_penalties ep
      JOIN public.penalty_rules pr ON pr.id = ep.rule_id
      LEFT JOIN public.users proposer_user ON proposer_user.id = ep.proposed_by
      LEFT JOIN public.employee_info proposer_emp ON proposer_emp.employee_id = proposer_user.employee_id
      LEFT JOIN public.users reviewer_user ON reviewer_user.id = ep.reviewed_by
      LEFT JOIN public.employee_info reviewer_emp ON reviewer_emp.employee_id = reviewer_user.employee_id
      WHERE ep.employee_id = $1
      ORDER BY ep.created_at DESC
    `,
    [employeeId]
  );

  return result.rows;
}

export async function roleInfo(roleId) {
  return getRoleName(roleId);
}
