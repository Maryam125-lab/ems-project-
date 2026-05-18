import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

const firstNames = ['John', 'Jane', 'Ali', 'Ahmed', 'Sara', 'Fatima', 'Usman', 'Omar', 'Aisha', 'Zainab', 'Bilal', 'Hamza', 'Sana', 'Kiran', 'Mustafa', 'Hassan', 'Hussain', 'Zaid', 'Huzaifa', 'Nida', 'Sadia', 'Imran', 'Tariq', 'Rashid', 'Komal', 'Amna', 'Faisal', 'Naveed', 'Asad', 'Faraz', 'Salman', 'Zubair', 'Yasir', 'Kamran', 'Adnan', 'Sohail', 'Waqas', 'Arsalan', 'Zeeshan', 'Rizwan'];
const lastNames = ['Khan', 'Ahmed', 'Ali', 'Sheikh', 'Malik', 'Shah', 'Siddiqui', 'Raza', 'Hussain', 'Lodhi', 'Mughal', 'Qureshi', 'Ansari', 'Farooqi', 'Hashmi', 'Jameel', 'Kaleem', 'Mehmood', 'Parveen', 'Rizvi', 'Zahra', 'Hassan', 'Farooq', 'Ghani', 'Shahid', 'Iqbal', 'Mirza', 'Abbas', 'Baig', 'Chaudhry', 'Akram', 'Aslam', 'Bhatti', 'Dar', 'Gill', 'Latif', 'Memon', 'Sultan', 'Tahir', 'Warraich'];
const companies = ['TechSol', 'Innovatech', 'Global Systems', 'DataFlow', 'SmartLogic', 'Nexus Corp', 'Apex Solutions', 'Zenith Enterprises', 'CloudNine', 'Binary Pulse'];

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCNIC() {
    return `${getRandomInt(42101, 42501)}-${getRandomInt(1000000, 9999999)}-${getRandomInt(1, 9)}`;
}

function generatePhone() {
    return `03${getRandomInt(0, 4)}${getRandomInt(0, 9)}-${getRandomInt(1000000, 9999999)}`;
}

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('--- STARTING COMPREHENSIVE SEEDING (500 EMPLOYEES) ---');

        // 1. CLEAR ALL TABLES (Dependency Order)
        const tablesToClear = [
            'delivery_order_items', 'delivery_orders', 'invoice_items', 'invoices',
            'quotation_items', 'quotations', 'inventory_movements', 'inventory_items',
            'grn_items', 'grns', 'purchase_order_items', 'purchase_orders',
            'purchase_request_items', 'purchase_requests', 'products', 'item_categories',
            'vendors', 'customers', 'audit_logs', 'employee_penalties', 'penalty_rules',
            'directory_entries', 'urgent_alerts', 'pending_actions', 'notifications',
            'calendar_events', 'attendance', 'leave_requests', 'leave_balances',
            'leave_policies', 'users', 'job_info', 'employee_job_history',
            'emergency_contacts', 'employee_bank_accounts', 'employee_medical', 'employee_info',
            'role_permissions', 'permissions', 'roles', 'leave_types',
            'shifts', 'work_locations', 'work_modes', 'job_statuses',
            'employment_types', 'designations', 'departments'
        ];

        for (const table of tablesToClear) {
            await client.query(`TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE`);
        }
        console.log('SUCCESS: All tables cleared.');

        // 2. SCHEMA FIXES (Idempotent)
        await client.query('ALTER TABLE roles ALTER COLUMN department_id DROP NOT NULL');

        // 3. CORE LOOKUP DATA
        const depts = [
            { code: 'IT', name: 'Information Technology' },
            { code: 'HR', name: 'Human Resources' },
            { code: 'FIN', name: 'Finance' },
            { code: 'SAL', name: 'Sales' },
            { code: 'MKT', name: 'Marketing' },
            { code: 'OPS', name: 'Operations' },
            { code: 'ENG', name: 'Engineering' }
        ];
        const deptMap = {};
        for (const d of depts) {
            const res = await client.query('INSERT INTO departments (department_code, department_name) VALUES ($1, $2) RETURNING id', [d.code, d.name]);
            deptMap[d.code] = res.rows[0].id;
        }

        const desigs = ['CEO', 'CTO', 'Director', 'Manager', 'Team Lead', 'Senior Software Engineer', 'Software Engineer', 'Accountant', 'Sales Manager', 'Sales Executive', 'HR Specialist'];
        const desigMap = {};
        for (const title of desigs) {
            const res = await client.query('INSERT INTO designations (title) VALUES ($1) RETURNING id', [title]);
            desigMap[title] = res.rows[0].id;
        }

        const empTypes = ['Full-Time', 'Contract', 'Intern'];
        const empTypeMap = {};
        for (const t of empTypes) {
            const res = await client.query('INSERT INTO employment_types (type_name) VALUES ($1) RETURNING id', [t]);
            empTypeMap[t] = res.rows[0].id;
        }

        const jobStatuses = ['Active', 'Inactive', 'Terminated'];
        const jobStatusMap = {};
        for (const s of jobStatuses) {
            const res = await client.query('INSERT INTO job_statuses (status_name) VALUES ($1) RETURNING id', [s]);
            jobStatusMap[s] = res.rows[0].id;
        }

        const workModes = ['On-Site', 'Remote', 'Hybrid'];
        const workModeMap = {};
        for (const m of workModes) {
            const res = await client.query('INSERT INTO work_modes (mode_name) VALUES ($1) RETURNING id', [m]);
            workModeMap[m] = res.rows[0].id;
        }

        const locs = ['Karachi HQ', 'Lahore Branch', 'Remote'];
        const locMap = {};
        for (const l of locs) {
            const res = await client.query('INSERT INTO work_locations (location_name) VALUES ($1) RETURNING id', [l]);
            locMap[l] = res.rows[0].id;
        }

        const shifts = [
            { name: 'General', start: '09:00:00', end: '18:00:00', late: 15 },
            { name: 'Morning', start: '08:00:00', end: '17:00:00', late: 10 }
        ];
        const shiftMap = {};
        for (const s of shifts) {
            const res = await client.query('INSERT INTO shifts (name, start_time, end_time, late_after_minutes) VALUES ($1, $2, $3, $4) RETURNING id', [s.name, s.start, s.end, s.late]);
            shiftMap[s.name] = res.rows[0].id;
        }

        const leaveTypes = ['Annual', 'Sick', 'Casual', 'Unpaid'];
        const leaveTypeMap = {};
        for (const t of leaveTypes) {
            const res = await client.query('INSERT INTO leave_types (name) VALUES ($1) RETURNING id', [t]);
            leaveTypeMap[t] = res.rows[0].id;
        }
        console.log('SUCCESS: Lookup data seeded.');

        // 4. ROLES & PERMISSIONS
        const allPerms = [
            'config:read', 'config:manage', 'employees:read', 'employees:write',
            'leave:read', 'leave:write', 'leave:approve', 'attendance:read', 'attendance:write',
            'dashboard:read', 'directory:read', 'inventory:read', 'inventory:write', 
            'purchasing:read', 'purchasing:write', 'purchasing:approve', 'sales:read', 'sales:write'
        ];
        const permIdMap = {};
        for (const p of allPerms) {
            const res = await client.query('INSERT INTO permissions (permission_key) VALUES ($1) RETURNING id', [p]);
            permIdMap[p] = res.rows[0].id;
        }

        const roles = [
            { name: 'super_admin', perms: allPerms },
            { name: 'hr_manager', perms: ['employees:read', 'employees:write', 'leave:read', 'leave:approve', 'attendance:read', 'attendance:write'] },
            { name: 'employee', perms: ['employees:read', 'leave:write', 'attendance:read', 'directory:read'] }
        ];
        const roleIdMap = {};
        for (const r of roles) {
            const res = await client.query('INSERT INTO roles (role_name, department_id) VALUES ($1, $2) RETURNING id', [r.name, r.name === 'hr_manager' ? deptMap['HR'] : null]);
            roleIdMap[r.name] = res.rows[0].id;
            for (const p of r.perms) {
                await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [res.rows[0].id, permIdMap[p]]);
            }
        }
        console.log('SUCCESS: Roles and permissions seeded.');

        // 5. EMPLOYEES (500)
        const totalEmployees = 500;
        const employees = [];
        const commonPass = await hashPassword('password123');
        const adminPass = await hashPassword('zaidkhan123');

        console.log(`PROGRESS: Generating ${totalEmployees} employees...`);
        for (let i = 1; i <= totalEmployees; i++) {
            const empId = `EMP${String(i).padStart(3, '0')}`;
            const fName = getRandomElement(firstNames);
            const lName = getRandomElement(lastNames);
            const name = `${fName} ${lName}`;
            const email = i === 1 ? 'zaidbinasif468@gmail.com' : `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@company.com`;
            
            const deptCode = i === 1 ? 'IT' : getRandomElement(depts).code;
            const role = i === 1 ? 'super_admin' : (i <= 5 ? 'hr_manager' : 'employee');

            // Info
            await client.query('INSERT INTO employee_info (employee_id, name, father_name, cnic, date_of_birth) VALUES ($1, $2, $3, $4, $5)', [
                empId, name, `${getRandomElement(firstNames)} ${lName}`, generateCNIC(), `19${getRandomInt(75, 98)}-01-01`
            ]);

            // Jobs
            const doj = '2023-01-01';
            await client.query('INSERT INTO job_info (employee_id, department_id, designation_id, employment_type_id, job_status_id, work_mode_id, work_location_id, shift_id, date_of_joining) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
                empId, deptMap[deptCode], getRandomElement(Object.values(desigMap)), empTypeMap['Full-Time'], jobStatusMap['Active'], getRandomElement(Object.values(workModeMap)), getRandomElement(Object.values(locMap)), getRandomElement(Object.values(shiftMap)), doj
            ]);

            // Job History
            await client.query('INSERT INTO employee_job_history (employee_id, department_id, designation_id, start_date) VALUES ($1, $2, $3, $4)', [
                empId, deptMap[deptCode], getRandomElement(Object.values(desigMap)), doj
            ]);

            // User
            const uRes = await client.query('INSERT INTO users (employee_id, email, password, role_id) VALUES ($1, $2, $3, $4) RETURNING id', [
                empId, email, i === 1 ? adminPass : commonPass, roleIdMap[role]
            ]);

            // Support Tables
            await client.query('INSERT INTO emergency_contacts (employee_id, contact_1, e_contact_1_relation, e_contact_1_full_name, e_contact_1_phone) VALUES ($1, $2, $3, $4, $5)', [empId, generatePhone(), 'father', 'Emergency Contact', generatePhone()]);
            await client.query('INSERT INTO employee_bank_accounts (employee_id, bank_name, iban, account_title) VALUES ($1, $2, $3, $4)', [empId, 'HBL', `PK${i}0000000`, name]);
            await client.query('INSERT INTO employee_medical (employee_id, blood_group, gender) VALUES ($1, $2, $3)', [empId, 'O+', getRandomElement(['male', 'female'])]);
            
            // Directory
            await client.query('INSERT INTO directory_entries (employee_id, name, email, phone_mobile, role_title, department_id, availability) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
                empId, name, email, generatePhone(), 'Staff', deptMap[deptCode], 'available'
            ]);

            employees.push({ empId, userId: uRes.rows[0].id, deptId: deptMap[deptCode] });
        }
        console.log('SUCCESS: 500 Employee profiles created.');

        // 6. ATTENDANCE & LEAVES (Linked)
        console.log('PROGRESS: Seeding linked Attendance and Leaves (last 30 days)...');
        const hrManagerUserId = employees.find(e => e.empId === 'EMP002').userId;
        const leaveRequests = [];
        
        // Create some leaves first
        for (let i = 0; i < 150; i++) {
            const emp = getRandomElement(employees);
            const start = '2026-04-10';
            const end = '2026-04-12';
            const status = getRandomElement(['approved', 'pending', 'rejected']);
            const res = await client.query('INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, status, reason, reviewed_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [
                emp.empId, getRandomElement(Object.values(leaveTypeMap)), start, end, status, 'Family matter', status !== 'pending' ? hrManagerUserId : null
            ]);
            if (status === 'approved') leaveRequests.push({ empId: emp.empId, start, end });
        }

        // Attendance (30 days)
        for (let d = 0; d < 30; d++) {
            const date = new Date('2026-05-05');
            date.setDate(date.getDate() - d);
            const dateStr = date.toISOString().split('T')[0];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            for (const emp of employees) {
                const isOnLeave = leaveRequests.some(l => l.empId === emp.empId && dateStr >= l.start && dateStr <= l.end);
                let status = isOnLeave ? 'on_leave' : (isWeekend ? 'holiday' : 'present');
                if (status === 'present' && Math.random() < 0.05) status = 'absent';
                
                await client.query('INSERT INTO attendance (employee_id, shift_id, date, status, state, ack) VALUES ($1, $2, $3, $4, $5, $6)', [
                    emp.empId, getRandomElement(Object.values(shiftMap)), dateStr, status, 'locked', true
                ]);
            }
        }
        console.log('SUCCESS: Attendance and Leaves synchronized.');

        // 7. COMMERCIAL FLOW (Full Cycle)
        console.log('PROGRESS: Seeding Commercial Flow (PR -> PO -> GRN -> INV)...');
        // Customers & Vendors
        const custIds = [];
        for (let i = 1; i <= 20; i++) {
            const res = await client.query('INSERT INTO customers (customer_name, company_name, customer_type, phone, email) VALUES ($1, $2, $3, $4, $5) RETURNING id', [`Cust ${i}`, `Company ${i}`, 'Corporate', generatePhone(), `c${i}@test.com`]);
            custIds.push(res.rows[0].id);
        }
        const vendIds = [];
        for (let i = 1; i <= 20; i++) {
            const res = await client.query('INSERT INTO vendors (vendor_name, phone, email) VALUES ($1, $2, $3) RETURNING id', [`Vend ${i}`, generatePhone(), `v${i}@test.com`]);
            vendIds.push(res.rows[0].id);
        }

        // Products
        const catRes = await client.query('INSERT INTO item_categories (category_name) VALUES ($1) RETURNING id', ['General']);
        const prodIds = [];
        for (let i = 1; i <= 50; i++) {
            const res = await client.query('INSERT INTO products (product_name, category_id, product_type, tracking_type, quantity) VALUES ($1, $2, $3, $4, $5) RETURNING id', [`Item ${i}`, catRes.rows[0].id, 'ASSET', 'SERIAL', 100]);
            prodIds.push(res.rows[0].id);
        }

        // Cycle: PR -> PO -> GRN -> Stock
        for (let i = 1; i <= 10; i++) {
            const pr = await client.query('INSERT INTO purchase_requests (pr_id, requested_by, status) VALUES ($1, $2, $3) RETURNING id', [`PR-${i}`, hrManagerUserId, 'APPROVED']);
            const po = await client.query('INSERT INTO purchase_orders (po_id, pr_id, vendor_id, created_by, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING id', [`PO-${i}`, pr.rows[0].id, getRandomElement(vendIds), hrManagerUserId, 1000]);
            const grn = await client.query('INSERT INTO grns (grn_id, po_id, received_by) VALUES ($1, $2, $3) RETURNING id', [`GRN-${i}`, po.rows[0].id, hrManagerUserId]);
            
            const prod = getRandomElement(prodIds);
            await client.query('INSERT INTO grn_items (grn_id, product_id, product_name, quantity_received) VALUES ($1, $2, $3, $4)', [grn.rows[0].id, prod, 'Seeded Product', 10]);
            await client.query('INSERT INTO inventory_items (product_id, serial_number, current_status) VALUES ($1, $2, $3)', [prod, `SN-${i}-${Date.now()}`, 'AVAILABLE']);
        }

        // Cycle: Quotation -> DO -> Invoice
        for (let i = 1; i <= 10; i++) {
            const q = await client.query('INSERT INTO quotations (quotation_id, customer_id, status, total_amount) VALUES ($1, $2, $3, $4) RETURNING id', [`QUO-${i}`, getRandomElement(custIds), 'APPROVED', 5000]);
            await client.query('INSERT INTO delivery_orders (do_id, quotation_id, status) VALUES ($1, $2, $3) RETURNING id', [`DO-${i}`, q.rows[0].id, 'APPROVED']);
            await client.query('INSERT INTO invoices (invoice_id, quotation_id, total_amount, payment_status) VALUES ($1, $2, $3, $4)', [`INV-${i}`, q.rows[0].id, 5000, 'PAID']);
        }
        console.log('SUCCESS: Commercial transactions seeded.');

        // 8. FINAL TOUCHES
        await client.query('INSERT INTO calendar_events (title, date, type, visibility) VALUES ($1, $2, $3, $4)', ['Project Launch', '2026-06-01', 'event', 'all']);
        await client.query('INSERT INTO audit_logs (user_id, action, table_name, reason) VALUES ($1, $2, $3, $4)', [hrManagerUserId, 'INSERT', 'employees', 'System initialization']);

        await client.query('COMMIT');
        console.log('\n--- ALL DONE! DATABASE IS FULLY LOADED ---');
        console.log('Credentials:');
        console.log('  Admin: zaidbinasif468@gmail.com / zaidkhan123');
        console.log('  Staff: user@company.com / password123 (replace with actual generated emails)');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('CRITICAL ERROR: Seeding failed ->', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
