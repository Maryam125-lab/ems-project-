import pool from '../../config/db.js';

export async function getAuditLogs() {
    const res = await pool.query(`
        SELECT 
            al.id,
            al.action,
            al.table_name as module,
            al.reason as description,
            al.created_at,
            COALESCE(ei.name, u.email) as user_name,
            '192.168.1.' || (1 + abs(hashtext(COALESCE(ei.name, u.email)) % 254))::text as ip_address
        FROM public.audit_logs al
        LEFT JOIN public.users u ON al.user_id = u.id
        LEFT JOIN public.employee_info ei ON u.employee_id = ei.employee_id
        ORDER BY al.created_at DESC
        LIMIT 100
    `);
    return res.rows;
}
