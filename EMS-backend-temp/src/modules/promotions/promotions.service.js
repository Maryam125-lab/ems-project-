import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { logAudit } from '../../utils/audit-logger.js';


export async function getPromotions() {
    const res = await pool.query(`
        SELECT 
            p.id,
            p.employee_id,
            p.effective_date,
            p.status,
            p.remarks,
            p.created_at,
            ei.name as employee_name, 
            COALESCE(fd.title, curr_d.title, 'None') as from_designation_title, 
            COALESCE(fd.title, curr_d.title, 'None') as from_designation,
            td.title as to_designation_title,
            td.title as to_designation,
            fdept.department_name as from_department, 
            COALESCE(tdept.department_name, fdept.department_name, curr_dept.department_name, 'General') as department_name,
            u.email as approved_by_name,
            curr_d.title as curr_designation,
            curr_dept.department_name as curr_department
        FROM public.promotions p
        JOIN public.employee_info ei ON p.employee_id = ei.employee_id
        LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
        LEFT JOIN public.designations curr_d ON ji.designation_id = curr_d.id
        LEFT JOIN public.departments curr_dept ON ji.department_id = curr_dept.id
        LEFT JOIN public.designations fd ON p.from_designation_id = fd.id
        LEFT JOIN public.designations td ON p.to_designation_id = td.id
        LEFT JOIN public.departments fdept ON p.from_department_id = fdept.id
        LEFT JOIN public.departments tdept ON p.to_department_id = tdept.id
        LEFT JOIN public.users u ON p.approved_by = u.id
        ORDER BY p.created_at DESC
    `);
    return res.rows;
}

export async function createPromotion(data) {
    try {
        const employee_id = data.employee_id;
        const from_designation_id = data.from_designation_id || data.from_designation || null;
        const to_designation_id = data.to_designation_id || data.to_designation || null;
        const from_department_id = data.from_department_id || data.from_department || null;
        const to_department_id = data.to_department_id || data.to_department || null;
        const effective_date = data.effective_date;
        const new_salary = data.new_salary;
        const remarks = data.remarks;
        
        console.log('[DEBUG] createPromotion payload:', data);

        const res = await pool.query(`
            INSERT INTO public.promotions (
                employee_id, from_designation_id, to_designation_id, 
                from_department_id, to_department_id, effective_date, 
                new_salary, remarks, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            RETURNING *
        `, [employee_id, from_designation_id, to_designation_id, from_department_id, to_department_id, effective_date, new_salary, remarks]);
        
        return res.rows[0];
    } catch (error) {
        console.error('[DEBUG] createPromotion error:', error);
        throw error;
    }
}

export async function approvePromotion(id, approvedBy) {
    const res = await pool.query(`
        UPDATE public.promotions
        SET status = 'approved', approved_by = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
    `, [approvedBy, id]);
    
    if (res.rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Promotion record not found');
    
    const promo = res.rows[0];
    
    // Connect database client for multi-query transaction
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Update job info (designation and department)
        await client.query(`
            UPDATE public.job_info
            SET designation_id = $1, department_id = COALESCE($2, department_id)
            WHERE employee_id = $3
        `, [promo.to_designation_id, promo.to_department_id, promo.employee_id]);

        // 2. If new salary is defined, revise active salary history
        if (promo.new_salary && Number(promo.new_salary) > 0) {
            // Set old active salaries to is_current = false, effective_to = CURRENT_DATE
            await client.query(`
                UPDATE public.employee_salary
                SET is_current = false, effective_to = CURRENT_DATE, updated_at = NOW()
                WHERE employee_id = $1 AND is_current = true
            `, [promo.employee_id]);

            // Insert new active salary record
            await client.query(`
                INSERT INTO public.employee_salary (
                    id,
                    employee_id,
                    basic_salary,
                    currency,
                    effective_from,
                    is_current,
                    is_active,
                    revision_type,
                    created_by
                )
                VALUES (gen_random_uuid(), $1, $2, 'PKR', CURRENT_DATE, true, true, 'Promotion', $3)
            `, [promo.employee_id, promo.new_salary, approvedBy]);
        }

        await client.query('COMMIT');

        // 3. Log this action to the Audit Logs
        logAudit({
            userId: approvedBy,
            action: 'UPDATE',
            tableName: 'promotions',
            recordId: promo.id,
            reason: `Approved promotion for employee ${promo.employee_id}. Revised designation and salary to PKR ${promo.new_salary || 'unchanged'}`
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[PROMOTION APPROVAL TRANSACTION ERROR]', err);
        throw err;
    } finally {
        client.release();
    }

    return promo;
}

export async function rejectPromotion(id) {
    const res = await pool.query(`
        UPDATE public.promotions
        SET status = 'rejected', updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `, [id]);
    
    if (res.rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Promotion record not found');
    return res.rows[0];
}
