import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './modules/auth/auth.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import leaveRequestRoutes from './modules/leave/leave.routes.js';
import calendarEventRoutes from './modules/calendar-events/calendar-events.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import dashboardMetricsRoutes from './modules/dashboard/dashboard.routes.js';
import { errorHandler } from './utils/errors.js';
import employeesModuleRoutes from './modules/employees/employees.routes.js';
import configModuleRoutes from './modules/config/config.routes.js';
import penaltiesModuleRoutes from './modules/penalties/penalties.routes.js';
import directoryModuleRoutes from './modules/directory/directory.routes.js';
import promotionsModuleRoutes from './modules/promotions/promotions.routes.js';
import announcementsModuleRoutes from './modules/announcements/announcements.routes.js';
import payrollModuleRoutes from './modules/payroll/payroll.routes.js';
import auditModuleRoutes from './modules/audit/audit.routes.js';
import erpModuleRoutes from './modules/erp/erp.routes.js';
import inventoryModuleRoutes from './modules/inventory/inventory.routes.js';
import projectsModuleRoutes from './modules/projects/projects.routes.js';


const app = express();

const debugMiddleware = (req, res, next) => {
	console.log('[DEBUG] Request:', req.method, req.url, 'cookies:', Object.keys(req.cookies || {}), 'auth:', req.headers.authorization ? 'present' : 'none');
	next();
};

app.use(debugMiddleware);

app.use(
	cors({
		origin: ['http://localhost:5034', 'http://127.0.0.1:5034'],
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization']
	})
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/calendar-events', calendarEventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardMetricsRoutes);
app.use('/api/employees', employeesModuleRoutes);
app.use('/api/config', configModuleRoutes);
app.use('/api', penaltiesModuleRoutes);
app.use('/api/directory', directoryModuleRoutes);
app.use('/api/promotions', promotionsModuleRoutes);
app.use('/api/announcements', announcementsModuleRoutes);
app.use('/api/payroll', payrollModuleRoutes);
app.use('/api/audit-logs', auditModuleRoutes);
app.use('/api/erp', erpModuleRoutes);
app.use('/api/inventory', inventoryModuleRoutes);
app.use('/api/projects', projectsModuleRoutes);

app.get('/', (req, res) => {
	res.status(200).json({ success: true, data: { message: 'server is running' } });
});

app.use(errorHandler);

export default app;
