import { Router } from 'express';
import pool from '../../config/db.js';
import { verifyToken } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/require-permission.js';
import { sendSuccess } from '../../utils/respond.js';

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
        // 1. Clear existing pending records for this period if any
        await pool.query(`DELETE FROM public.payroll_records WHERE month = $1 AND year = $2 AND status = 'pending'`, [month, year]);

        // 2. Fetch all employees with current salary
        const employees = await pool.query(`
            SELECT 
                es.employee_id,
                es.basic_salary,
                0 as allowances
            FROM public.employee_salary es
            WHERE es.is_current = true
        `);

        for (const emp of employees.rows) {
            // 3. Calculate deductions from approved penalties in this month
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

            // 4. Insert into payroll_records
            await pool.query(`
                INSERT INTO public.payroll_records 
                (employee_id, month, year, basic_salary, allowances, deductions, net_salary, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            `, [emp.employee_id, month, year, basic, allowances, deductions, netPay]);
        }

        return { count: employees.rowCount };
    },
    async processPayroll(id) {
        return pool.query(`UPDATE public.payroll_records SET status = 'processed', processed_at = now() WHERE id = $1`, [id]);
    }
};

// Controller Logic
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
        const data = await payrollService.generatePayroll(month, year, req.user.user_id);
        sendSuccess(res, data);
    } catch (e) { next(e); }
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
