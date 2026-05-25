import { Router } from 'express';
import pool from '../../config/db.js';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { sendSuccess, sendError } from '../../utils/respond.js';

const router = Router();
router.use(verifyToken);

// Service Logic
const payrollService = {
    async getPayrollSummary(month, year) {
        const res = await pool.query(`
            SELECT 
                COUNT(*) as total_employees,
                SUM(net_salary) as total_amount,
                COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_count
            FROM public.payroll_records
            WHERE month = $1 AND year = $2
        `, [month, year]);
        return res.rows[0];
    },

    async listPayroll(month, year) {
        const res = await pool.query(`
            SELECT pr.*, ei.name as employee_name, dep.department_name
            FROM public.payroll_records pr
            JOIN public.employee_info ei ON pr.employee_id = ei.employee_id
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            LEFT JOIN public.departments dep ON dep.id = ji.department_id
            WHERE pr.month = $1 AND pr.year = $2
            ORDER BY ei.name ASC
        `, [month, year]);
        return res.rows;
    },

    async generatePayroll(month, year, createdBy) {
        await pool.query(`
            DELETE FROM public.payroll_records 
            WHERE month = $1 AND year = $2 AND status = 'pending'
        `, [month, year]);

        const allEmployees = await pool.query(`
            SELECT ei.employee_id, ei.name
            FROM public.employee_info ei
            WHERE ei.status = 'active'
        `);

        const employees = await pool.query(`
            SELECT es.employee_id, es.basic_salary, 0 as allowances
            FROM public.employee_salary es
            WHERE es.is_current = true
        `);

        if (employees.rowCount === 0) {
            throw new Error('Kisi bhi employee ki salary configure nahi hai. Pehle Settings mein salary set karein.');
        }

        const salaryEmpIds = new Set(employees.rows.map(e => e.employee_id));
        const missingSalary = allEmployees.rows
            .filter(e => !salaryEmpIds.has(e.employee_id))
            .map(e => ({ employee_id: e.employee_id, name: e.name }));

        for (const emp of employees.rows) {
            const penaltyRes = await pool.query(`
                SELECT SUM(pr.amount_pkr) as penalty_total
                FROM public.employee_penalties ep
                JOIN public.penalty_rules pr ON ep.rule_id = pr.id
                WHERE ep.employee_id = $1 
                AND ep.status = 'approved'
                AND EXTRACT(MONTH FROM ep.date) = $2
                AND EXTRACT(YEAR FROM ep.date) = $3
            `, [emp.employee_id, month, year]);

            const deductions = Number(penaltyRes.rows[0]?.penalty_total || 0);
            const basic = Number(emp.basic_salary);
            const allowances = Number(emp.allowances);
            const netPay = basic + allowances - deductions;

            await pool.query(`
                INSERT INTO public.payroll_records 
                (employee_id, month, year, basic_salary, allowances, deductions, net_salary, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            `, [emp.employee_id, month, year, basic, allowances, deductions, netPay]);
        }

        return { count: employees.rowCount, skipped: missingSalary.length, skipped_employees: missingSalary };
    },

    async processPayroll(id) {
        return pool.query(`
            UPDATE public.payroll_records 
            SET status = 'processed', processed_at = now() 
            WHERE id = $1
        `, [id]);
    },

    async getReport(filters) {
        const { month, year, department_id, status, employee_id } = filters;
        const conditions = ['pr.month = $1', 'pr.year = $2'];
        const params = [month, year];
        let idx = 3;

        if (department_id) { conditions.push(`ji.department_id = $${idx++}`); params.push(department_id); }
        if (status) { conditions.push(`pr.status = $${idx++}`); params.push(status); }
        if (employee_id) { conditions.push(`pr.employee_id = $${idx++}`); params.push(employee_id); }

        const res = await pool.query(`
            SELECT 
                pr.id,
                pr.employee_id,
                ei.name as employee_name,
                dep.department_name,
                des.designation_title,
                pr.basic_salary,
                pr.allowances,
                pr.deductions,
                pr.net_salary,
                pr.status,
                pr.processed_at,
                pr.month,
                pr.year
            FROM public.payroll_records pr
            JOIN public.employee_info ei ON pr.employee_id = ei.employee_id
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            LEFT JOIN public.departments dep ON dep.id = ji.department_id
            LEFT JOIN public.designations des ON des.id = ji.designation_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY dep.department_name ASC, ei.name ASC
        `, params);

        // Summary bhi calculate karo
        const summary = {
            total_employees: res.rows.length,
            total_basic: res.rows.reduce((s, r) => s + Number(r.basic_salary || 0), 0),
            total_allowances: res.rows.reduce((s, r) => s + Number(r.allowances || 0), 0),
            total_deductions: res.rows.reduce((s, r) => s + Number(r.deductions || 0), 0),
            total_net: res.rows.reduce((s, r) => s + Number(r.net_salary || 0), 0),
            processed_count: res.rows.filter(r => r.status === 'processed').length,
            pending_count: res.rows.filter(r => r.status === 'pending').length,
        };

        return { records: res.rows, summary };
    }
};

// ── Routes ──────────────────────────────────────────────────────

router.get('/', requirePermission('payroll:read'), async (req, res, next) => {
    try {
        const month = req.query.month || new Date().getMonth() + 1;
        const year = req.query.year || new Date().getFullYear();
        const data = await payrollService.listPayroll(month, year);
        sendSuccess(res, data);
    } catch (e) { next(e); }
});

router.post('/generate', requirePermission('payroll:write'), async (req, res, next) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) {
            return sendError(res, 'VALIDATION_ERROR', 'Month aur year required hain.', 400);
        }
        const data = await payrollService.generatePayroll(month, year, req.user.user_id);
        sendSuccess(res, data);
    } catch (e) {
        if (e.message && e.message.includes('salary configure nahi')) {
            return sendError(res, 'NO_SALARY_DATA', e.message, 422);
        }
        next(e);
    }
});

router.patch('/:id/process', requirePermission('payroll:write'), async (req, res, next) => {
    try {
        await payrollService.processPayroll(req.params.id);
        sendSuccess(res, { message: 'Payroll processed successfully' });
    } catch (e) { next(e); }
});

router.get('/summary', requirePermission('payroll:read'), async (req, res, next) => {
    try {
        const month = req.query.month || new Date().getMonth() + 1;
        const year = req.query.year || new Date().getFullYear();
        const data = await payrollService.getPayrollSummary(month, year);
        sendSuccess(res, data);
    } catch (e) { next(e); }
});

router.get('/report', requirePermission('payroll:read'), async (req, res, next) => {
    try {
        const month = req.query.month || new Date().getMonth() + 1;
        const year = req.query.year || new Date().getFullYear();
        const data = await payrollService.getReport({
            month,
            year,
            department_id: req.query.department_id || null,
            status: req.query.status || null,
            employee_id: req.query.employee_id || null,
        });
        sendSuccess(res, data);
    } catch (e) { next(e); }
});

router.get('/mine', async (req, res, next) => {
    try {
        const employeeId = req.user.employee_id;
        const resData = await pool.query(`
            SELECT pr.*, ei.name as employee_name, dep.department_name
            FROM public.payroll_records pr
            JOIN public.employee_info ei ON pr.employee_id = ei.employee_id
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            LEFT JOIN public.departments dep ON dep.id = ji.department_id
            WHERE pr.employee_id = $1
            ORDER BY pr.year DESC, pr.month DESC
        `, [employeeId]);
        sendSuccess(res, resData.rows);
    } catch (e) { next(e); }
});

export default router;