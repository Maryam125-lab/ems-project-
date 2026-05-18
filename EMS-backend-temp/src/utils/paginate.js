import pool from '../config/db.js';

export async function paginate(query, countQuery, params, page = 1, limit = 20) {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (normalizedPage - 1) * normalizedLimit;

  const dataResult = await pool.query(query, [...params, normalizedLimit, offset]);
  const countResult = await pool.query(countQuery, params);

  const total = Number(countResult.rows[0]?.total || 0);
  const pages = Math.max(Math.ceil(total / normalizedLimit), 1);

  return {
    data: dataResult.rows,
    meta: {
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      pages,
    },
  };
}
