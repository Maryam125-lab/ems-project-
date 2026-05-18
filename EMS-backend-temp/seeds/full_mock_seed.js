import { Pool } from 'pg'
import bcrypt from 'bcrypt'
import 'dotenv/config'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

async function hashPassword(password) {
    return bcrypt.hash(password, 10)
}

/**
 * Full mock seed for the EMS HCM routes.
 *
 * Covers tables behind routes in src/routes:
 * - departments, designations, employment_types, job_statuses, work_modes, work_locations, shifts
 * - permissions, roles, role_permissions, users
 * - employee_info, emergency_contacts, employee_bank_accounts, employee_medical, job_info, employee_job_history
 * - leave_types, leave_policies, leave_balances, leave_requests
 * - attendance (including ack column)
 *
 * Safe to run on a fresh DB. It clears only HCM-related tables (not inventory/purchasing).
 */
async function seed() {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        // Clear existing HCM data (reverse dependency order)
        await client.query('DELETE FROM urgent_alerts')
        await client.query('DELETE FROM pending_actions')
        await client.query('DELETE FROM notifications')
        await client.query('DELETE FROM calendar_events')
        await client.query('DELETE FROM attendance')
        await client.query('DELETE FROM employee_penalties')
        await client.query('DELETE FROM penalty_rules')
        await client.query('DELETE FROM leave_requests')
        await client.query('DELETE FROM leave_balances')
        await client.query('DELETE FROM leave_policies')
        await client.query('DELETE FROM users')
        await client.query('DELETE FROM job_info')
        await client.query('DELETE FROM employee_job_history')
        await client.query('DELETE FROM emergency_contacts')
        await client.query('DELETE FROM employee_bank_accounts')
        await client.query('DELETE FROM employee_medical')
        await client.query('DELETE FROM employee_info')

        await client.query('DELETE FROM role_permissions')
        await client.query('DELETE FROM permissions')
        await client.query('DELETE FROM roles')
        await client.query('DELETE FROM leave_types')
        await client.query('DELETE FROM shifts')
        await client.query('DELETE FROM work_locations')
        await client.query('DELETE FROM work_modes')
        await client.query('DELETE FROM job_statuses')
        await client.query('DELETE FROM employment_types')
        await client.query('DELETE FROM designations')
        await client.query('DELETE FROM departments')

        console.log('Cleared existing HCM data')

        // Allow NULL department_id for global roles like super_admin
        await client.query('ALTER TABLE roles ALTER COLUMN department_id DROP NOT NULL')

        // ==================== PERMISSIONS ====================
        const permissions = [
            { key: 'config:read', desc: 'Read system configuration (dropdowns, lookups)' },
            { key: 'config:manage', desc: 'Manage system configuration' },
            { key: 'employees:read', desc: 'View employee data' },
            { key: 'employees:write', desc: 'Create and update employees' },
            { key: 'leave:read', desc: 'View leave requests and balances' },
            { key: 'leave:write', desc: 'Submit leave requests' },
            { key: 'leave:approve', desc: 'Approve/reject leave requests' },
            { key: 'attendance:read', desc: 'View attendance records' },
            { key: 'attendance:write', desc: 'Mark and update attendance' },
            { key: 'calendar:read', desc: 'View shared calendar events' },
            { key: 'calendar:write', desc: 'Create and update calendar events' },
            { key: 'notifications:read', desc: 'View notifications' },
            { key: 'notifications:write', desc: 'Create notifications' },
            { key: 'alerts:read', desc: 'View urgent alerts' },
            { key: 'pending_actions:read', desc: 'View pending HR actions' },
            { key: 'dashboard:read', desc: 'View HR dashboard metrics' },
            { key: 'directory:read', desc: 'View employee directory' },
            { key: 'directory:write', desc: 'Manage employee directory entries' },
        ]

        const permissionMap = {}
        for (const perm of permissions) {
            const res = await client.query(
                'INSERT INTO permissions (permission_key, description) VALUES ($1, $2) RETURNING id',
                [perm.key, perm.desc]
            )
            permissionMap[perm.key] = res.rows[0].id
        }
        console.log('Created permissions')

        // ==================== DEPARTMENTS ====================
        const deptRows = [
            ['IT', 'Information Technology'],
            ['HR', 'Human Resources'],
            ['FIN', 'Finance'],
            ['SAL', 'Sales'],
        ]

        const deptIds = {}
        for (const [code, name] of deptRows) {
            const res = await client.query(
                'INSERT INTO departments (department_code, department_name) VALUES ($1, $2) RETURNING id',
                [code, name]
            )
            deptIds[code] = res.rows[0].id
        }
        console.log('Created departments')

        // ==================== DESIGNATIONS ====================
        const designations = [
            'Software Engineer',
            'Senior Software Engineer',
            'HR Manager',
            'HR Executive',
            'Finance Manager',
            'Accountant',
            'Sales Manager',
            'Sales Executive',
            'Team Lead',
            'System Administrator',
        ]

        const designationMap = {}
        for (const title of designations) {
            const res = await client.query('INSERT INTO designations (title, is_active) VALUES ($1, $2) RETURNING id', [
                title,
                true,
            ])
            designationMap[title] = res.rows[0].id
        }
        console.log('Created designations')

        // ==================== EMPLOYMENT TYPES ====================
        const employmentTypes = ['Full-Time', 'Part-Time', 'Contract', 'Intern']
        const empTypeMap = {}
        for (const typeName of employmentTypes) {
            const res = await client.query(
                'INSERT INTO employment_types (type_name, is_active) VALUES ($1, $2) RETURNING id',
                [typeName, true]
            )
            empTypeMap[typeName] = res.rows[0].id
        }
        console.log('Created employment types')

        // ==================== JOB STATUSES ====================
        const jobStatuses = ['Active', 'Inactive', 'On Leave', 'Terminated']
        const jobStatusMap = {}
        for (const statusName of jobStatuses) {
            const res = await client.query(
                'INSERT INTO job_statuses (status_name, is_active) VALUES ($1, $2) RETURNING id',
                [statusName, true]
            )
            jobStatusMap[statusName] = res.rows[0].id
        }
        console.log('Created job statuses')

        // ==================== WORK MODES ====================
        const workModes = ['On-Site', 'Remote', 'Hybrid']
        const workModeMap = {}
        for (const modeName of workModes) {
            const res = await client.query('INSERT INTO work_modes (mode_name, is_active) VALUES ($1, $2) RETURNING id', [
                modeName,
                true,
            ])
            workModeMap[modeName] = res.rows[0].id
        }
        console.log('Created work modes')

        // ==================== WORK LOCATIONS ====================
        const workLocations = ['Main Office', 'Branch Office', 'Home']
        const workLocMap = {}
        for (const locationName of workLocations) {
            const res = await client.query(
                'INSERT INTO work_locations (location_name, is_active) VALUES ($1, $2) RETURNING id',
                [locationName, true]
            )
            workLocMap[locationName] = res.rows[0].id
        }
        console.log('Created work locations')

        // ==================== SHIFTS ====================
        const shifts = [
            { name: 'General', start: '09:00', end: '18:00', lateAfter: 15 },
            { name: 'Morning', start: '08:00', end: '16:00', lateAfter: 10 },
            { name: 'Evening', start: '16:00', end: '00:00', lateAfter: 10 },
            { name: 'Night', start: '00:00', end: '08:00', lateAfter: 10 },
        ]
        const shiftMap = {}
        for (const s of shifts) {
            const res = await client.query(
                'INSERT INTO shifts (name, start_time, end_time, late_after_minutes, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [s.name, s.start, s.end, s.lateAfter, true]
            )
            shiftMap[s.name] = res.rows[0].id
        }
        console.log('Created shifts')

        // ==================== LEAVE TYPES ====================
        const leaveTypes = ['Annual', 'Casual', 'Sick', 'Unpaid']
        const leaveTypeMap = {}
        for (const name of leaveTypes) {
            const res = await client.query('INSERT INTO leave_types (name, is_active) VALUES ($1, $2) RETURNING id', [
                name,
                true,
            ])
            leaveTypeMap[name] = res.rows[0].id
        }
        console.log('Created leave types')

        // ==================== ROLES ====================
        const superAdminRoleId = (
            await client.query('INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id', [
                null,
                'super_admin',
                'Global super administrator with full system access',
            ])
        ).rows[0].id

        const hrManagerRoleId = (
            await client.query('INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id', [
                deptIds.HR,
                'hr_manager',
                'HR Manager with employee, leave, attendance management access',
            ])
        ).rows[0].id

        const hrExecRoleId = (
            await client.query('INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id', [
                deptIds.HR,
                'hr_executive',
                'HR Executive with read access',
            ])
        ).rows[0].id

        // Separate "employee" roles per department (role_name is not unique)
        const itEmployeeRoleId = (
            await client.query('INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id', [
                deptIds.IT,
                'employee',
                'IT Department Employee',
            ])
        ).rows[0].id

        const finEmployeeRoleId = (
            await client.query('INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id', [
                deptIds.FIN,
                'employee',
                'Finance Department Employee',
            ])
        ).rows[0].id

        const salesEmployeeRoleId = (
            await client.query('INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id', [
                deptIds.SAL,
                'employee',
                'Sales Department Employee',
            ])
        ).rows[0].id

        console.log('Created roles')

        // ==================== ROLE PERMISSIONS ====================
        for (const permId of Object.values(permissionMap)) {
            await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [superAdminRoleId, permId])
        }

        const hrManagerPerms = [
            'config:read',
            'employees:read',
            'employees:write',
            'leave:read',
            'leave:write',
            'leave:approve',
            'attendance:read',
            'attendance:write',
            'calendar:read',
            'calendar:write',
            'notifications:read',
            'notifications:write',
            'alerts:read',
            'pending_actions:read',
        ]
        for (const permKey of hrManagerPerms) {
            await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [
                hrManagerRoleId,
                permissionMap[permKey],
            ])
        }

        const hrExecPerms = [
            'config:read',
            'employees:read',
            'leave:read',
            'attendance:read',
            'calendar:read',
            'calendar:write',
            'notifications:read',
            'notifications:write',
            'alerts:read',
            'pending_actions:read',
        ]
        for (const permKey of hrExecPerms) {
            await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [
                hrExecRoleId,
                permissionMap[permKey],
            ])
        }

        // Employees can read employees (self-service enforced by controllers), submit leave, and view attendance.
        const employeePerms = ['employees:read', 'leave:read', 'leave:write', 'attendance:read', 'calendar:read', 'notifications:read']
        for (const roleId of [itEmployeeRoleId, finEmployeeRoleId, salesEmployeeRoleId]) {
            for (const permKey of employeePerms) {
                await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [
                    roleId,
                    permissionMap[permKey],
                ])
            }
        }

        console.log('Created role permissions')

        // ==================== EMPLOYEES + USERS ====================
        const employees = [
            // Super Admin
            {
                empId: 'EMP001',
                name: 'Zaid Khan',
                fatherName: 'Asif Khan',
                cnic: '42101-1234567-1',
                dob: '1992-08-20',
                email: 'zaidbinasif468@gmail.com',
                password: 'zaidkhan123',
                roleId: superAdminRoleId,
                deptId: deptIds.IT,
                desigId: designationMap['System Administrator'],
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap.Hybrid,
                workLoc: workLocMap['Main Office'],
                shift: shiftMap.General,
                doj: '2023-01-15',
                probationEnd: null,
                contractEnd: null,
            },
            // IT employees
            {
                empId: 'EMP002',
                name: 'Huzaifa Kaleem',
                fatherName: 'Kaleem Ahmed',
                cnic: '42101-2345678-2',
                dob: '1995-05-12',
                email: 'huzaifa.kaleem@company.com',
                password: 'password123',
                roleId: itEmployeeRoleId,
                deptId: deptIds.IT,
                desigId: designationMap['Software Engineer'],
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap.Hybrid,
                workLoc: workLocMap['Main Office'],
                shift: shiftMap.General,
                doj: '2023-02-01',
                probationEnd: '2026-05-20',
                contractEnd: null,
            },
            {
                empId: 'EMP003',
                name: 'Ahmed Ali',
                fatherName: 'Ali Raza',
                cnic: '42101-3345678-3',
                dob: '1993-09-08',
                email: 'ahmed.ali@company.com',
                password: 'password123',
                roleId: itEmployeeRoleId,
                deptId: deptIds.IT,
                desigId: designationMap['Senior Software Engineer'],
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap.Remote,
                workLoc: workLocMap.Home,
                shift: shiftMap.General,
                doj: '2022-11-10',
                probationEnd: null,
                contractEnd: null,
            },
            // Finance employees
            {
                empId: 'EMP004',
                name: 'Sara Ahmed',
                fatherName: 'Ahmed Khan',
                cnic: '42101-4345678-4',
                dob: '1991-03-20',
                email: 'sara.ahmed@company.com',
                password: 'password123',
                roleId: finEmployeeRoleId,
                deptId: deptIds.FIN,
                desigId: designationMap.Accountant,
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap['On-Site'],
                workLoc: workLocMap['Main Office'],
                shift: shiftMap.General,
                doj: '2021-07-01',
                probationEnd: null,
                contractEnd: '2026-06-30',
            },
            // Sales employees
            {
                empId: 'EMP005',
                name: 'Bilal Hussain',
                fatherName: 'Hussain Ali',
                cnic: '42101-5345678-5',
                dob: '1994-01-15',
                email: 'bilal.hussain@company.com',
                password: 'password123',
                roleId: salesEmployeeRoleId,
                deptId: deptIds.SAL,
                desigId: designationMap['Sales Executive'],
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap['On-Site'],
                workLoc: workLocMap['Branch Office'],
                shift: shiftMap.Morning,
                doj: '2023-04-01',
                probationEnd: '2026-05-10',
                contractEnd: null,
            },
            // HR (Manager + Executive)
            {
                empId: 'EMP006',
                name: 'Sadia Malik',
                fatherName: 'Malik Rafiq',
                cnic: '42101-6345678-6',
                dob: '1988-12-02',
                email: 'sadia.malik@company.com',
                password: 'password123',
                roleId: hrManagerRoleId,
                deptId: deptIds.HR,
                desigId: designationMap['HR Manager'],
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap['On-Site'],
                workLoc: workLocMap['Main Office'],
                shift: shiftMap.General,
                doj: '2020-06-15',
                probationEnd: null,
                contractEnd: null,
            },
            {
                empId: 'EMP007',
                name: 'Imran Shah',
                fatherName: 'Shah Nawaz',
                cnic: '42101-7345678-7',
                dob: '1990-04-18',
                email: 'imran.shah@company.com',
                password: 'password123',
                roleId: hrExecRoleId,
                deptId: deptIds.HR,
                desigId: designationMap['HR Executive'],
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap.Hybrid,
                workLoc: workLocMap['Main Office'],
                shift: shiftMap.General,
                doj: '2022-01-10',
                probationEnd: null,
                contractEnd: null,
            },
        ]

        // Add extra employees to reach a bigger directory for testing
        for (let i = 8; i <= 15; i += 1) {
            const deptCode = i % 3 === 0 ? 'FIN' : i % 3 === 1 ? 'IT' : 'SAL'
            const deptId = deptIds[deptCode]
            const roleId = deptCode === 'FIN' ? finEmployeeRoleId : deptCode === 'IT' ? itEmployeeRoleId : salesEmployeeRoleId
            const empId = `EMP${String(i).padStart(3, '0')}`
            employees.push({
                empId,
                name: `Employee ${i}`,
                fatherName: `Father ${i}`,
                cnic: `42101-${8000000 + i}-${i}`,
                dob: '1996-01-01',
                email: `employee${i}@company.com`,
                password: 'password123',
                roleId,
                deptId,
                desigId:
                    deptCode === 'FIN'
                        ? designationMap['Finance Manager']
                        : deptCode === 'IT'
                          ? designationMap['Software Engineer']
                          : designationMap['Sales Manager'],
                empType: empTypeMap['Full-Time'],
                jobStatus: jobStatusMap.Active,
                workMode: workModeMap.Hybrid,
                workLoc: workLocMap['Main Office'],
                shift: shiftMap.General,
                doj: '2023-05-01',
                probationEnd: i % 2 === 0 ? '2026-05-15' : null,
                contractEnd: deptCode === 'SAL' ? '2026-07-31' : null,
            })
        }

        // Create employees + related records
        for (const emp of employees) {
            await client.query(
                `INSERT INTO employee_info (employee_id, name, father_name, cnic, date_of_birth)
                 VALUES ($1, $2, $3, $4, $5)`,
                [emp.empId, emp.name, emp.fatherName, emp.cnic, emp.dob]
            )

            // Emergency Contacts
            await client.query(
                `INSERT INTO emergency_contacts
                 (employee_id, contact_1, contact_2, perment_address, postal_address, 
                  e_contact_1_relation, e_contact_1_full_name, e_contact_1_phone, 
                  e_contact_1_phone_country_code, e_contact_1_email, primary_contact)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    emp.empId,
                    `0300-${emp.empId.slice(-3)}0000`,
                    null,
                    `${emp.name} Permanent Address, Karachi`,
                    `${emp.name} Postal Address, Karachi`,
                    'mother',
                    `Mother of ${emp.name}`,
                    `0301-${emp.empId.slice(-3)}0000`,
                    '+92',
                    `mother.${emp.empId.toLowerCase()}@example.com`,
                    1
                ]
            )

            // Bank Account
            if (emp.empId !== 'EMP005') {
                await client.query(
                    `INSERT INTO employee_bank_accounts
                     (employee_id, bank_name, branch_name, branch_code, iban, account_title, account_number, account_type)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        emp.empId,
                        "HBL",
                        "Main Branch",
                        "001",
                        `PK00HBL0000${emp.empId.slice(-3)}0000`,
                        emp.name,
                        `${emp.empId}00000000`,
                        'salary'
                    ]
                )
            }

            // Medical Info
            await client.query(
                `INSERT INTO employee_medical
                 (employee_id, blood_group, gender, height_cm, weight_kg)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    emp.empId,
                    'A+',
                    emp.name.toLowerCase().includes('sara') || emp.name.toLowerCase().includes('sadia') || emp.name.toLowerCase().includes('nida') || emp.name.toLowerCase().includes('fatima') ? 'female' : 'male',
                    175,
                    65
                ]
            )


            await client.query(
                `INSERT INTO job_info
                 (employee_id, department_id, designation_id, employment_type_id, job_status_id,
                  work_mode_id, work_location_id, shift_id, date_of_joining, date_of_exit, probation_end_date, contract_end_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    emp.empId,
                    emp.deptId,
                    emp.desigId,
                    emp.empType,
                    emp.jobStatus,
                    emp.workMode,
                    emp.workLoc,
                    emp.shift,
                    emp.doj,
                    null,
                    emp.probationEnd,
                    emp.contractEnd,
                ]
            )

            const hashedPassword = await hashPassword(emp.password)
            await client.query('INSERT INTO users (employee_id, email, password, role_id) VALUES ($1, $2, $3, $4)', [
                emp.empId,
                emp.email,
                hashedPassword,
                emp.roleId,
            ])
        }

        console.log(`Created ${employees.length} employees with job/extra info and users`)

        // Map key user IDs for reviewed_by / marked_by usage
        const hrManagerUser = await client.query(
            `SELECT u.id, u.employee_id
             FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.role_name = 'hr_manager'
             LIMIT 1`
        )
        const hrManagerUserId = hrManagerUser.rows?.[0]?.id || null
        const userDirectory = await client.query(
            `SELECT u.id, u.employee_id, r.role_name
             FROM users u
             JOIN roles r ON r.id = u.role_id`
        )
        const userIdByEmployee = Object.fromEntries(userDirectory.rows.map((row) => [row.employee_id, row.id]))
        const userIdsByRole = userDirectory.rows.reduce((acc, row) => {
            acc[row.role_name] = acc[row.role_name] ?? []
            acc[row.role_name].push(row.id)
            return acc
        }, {})
        const hrUserIds = userDirectory.rows
            .filter((row) => row.role_name === 'hr_manager' || row.role_name === 'hr_executive')
            .map((row) => row.id)

        // ==================== EMPLOYEE JOB HISTORY ====================
        // Use HR manager as default manager for most employees for realistic hierarchy.
        for (const emp of employees) {
            const managerEmpId = emp.empId === 'EMP006' ? null : 'EMP006'
            await client.query(
                `INSERT INTO employee_job_history
                 (employee_id, department_id, designation_id, manager_emp_id, start_date, end_date)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [emp.empId, emp.deptId, emp.desigId, managerEmpId, emp.doj, null]
            )
        }
        console.log('Created employee job history')

        // ==================== LEAVE POLICIES (per department) ====================
        const year = 2026
        const policyDays = { Annual: 14, Casual: 10, Sick: 8, Unpaid: 365 }
        for (const deptId of Object.values(deptIds)) {
            for (const typeName of leaveTypes) {
                await client.query(
                    `INSERT INTO leave_policies (department_id, leave_type_id, days_allowed, year, is_active)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [deptId, leaveTypeMap[typeName], policyDays[typeName], year, true]
                )
            }
        }
        console.log('Created leave policies')

        // ==================== LEAVE BALANCES (per employee) ====================
        for (const emp of employees) {
            for (const typeName of leaveTypes) {
                // Example: make Annual/Casual partially used for some employees.
                const balance = policyDays[typeName]
                const used = typeName === 'Annual' && emp.empId.endsWith('2') ? 2 : 0
                await client.query(
                    `INSERT INTO leave_balances (employee_id, leave_type_id, year, balance, used)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [emp.empId, leaveTypeMap[typeName], year, balance, used]
                )
            }
        }
        console.log('Created leave balances')

        // ==================== LEAVE REQUESTS ====================
        // Create a few leave requests with mixed statuses.
        const leaveRequests = [
            // Pending (employee)
            {
                employee_id: 'EMP002',
                type: 'Casual',
                start: '2026-01-10',
                end: '2026-01-11',
                reason: 'Family event',
                status: 'pending',
                reviewed_by: null,
                reviewed_at: null,
                end_by_force: null,
            },
            // Approved (reviewed by HR manager)
            {
                employee_id: 'EMP003',
                type: 'Annual',
                start: '2026-01-15',
                end: '2026-01-18',
                reason: 'Travel',
                status: 'approved',
                reviewed_by: hrManagerUserId,
                reviewed_at: '2026-01-12T10:00:00Z',
                end_by_force: null,
            },
            // Approved but ended early (end_by_force)
            {
                employee_id: 'EMP005',
                type: 'Sick',
                start: '2026-01-20',
                end: '2026-01-24',
                reason: 'Flu',
                status: 'approved',
                reviewed_by: hrManagerUserId,
                reviewed_at: '2026-01-19T10:00:00Z',
                end_by_force: '2026-01-22',
            },
            // Rejected
            {
                employee_id: 'EMP004',
                type: 'Annual',
                start: '2026-02-05',
                end: '2026-02-06',
                reason: 'Personal',
                status: 'rejected',
                reviewed_by: hrManagerUserId,
                reviewed_at: '2026-02-01T10:00:00Z',
                end_by_force: null,
            },
        ]

        for (const lr of leaveRequests) {
            await client.query(
                `INSERT INTO leave_requests
                 (employee_id, leave_type_id, start_date, end_date, end_by_force, reason, status, reviewed_by, reviewed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    lr.employee_id,
                    leaveTypeMap[lr.type],
                    lr.start,
                    lr.end,
                    lr.end_by_force,
                    lr.reason,
                    lr.status,
                    lr.reviewed_by,
                    lr.reviewed_at,
                ]
            )
        }
        console.log('Created leave requests')

        // ==================== ATTENDANCE ====================
        // Seed a small daily sheet window for January 2026 for all employees.
        // Marked by HR manager for realism. Some are ack=true to test the Ack flow.
        const attendanceDates = ['2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18', '2026-01-19']
        for (const emp of employees) {
            for (const d of attendanceDates) {
                const isWeekend = new Date(d + 'T00:00:00Z').getUTCDay() === 0 || new Date(d + 'T00:00:00Z').getUTCDay() === 6
                const status = isWeekend ? 'holiday' : emp.empId === 'EMP005' && d === '2026-01-17' ? 'on_leave' : 'present'
                const checkIn = status === 'present' ? '09:05' : null
                const checkOut = status === 'present' ? '18:00' : null
                const ack = status === 'present' && emp.empId.endsWith('2') && d === '2026-01-15'

                await client.query(
                    `INSERT INTO attendance
                     (employee_id, shift_id, date, check_in, check_out, status, notes, marked_by, ack)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [emp.empId, emp.shift, d, checkIn, checkOut, status, null, hrManagerUserId, ack]
                )
            }
        }
        console.log('Created attendance rows')

        // ==================== CALENDAR EVENTS ====================
        const calendarEvents = [
            { type: 'holiday', date: '2026-05-01', title: 'Labour Day', visibility: 'all' },
            { type: 'birthday', date: '2026-05-12', title: 'Huzaifa Kaleem Birthday', visibility: 'all' },
            { type: 'anniversary', date: '2026-06-15', title: 'Sadia Malik Work Anniversary', visibility: 'all' },
            { type: 'hr_event', date: '2026-05-05', title: 'HR Policy Review Meeting', visibility: 'hr' },
        ]
        for (const event of calendarEvents) {
            await client.query(
                `INSERT INTO calendar_events (type, date, title, visibility, created_by, updated_by)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [event.type, event.date, event.title, event.visibility, hrManagerUserId, hrManagerUserId]
            )
        }
        console.log('Created calendar events')

        // ==================== NOTIFICATIONS ====================
        const notifications = [
            {
                userId: userIdByEmployee.EMP002,
                role: null,
                type: 'attendance',
                message: 'Your attendance for 2026-01-15 is ready for acknowledgement.',
                isRead: false,
            },
            {
                userId: userIdByEmployee.EMP003,
                role: null,
                type: 'leave',
                message: 'Your annual leave request was approved.',
                isRead: true,
            },
            {
                userId: null,
                role: 'employee',
                type: 'announcement',
                message: 'Submit May timesheets before Friday 5 PM.',
                isRead: false,
            },
            {
                userId: null,
                role: 'hr_manager',
                type: 'alert',
                message: 'Two pending employee profile actions need review.',
                isRead: false,
            },
        ]
        for (const notification of notifications) {
            const recipientIds =
                notification.userId
                    ? [notification.userId]
                    : userIdsByRole[notification.role] ?? []

            for (const recipientId of recipientIds) {
                await client.query(
                    `INSERT INTO notifications (user_id, role, type, message, is_read, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [recipientId, notification.role, notification.type, notification.message, notification.isRead, hrManagerUserId]
                )
            }
        }
        console.log('Created notifications')

        // ==================== PENDING ACTIONS ====================
        const pendingActions = [
            {
                employeeId: 'EMP004',
                missingFields: ['emergence_contact_1'],
                status: 'open',
            },
            {
                employeeId: 'EMP005',
                missingFields: ['bank_name', 'bank_acc_num'],
                status: 'open',
            },
        ]
        for (const action of pendingActions) {
            await client.query(
                `INSERT INTO pending_actions (employee_id, missing_fields, status, resolved_by, resolved_at)
                 VALUES ($1, $2::jsonb, $3, $4, $5)`,
                [action.employeeId, JSON.stringify(action.missingFields), action.status, null, null]
            )
        }
        console.log('Created pending actions')

        // ==================== URGENT ALERTS ====================
        const urgentAlerts = [
            { employeeId: 'EMP002', type: 'probation_end', expiryDate: '2026-05-20' },
            { employeeId: 'EMP004', type: 'contract_end', expiryDate: '2026-06-30' },
            { employeeId: 'EMP005', type: 'probation_end', expiryDate: '2026-05-10' },
        ]
        for (const alert of urgentAlerts) {
            await client.query(
                `INSERT INTO urgent_alerts (employee_id, type, expiry_date, status, updated_by)
                 VALUES ($1, $2, $3, $4, $5)`,
                [alert.employeeId, alert.type, alert.expiryDate, 'open', hrUserIds[0] ?? hrManagerUserId]
            )
        }
        console.log('Created urgent alerts')

        await client.query('COMMIT')

        console.log('\n=== Full mock seed completed successfully! ===\n')
        console.log('Super Admin Login:')
        console.log('  Email:    zaidbinasif468@gmail.com')
        console.log('  Password: zaidkhan123\n')
        console.log("Other seeded users use password: 'password123'")
        console.log('  HR Manager:   sadia.malik@company.com')
        console.log('  HR Executive: imran.shah@company.com')
        console.log('  Employee:     huzaifa.kaleem@company.com (EMP002)')
        console.log('  Employee2:    ahmed.ali@company.com (EMP003)')
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('Full mock seed failed:', err)
        throw err
    } finally {
        client.release()
        await pool.end()
    }
}

seed()
