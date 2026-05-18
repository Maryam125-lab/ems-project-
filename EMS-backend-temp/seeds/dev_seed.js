import { Pool } from "pg";
import bcrypt from "bcrypt";
import "dotenv/config";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function seed() {
    // 1. Aggressive reset (outside main transaction)
    const cleanupClient = await pool.connect();
    try {
        const tables = [
            "attendance", "urgent_alerts", "pending_actions", "notifications",
            "calendar_events", "directory_entries", "employee_penalties", "penalty_rules",
            "users", "job_info", "emergency_contacts", "employee_bank_accounts", "employee_medical", "employee_info",
            "role_permissions", "permissions", "roles", "leave_types",
            "shifts", "work_locations", "work_modes", "job_statuses",
            "employment_types", "designations", "departments"
        ];

        for (const table of tables) {
            try { 
                await cleanupClient.query(`TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE`);
            } catch (e) {
                // Ignore if table doesn't exist
            }
        }
        console.log("Cleared all existing data (aggessive reset)");
    } catch (e) {
        console.error("Cleanup CRITICAL ERROR:", e.message);
        throw e;
    } finally {
        cleanupClient.release();
    }

    // 2. Main seeding transaction
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Fix schema: Allow NULL department_id for global roles like super_admin
        await client.query("ALTER TABLE roles ALTER COLUMN department_id DROP NOT NULL");
        console.log("Fixed schema: department_id now allows NULL for global roles");

        // ==================== PERMISSIONS ====================
        const permissions = [
            // Config management
            { key: "config:read", desc: "Read system configuration (dropdowns, lookups)" },
            { key: "config:manage", desc: "Manage system configuration" },
            // Employee management
            { key: "employees:read", desc: "View employee data" },
            { key: "employees:write", desc: "Create and update employees" },
            // Leave management
            { key: "leave:read", desc: "View leave requests and balances" },
            { key: "leave:write", desc: "Submit leave requests" },
            { key: "leave:approve", desc: "Approve/reject leave requests" },
            // Attendance management
            { key: "attendance:read", desc: "View attendance records" },
            { key: "attendance:write", desc: "Mark and update attendance" },
            // Calendar / notifications / dashboard alerts
            { key: "calendar:read", desc: "View shared calendar events" },
            { key: "calendar:write", desc: "Create and update calendar events" },
            { key: "notifications:read", desc: "View notifications" },
            { key: "notifications:write", desc: "Create notifications" },
            { key: "alerts:read", desc: "View urgent alerts" },
            { key: "pending_actions:read", desc: "View pending HR actions" },
            { key: "dashboard:read", desc: "View HR dashboard metrics" },
            { key: "directory:read", desc: "View employee directory" },
            { key: "directory:write", desc: "Manage employee directory entries" },
            // Inventory/Purchasing (if needed)
            { key: "inventory:read", desc: "View inventory" },
            { key: "inventory:write", desc: "Manage inventory" },
            { key: "purchasing:read", desc: "View purchase requests/orders" },
            { key: "purchasing:write", desc: "Create purchase requests/orders" },
            { key: "purchasing:approve", desc: "Approve purchase requests/orders" },
        ];

        const permissionMap = {};
        for (const perm of permissions) {
            const res = await client.query(
                "INSERT INTO permissions (permission_key, description) VALUES ($1, $2) RETURNING id",
                [perm.key, perm.desc]
            );
            permissionMap[perm.key] = res.rows[0].id;
        }
        console.log("Created permissions");

        // ==================== DEPARTMENTS ====================
        const deptRes = await client.query(
            "INSERT INTO departments (department_code, department_name) VALUES ($1, $2) RETURNING id",
            ["IT", "Information Technology"]
        );
        const itDeptId = deptRes.rows[0].id;

        const hrDeptRes = await client.query(
            "INSERT INTO departments (department_code, department_name) VALUES ($1, $2) RETURNING id",
            ["HR", "Human Resources"]
        );
        const hrDeptId = hrDeptRes.rows[0].id;

        const finDeptRes = await client.query(
            "INSERT INTO departments (department_code, department_name) VALUES ($1, $2) RETURNING id",
            ["FIN", "Finance"]
        );
        const finDeptId = finDeptRes.rows[0].id;

        const salesDeptRes = await client.query(
            "INSERT INTO departments (department_code, department_name) VALUES ($1, $2) RETURNING id",
            ["SAL", "Sales"]
        );
        const salesDeptId = salesDeptRes.rows[0].id;

        console.log("Created departments");

        // ==================== DESIGNATIONS ====================
        const designations = [
            "Software Engineer",
            "Senior Software Engineer",
            "HR Manager",
            "HR Executive",
            "Finance Manager",
            "Accountant",
            "Sales Manager",
            "Sales Executive",
            "Team Lead",
            "System Administrator",
        ];

        const designationMap = {};
        for (const title of designations) {
            const res = await client.query(
                "INSERT INTO designations (title, is_active) VALUES ($1, $2) RETURNING id",
                [title, true]
            );
            designationMap[title] = res.rows[0].id;
        }
        console.log("Created designations");

        // ==================== EMPLOYMENT TYPES ====================
        const empTypes = ["Full-Time", "Part-Time", "Contract", "Intern"];
        const empTypeMap = {};
        for (const type of empTypes) {
            const res = await client.query(
                "INSERT INTO employment_types (type_name, is_active) VALUES ($1, $2) RETURNING id",
                [type, true]
            );
            empTypeMap[type] = res.rows[0].id;
        }
        console.log("Created employment types");

        // ==================== JOB STATUSES ====================
        const jobStatuses = ["Active", "Inactive", "On Leave", "Terminated"];
        const jobStatusMap = {};
        for (const status of jobStatuses) {
            const res = await client.query(
                "INSERT INTO job_statuses (status_name, is_active) VALUES ($1, $2) RETURNING id",
                [status, true]
            );
            jobStatusMap[status] = res.rows[0].id;
        }
        console.log("Created job statuses");

        // ==================== WORK MODES ====================
        const workModes = ["Remote", "On-Site", "Hybrid"];
        const workModeMap = {};
        for (const mode of workModes) {
            const res = await client.query(
                "INSERT INTO work_modes (mode_name, is_active) VALUES ($1, $2) RETURNING id",
                [mode, true]
            );
            workModeMap[mode] = res.rows[0].id;
        }
        console.log("Created work modes");

        // ==================== WORK LOCATIONS ====================
        const workLocs = ["Main Office", "Branch Office", "Remote"];
        const workLocMap = {};
        for (const loc of workLocs) {
            const res = await client.query(
                "INSERT INTO work_locations (location_name, is_active) VALUES ($1, $2) RETURNING id",
                [loc, true]
            );
            workLocMap[loc] = res.rows[0].id;
        }
        console.log("Created work locations");

        // ==================== SHIFTS ====================
        const shifts = [
            { name: "General", start: "09:00:00", end: "18:00:00", late: 15 },
            { name: "Morning", start: "07:00:00", end: "15:00:00", late: 10 },
            { name: "Evening", start: "14:00:00", end: "22:00:00", late: 10 },
            { name: "Night", start: "22:00:00", end: "06:00:00", late: 15 },
        ];

        const shiftMap = {};
        for (const shift of shifts) {
            const res = await client.query(
                "INSERT INTO shifts (name, start_time, end_time, late_after_minutes, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [shift.name, shift.start, shift.end, shift.late, true]
            );
            shiftMap[shift.name] = res.rows[0].id;
        }
        console.log("Created shifts");

        // ==================== LEAVE TYPES ====================
        const leaveTypes = [
            "Annual Leave",
            "Sick Leave",
            "Casual Leave",
            "Maternity Leave",
            "Paternity Leave",
            "Emergency Leave",
            "Unpaid Leave",
        ];

        const leaveTypeMap = {};
        for (const type of leaveTypes) {
            const res = await client.query(
                "INSERT INTO leave_types (name, is_active) VALUES ($1, $2) RETURNING id",
                [type, true]
            );
            leaveTypeMap[type] = res.rows[0].id;
        }
        console.log("Created leave types");

        // ==================== ROLES ====================
        // Super Admin - Global role with NULL department_id (key for is_super_admin)
        const superAdminRoleRes = await client.query(
            "INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id",
            [null, "super_admin", "Global super administrator with full system access"]
        );
        const superAdminRoleId = superAdminRoleRes.rows[0].id;

        // HR Manager Role
        const hrManagerRoleRes = await client.query(
            "INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id",
            [hrDeptId, "hr_manager", "HR Manager with employee and leave management access"]
        );
        const hrManagerRoleId = hrManagerRoleRes.rows[0].id;

        // HR Executive Role
        const hrExecRoleRes = await client.query(
            "INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id",
            [hrDeptId, "hr_executive", "HR Executive with read access and limited write"]
        );
        const hrExecRoleId = hrExecRoleRes.rows[0].id;

        // IT Employee Role
        const itEmployeeRoleRes = await client.query(
            "INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id",
            [itDeptId, "employee", "IT Department Employee"]
        );
        const itEmployeeRoleId = itEmployeeRoleRes.rows[0].id;

        // Finance Employee Role
        const finEmployeeRoleRes = await client.query(
            "INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id",
            [finDeptId, "employee", "Finance Department Employee"]
        );
        const finEmployeeRoleId = finEmployeeRoleRes.rows[0].id;

        // Sales Employee Role
        const salesEmployeeRoleRes = await client.query(
            "INSERT INTO roles (department_id, role_name, description) VALUES ($1, $2, $3) RETURNING id",
            [salesDeptId, "employee", "Sales Department Employee"]
        );
        const salesEmployeeRoleId = salesEmployeeRoleRes.rows[0].id;

        console.log("Created roles");

        // ==================== ROLE PERMISSIONS ====================
        // Super Admin gets all permissions
        for (const permId of Object.values(permissionMap)) {
            await client.query(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
                [superAdminRoleId, permId]
            );
        }

        // HR Manager permissions
        const hrManagerPerms = [
            "config:read",
            "employees:read",
            "employees:write",
            "leave:read",
            "leave:write",
            "leave:approve",
            "attendance:read",
            "attendance:write",
            "calendar:read",
            "calendar:write",
            "notifications:read",
            "notifications:write",
            "alerts:read",
            "pending_actions:read",
            "dashboard:read",
            "directory:read",
            "directory:write",
        ];
        for (const permKey of hrManagerPerms) {
            await client.query(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
                [hrManagerRoleId, permissionMap[permKey]]
            );
        }

        // HR Executive permissions (read-only)
        const hrExecPerms = [
            "config:read",
            "employees:read",
            "leave:read",
            "attendance:read",
            "calendar:read",
            "calendar:write",
            "notifications:read",
            "notifications:write",
            "alerts:read",
            "pending_actions:read",
            "dashboard:read",
            "directory:read",
        ];
        for (const permKey of hrExecPerms) {
            await client.query(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
                [hrExecRoleId, permissionMap[permKey]]
            );
        }

        // Regular Employee permissions
        const employeePerms = [
            "employees:read",
            "leave:write",
            "attendance:read",
            "calendar:read",
            "notifications:read",
            "directory:read",
        ];
        for (const empRoleId of [itEmployeeRoleId, finEmployeeRoleId, salesEmployeeRoleId]) {
            for (const permKey of employeePerms) {
                await client.query(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)",
                    [empRoleId, permissionMap[permKey]]
                );
            }
        }
        console.log("Created role permissions");

        // ==================== EMPLOYEES DATA ====================
        // 1 Super Admin + 10 Regular Employees + 4 HR = 15 Total
        const employees = [
            // Super Admin
            {
                empId: "EMP001",
                name: "Zaid Khan",
                fatherName: "Asif Khan",
                cnic: "42101-1234567-1",
                dob: "1992-08-20",
                email: "zaidbinasif468@gmail.com",
                password: "zaidkhan123",
                roleId: superAdminRoleId,
                deptId: itDeptId,
                desigId: designationMap["System Administrator"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Hybrid"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            // Regular Employees (10)
            {
                empId: "EMP002",
                name: "Huzaifa Kaleem",
                fatherName: "Kaleem Ahmed",
                cnic: "42101-2345678-2",
                dob: "1990-05-15",
                email: "huzaifa.kaleem@company.com",
                password: "password123",
                roleId: itEmployeeRoleId,
                deptId: itDeptId,
                desigId: designationMap["Software Engineer"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Hybrid"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP003",
                name: "Ahmed Ali",
                fatherName: "Mohammad Ali",
                cnic: "42101-3456789-3",
                dob: "1991-03-10",
                email: "ahmed.ali@company.com",
                password: "password123",
                roleId: itEmployeeRoleId,
                deptId: itDeptId,
                desigId: designationMap["Senior Software Engineer"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["On-Site"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP004",
                name: "Sarah Khan",
                fatherName: "Imran Khan",
                cnic: "42101-4567890-4",
                dob: "1993-07-22",
                email: "sarah.khan@company.com",
                password: "password123",
                roleId: itEmployeeRoleId,
                deptId: itDeptId,
                desigId: designationMap["Software Engineer"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Remote"],
                workLoc: workLocMap["Remote"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP005",
                name: "Bilal Hassan",
                fatherName: "Hassan Ahmed",
                cnic: "42101-5678901-5",
                dob: "1994-11-05",
                email: "bilal.hassan@company.com",
                password: "password123",
                roleId: itEmployeeRoleId,
                deptId: itDeptId,
                desigId: designationMap["Team Lead"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Hybrid"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP006",
                name: "Fatima Zahra",
                fatherName: "Ali Zahra",
                cnic: "42101-6789012-6",
                dob: "1995-02-14",
                email: "fatima.zahra@company.com",
                password: "password123",
                roleId: finEmployeeRoleId,
                deptId: finDeptId,
                desigId: designationMap["Finance Manager"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["On-Site"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP007",
                name: "Omar Farooq",
                fatherName: "Farooq Ahmed",
                cnic: "42101-7890123-7",
                dob: "1990-09-30",
                email: "omar.farooq@company.com",
                password: "password123",
                roleId: finEmployeeRoleId,
                deptId: finDeptId,
                desigId: designationMap["Accountant"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["On-Site"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP008",
                name: "Aisha Siddiqui",
                fatherName: "Siddiqui Ahmed",
                cnic: "42101-8901234-8",
                dob: "1992-12-01",
                email: "aisha.siddiqui@company.com",
                password: "password123",
                roleId: salesEmployeeRoleId,
                deptId: salesDeptId,
                desigId: designationMap["Sales Manager"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Hybrid"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP009",
                name: "Usman Ghani",
                fatherName: "Ghani Ahmed",
                cnic: "42101-9012345-9",
                dob: "1993-04-18",
                email: "usman.ghani@company.com",
                password: "password123",
                roleId: salesEmployeeRoleId,
                deptId: salesDeptId,
                desigId: designationMap["Sales Executive"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Hybrid"],
                workLoc: workLocMap["Branch Office"],
                shift: shiftMap["Morning"],
            },
            {
                empId: "EMP010",
                name: "Komal Rizvi",
                fatherName: "Rizvi Ahmed",
                cnic: "42101-0123456-0",
                dob: "1994-06-25",
                email: "komal.rizvi@company.com",
                password: "password123",
                roleId: salesEmployeeRoleId,
                deptId: salesDeptId,
                desigId: designationMap["Sales Executive"],
                empType: empTypeMap["Contract"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Remote"],
                workLoc: workLocMap["Remote"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP011",
                name: "Tariq Mehmood",
                fatherName: "Mehmood Ahmed",
                cnic: "42101-1123456-1",
                dob: "1991-08-08",
                email: "tariq.mehmood@company.com",
                password: "password123",
                roleId: itEmployeeRoleId,
                deptId: itDeptId,
                desigId: designationMap["Software Engineer"],
                empType: empTypeMap["Intern"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["On-Site"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["Morning"],
            },
            // HR Users (4)
            {
                empId: "EMP012",
                name: "Sadia Malik",
                fatherName: "Malik Ahmed",
                cnic: "42101-2123456-2",
                dob: "1988-03-15",
                email: "sadia.malik@company.com",
                password: "password123",
                roleId: hrManagerRoleId,
                deptId: hrDeptId,
                desigId: designationMap["HR Manager"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["On-Site"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP013",
                name: "Imran Shah",
                fatherName: "Shah Ahmed",
                cnic: "42101-3123456-3",
                dob: "1990-11-20",
                email: "imran.shah@company.com",
                password: "password123",
                roleId: hrExecRoleId,
                deptId: hrDeptId,
                desigId: designationMap["HR Executive"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["Hybrid"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP014",
                name: "Nida Parveen",
                fatherName: "Parveen Ahmed",
                cnic: "42101-4123456-4",
                dob: "1992-07-10",
                email: "nida.parveen@company.com",
                password: "password123",
                roleId: hrExecRoleId,
                deptId: hrDeptId,
                desigId: designationMap["HR Executive"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["On-Site"],
                workLoc: workLocMap["Branch Office"],
                shift: shiftMap["General"],
            },
            {
                empId: "EMP015",
                name: "Rashid Khan",
                fatherName: "Khan Ahmed",
                cnic: "42101-5123456-5",
                dob: "1989-12-25",
                email: "rashid.khan@company.com",
                password: "password123",
                roleId: hrManagerRoleId,
                deptId: hrDeptId,
                desigId: designationMap["HR Manager"],
                empType: empTypeMap["Full-Time"],
                jobStatus: jobStatusMap["Active"],
                workMode: workModeMap["On-Site"],
                workLoc: workLocMap["Main Office"],
                shift: shiftMap["General"],
            },
        ];

        // Create employees
        for (const emp of employees) {
            // Employee Info
            await client.query(
                `INSERT INTO employee_info (employee_id, name, father_name, cnic, date_of_birth)
                 VALUES ($1, $2, $3, $4, $5)`,
                [emp.empId, emp.name, emp.fatherName, emp.cnic, emp.dob]
            );

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
                    'father',
                    `Father of ${emp.name}`,
                    `0301-${emp.empId.slice(-3)}0000`,
                    '+92',
                    `father.${emp.empId.toLowerCase()}@example.com`,
                    1
                ]
            );

            // Bank Account
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
            );

            // Medical Info
            await client.query(
                `INSERT INTO employee_medical
                 (employee_id, blood_group, gender, height_cm, weight_kg)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    emp.empId,
                    'O+',
                    emp.name.toLowerCase().includes('sarah') || emp.name.toLowerCase().includes('fatima') || emp.name.toLowerCase().includes('aisha') || emp.name.toLowerCase().includes('komal') || emp.name.toLowerCase().includes('sadia') || emp.name.toLowerCase().includes('nida') ? 'female' : 'male',
                    170,
                    70
                ]
            );


            // Job Info
            await client.query(
                `INSERT INTO job_info
                 (employee_id, department_id, designation_id, employment_type_id, job_status_id,
                  work_mode_id, work_location_id, shift_id, date_of_joining, date_of_exit)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    emp.empId,
                    emp.deptId,
                    emp.desigId,
                    emp.empType,
                    emp.jobStatus,
                    emp.workMode,
                    emp.workLoc,
                    emp.shift,
                    "2023-01-15",
                    null,
                ]
            );

            // User Account with hashed password
            const hashedPassword = await hashPassword(emp.password);
            await client.query(
                `INSERT INTO users (employee_id, email, password, role_id, password_changed_at, must_change_password)
                 VALUES ($1, $2, $3, $4, now(), false)`,
                [emp.empId, emp.email, hashedPassword, emp.roleId]
            );
        }
        console.log("Created 15 employees with users");

        await client.query("COMMIT");
        console.log("\n=== Seed completed successfully! ===");
        console.log("\nSuper Admin Login:");
        console.log("  Email: zaidbinasif468@gmail.com");
        console.log("  Password: zaidkhan123");
        console.log("\nTest User Logins (all use password: 'password123'):");
        console.log("  - huzaifa.kaleem@company.com (IT)");
        console.log("  - sadia.malik@company.com (HR Manager)");
        console.log("  - imran.shah@company.com (HR Executive)");
        console.log("\nDepartments: IT, HR, Finance, Sales");
        console.log("Total Employees: 15 (1 Super Admin + 10 Regular + 4 HR)");
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Seed failed:", err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
