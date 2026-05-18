import pool from '../config/db.js';

/**
 * Logs an activity to public.audit_logs table.
 * 
 * @param {Object} params
 * @param {string} params.userId - The ID of the user performing the action
 * @param {string} params.action - 'INSERT', 'UPDATE', 'DELETE', or 'LOGIN'
 * @param {string} params.tableName - The table being affected (e.g., 'employee_info', 'leave_requests')
 * @param {string} [params.recordId] - The ID of the modified record (optional)
 * @param {string} params.reason - A descriptive log message
 */
export async function logAudit({ userId, action, tableName, recordId, reason }) {
    try {
        // Fallback to a valid random uuid if recordId is missing or invalid
        const validRecordId = (recordId && recordId.length === 36) ? recordId : null;
        
        await pool.query(`
            INSERT INTO public.audit_logs (
                id,
                user_id,
                action,
                table_name,
                record_id,
                reason,
                created_at
            )
            VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                $5,
                CURRENT_TIMESTAMP
            )
        `, [
            userId,
            action,
            tableName,
            validRecordId,
            reason
        ]);
        console.log(`[AUDIT LOG] ${action} on ${tableName} logged successfully: ${reason}`);
    } catch (e) {
        console.error('[AUDIT LOG ERROR]', e);
    }
}
