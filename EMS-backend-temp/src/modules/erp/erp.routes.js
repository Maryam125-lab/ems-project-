import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/respond.js';
import pool from '../../config/db.js';

const router = Router();

const modules = [
  {
    key: 'hr',
    name: 'HR Management',
    status: 'active',
    health: 'online',
    route: '/Dashboard',
    description: 'Employees, attendance, leave, payroll, penalties, announcements, and HR configuration.',
    capabilities: ['Employee master', 'Attendance ledger', 'Leave approvals', 'Payroll and penalties'],
  },
  {
    key: 'inventory',
    name: 'Inventory Control',
    status: 'coming_soon',
    health: 'architecture_ready',
    route: '/Inventory',
    description: 'Item master, warehouses, purchase requests, stock movement, and project-wise material usage.',
    capabilities: ['Item master', 'Warehouses', 'Stock in/out', 'Low stock alerts'],
  },
  {
    key: 'projects',
    name: 'Project Management',
    status: 'coming_soon',
    health: 'architecture_ready',
    route: '/Projects',
    description: 'Projects, milestones, tasks, team allocation, timesheets, and project cost tracking.',
    capabilities: ['Project board', 'Milestones', 'Tasks', 'Team allocation'],
  },
  {
    key: 'reports',
    name: 'Reports Center',
    status: 'partial',
    health: 'connected',
    route: '/AuditLog',
    description: 'Cross-module reporting surface for HR, inventory, projects, approvals, and audit trails.',
    capabilities: ['Audit logs', 'HR summaries', 'Exports', 'Cross-module KPIs'],
  },
];

router.use(verifyToken);

router.get('/modules', async (req, res, next) => {
  try {
    const roleResult = await pool.query(
      `SELECT role_name FROM public.roles WHERE id = $1 LIMIT 1`,
      [req.user.role_id]
    );
    const roleName = roleResult.rows[0]?.role_name || 'employee';
    const isEmployee = roleName === 'employee';
    const mappedModules = modules.map((module) => {
      if (module.key === 'hr' && isEmployee) {
        return {
          ...module,
          name: 'Employee Portal',
          route: '/MyPortal/Dashboard',
          description: 'Self-service attendance, leave, payslips, penalties, profile, and company directory.',
          capabilities: ['My dashboard', 'Leave self-service', 'Attendance verification', 'Company directory'],
        };
      }

      return module;
    });

    return sendSuccess(
      res,
      {
        user: {
          employee_id: req.user.employee_id,
          role_id: req.user.role_id,
          role_name: roleName,
        },
        modules: mappedModules,
        integration: {
          auth: 'single_erp_session',
          backend: 'shared_api_layer',
          roadmap: 'modular_services_ready',
        },
      },
      200
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
