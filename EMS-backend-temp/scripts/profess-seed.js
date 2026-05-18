/**
 * EMS - Production Seed Script
 * ES Module | Node 18+
 *
 * Covers (in FK-safe order):
 *   work_modes → work_locations → employment_types → job_statuses →
 *   shifts → departments → designations → permissions → roles →
 *   role_permissions → employee_info (100) → emergency_contacts, bank, medical →
 *   users → job_info → employee_job_history → leave_types →
 *   leave_policies → leave_balances → leave_capacity_config →
 *   leave_requests → attendance (6 months, realistic patterns) →
 *   calendar_events → notifications → pending_actions → urgent_alerts →
 *   penalty_rules → employee_penalties → directory_entries
 *
 * Run:
 *   TRUNCATE=1 node scripts/profess-seed.js    ← wipe & re-seed
 */

import { Pool } from "pg";
import bcrypt from "bcrypt";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL is not defined in .env");
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const hash = (p) => bcrypt.hash(p, 10);

// ─── helpers ─────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const coin = (p = 0.5) => Math.random() < p;

function getWorkingDays(start, end, holidaySet = new Set()) {
    const days = []; const d = new Date(start); const e = new Date(end);
    while (d <= e) {
        const dow = d.getDay(), iso = d.toISOString().split('T')[0];
        if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) days.push(iso);
        d.setDate(d.getDate() + 1);
    }
    return days;
}

function padTime(h, m) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

// Oct 2025 – Mar 2026 working days
const HOLIDAYS = new Set([
    '2025-10-29', '2025-11-09', '2025-12-25', '2025-12-26',
    '2026-01-01', '2026-02-05', '2026-03-23',
]);
const WORKING_DAYS = getWorkingDays('2025-10-01', '2026-03-31', HOLIDAYS);

// ─── LOOKUP DATA ──────────────────────────────────────────────────────────────
const WORK_MODES_DATA = ['On-site', 'Remote', 'Hybrid'];
const WORK_LOCATIONS_DATA = ['Karachi HQ', 'Lahore Office', 'Islamabad Office', 'Remote'];
const EMP_TYPES_DATA = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Probationary'];
const JOB_STATUSES_DATA = ['Active', 'Probation', 'On Leave', 'Suspended', 'Terminated', 'Resigned'];

const SHIFTS_DATA = [
    { name: 'Morning Shift', start: '09:00:00', end: '18:00:00', late: 15 },
    { name: 'Evening Shift', start: '14:00:00', end: '23:00:00', late: 15 },
    { name: 'Flexible', start: '10:00:00', end: '19:00:00', late: 30 },
];

const DEPARTMENTS_DATA = [
    { code: 'IT', name: 'Information Technology', parent: null },
    { code: 'ITDEV', name: 'Software Development', parent: 'IT' },
    { code: 'ITINF', name: 'IT Infrastructure', parent: 'IT' },
    { code: 'HR', name: 'Human Resources', parent: null },
    { code: 'FIN', name: 'Finance', parent: null },
    { code: 'SALES', name: 'Sales', parent: null },
    { code: 'OPS', name: 'Operations', parent: null },
    { code: 'MKT', name: 'Marketing', parent: null },
    { code: 'ADMIN', name: 'Administration', parent: null },
];

const DESIGNATIONS_DATA = [
    'Chief Executive Officer', 'Chief Technology Officer', 'Chief Financial Officer',
    'HR Manager', 'HR Executive', 'HR Officer', 'HR Assistant',
    'Engineering Manager', 'Senior Software Engineer', 'Software Engineer',
    'Junior Software Engineer', 'DevOps Engineer', 'QA Engineer',
    'IT Infrastructure Manager', 'Systems Administrator', 'Network Engineer', 'IT Support Officer',
    'Finance Manager', 'Senior Accountant', 'Accountant', 'Finance Executive',
    'Sales Manager', 'Senior Sales Executive', 'Sales Executive', 'Sales Officer',
    'Operations Manager', 'Operations Executive', 'Operations Officer',
    'Marketing Manager', 'Marketing Executive', 'Content Writer',
    'Admin Manager', 'Admin Officer', 'Office Coordinator',
];

const LEAVE_TYPES_DATA = [
    { name: 'Annual Leave', days: { default: 15, ITDEV: 18, HR: 15, FIN: 15, SALES: 12, OPS: 14, MKT: 15, ADMIN: 15, ITINF: 16 } },
    { name: 'Sick Leave', days: { default: 10 } },
    { name: 'Casual Leave', days: { default: 6 } },
    { name: 'Maternity Leave', days: { default: 90 } },
    { name: 'Paternity Leave', days: { default: 7 } },
    { name: 'Unpaid Leave', days: { default: 0 } },
];

// ─── PERMISSIONS ──────────────────────────────────────────────────────────────
const PERMISSION_KEYS = [
    ['config:read', 'Read system configuration'],
    ['config:write', 'Write system configuration'],
    ['employees:read', 'Read employee records'],
    ['employees:write', 'Create / update employee records'],
    ['leave:read', 'Read leave requests and balances'],
    ['leave:write', 'Submit and manage leave requests'],
    ['leave:approve', 'Approve or reject leave requests'],
    ['attendance:read', 'Read attendance records'],
    ['attendance:write', 'Create / update attendance records'],
    ['calendar:read', 'Read calendar events'],
    ['calendar:write', 'Create / update calendar events'],
    ['notifications:read', 'Read notifications'],
    ['notifications:write', 'Create / send notifications'],
    ['pending_actions:read', 'Read pending HR actions'],
    ['alerts:read', 'Read urgent alerts dashboard'],
    ['penalties:read', 'Read penalty records'],
    ['penalties:write', 'Create / manage penalties'],
    ['directory:read', 'Read employee directory'],
    ['directory:write', 'Manage employee directory'],
    ['reports:read', 'Read HR analytics and reports'],
];

// role → permission keys
const ROLE_PERMISSION_MAP = {
    super_admin: PERMISSION_KEYS.map(([k]) => k), // all
    hr_manager: [
        'config:read', 'employees:read', 'employees:write',
        'leave:read', 'leave:write', 'leave:approve',
        'attendance:read', 'attendance:write',
        'calendar:read', 'calendar:write',
        'notifications:read', 'notifications:write',
        'pending_actions:read', 'alerts:read',
        'penalties:read', 'penalties:write',
        'directory:read', 'directory:write', 'reports:read',
    ],
    hr_executive: [
        'config:read', 'employees:read',
        'leave:read', 'attendance:read',
        'calendar:read', 'calendar:write',
        'notifications:read', 'notifications:write',
        'pending_actions:read', 'alerts:read',
        'penalties:read', 'directory:read', 'reports:read',
    ],
    employee: [
        'employees:read', 'leave:read', 'leave:write',
        'attendance:read', 'calendar:read',
        'notifications:read', 'directory:read',
    ],
};

// ─── 100 EMPLOYEE DEFINITIONS ────────────────────────────────────────────────
// Fields: employee_id, name, father_name, cnic, dob, gender,
//         dept (code), desig, emp_type, job_status, work_mode, work_loc,
//         shift, doj, manager (employee_id|null), portal_role (null|role_name),
//         att_profile (excellent|good|average|poor), probation_end, contract_end
const EMPLOYEES = [
    // ── IT-DEV (EMP001–EMP025) ──────────────────────────────────────────────
    { id: 'EMP001', name: 'Zaid bin Asif', father: 'Asif Rehman Khan', cnic: '42101-1234501-1', dob: '1988-03-15', g: 'M', dept: 'ITDEV', desig: 'Chief Technology Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2020-01-01', mgr: null, portal: 'super_admin', att: 'excellent' },
    { id: 'EMP002', name: 'Huzaifa Kaleem', father: 'Kaleem Ahmed', cnic: '42201-2345602-3', dob: '1995-07-22', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2023-03-01', mgr: 'EMP006', portal: 'employee', att: 'good' },
    { id: 'EMP003', name: 'Ahmed Ali', father: 'Ali Hassan', cnic: '42301-3456703-5', dob: '1996-11-10', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2023-06-15', mgr: 'EMP006', portal: 'employee', att: 'good' },
    { id: 'EMP004', name: 'Sadia Malik', father: 'Malik Javed', cnic: '42101-4567804-7', dob: '1988-05-18', g: 'F', dept: 'HR', desig: 'HR Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2019-06-01', mgr: 'EMP001', portal: 'hr_manager', att: 'excellent' },
    { id: 'EMP005', name: 'Imran Shah', father: 'Shah Nawaz Ahmed', cnic: '42201-5678905-9', dob: '1992-09-30', g: 'M', dept: 'HR', desig: 'HR Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-01-15', mgr: 'EMP004', portal: 'hr_executive', att: 'good' },
    { id: 'EMP006', name: 'Omar Farooq', father: 'Farooq Ahmed', cnic: '42101-6789006-1', dob: '1985-02-14', g: 'M', dept: 'ITDEV', desig: 'Engineering Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2020-06-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP007', name: 'Bilal Hussain', father: 'Hussain Baig', cnic: '42301-7890107-3', dob: '1990-08-25', g: 'M', dept: 'ITDEV', desig: 'Senior Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-03-01', mgr: 'EMP006', portal: 'employee', att: 'good' },
    { id: 'EMP008', name: 'Usman Tariq', father: 'Tariq Mahmood', cnic: '42101-8901208-5', dob: '1991-12-07', g: 'M', dept: 'ITDEV', desig: 'Senior Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Remote', wl: 'Remote', shift: 'Flexible', doj: '2021-09-15', mgr: 'EMP006', portal: 'employee', att: 'good' },
    { id: 'EMP009', name: 'Farhan Qureshi', father: 'Qureshi Salman', cnic: '42201-9012309-7', dob: '1994-04-19', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-07-01', mgr: 'EMP006', portal: 'employee', att: 'average' },
    { id: 'EMP010', name: 'Saad Anwar', father: 'Anwar Karim', cnic: '42301-0123410-9', dob: '1995-06-30', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-11-01', mgr: 'EMP006', portal: 'employee', att: 'good' },
    { id: 'EMP011', name: 'Talha Rashid', father: 'Rashid Nawaz', cnic: '42101-1234511-1', dob: '1998-01-15', g: 'M', dept: 'ITDEV', desig: 'Junior Software Engineer', emp_type: 'Probationary', status: 'Probation', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2025-08-01', mgr: 'EMP007', portal: 'employee', att: 'average', prob_end: '2026-02-01' },
    { id: 'EMP012', name: 'Danish Mirza', father: 'Mirza Aamir', cnic: '42201-2345612-3', dob: '1997-09-22', g: 'M', dept: 'ITDEV', desig: 'Junior Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2024-02-15', mgr: 'EMP007', portal: 'employee', att: 'good' },
    { id: 'EMP013', name: 'Waleed Khan', father: 'Khan Mushtaq', cnic: '42301-3456713-5', dob: '1993-07-11', g: 'M', dept: 'ITDEV', desig: 'DevOps Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-04-01', mgr: 'EMP006', portal: 'employee', att: 'excellent' },
    { id: 'EMP014', name: 'Yasir Iqbal', father: 'Iqbal Shafiq', cnic: '42101-4567814-7', dob: '1994-03-28', g: 'M', dept: 'ITDEV', desig: 'QA Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-08-15', mgr: 'EMP006', portal: 'employee', att: 'good' },
    { id: 'EMP015', name: 'Hamza Butt', father: 'Butt Zafar', cnic: '42201-5678915-9', dob: '1996-05-03', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Remote', wl: 'Lahore Office', shift: 'Flexible', doj: '2023-01-10', mgr: 'EMP008', portal: 'employee', att: 'good' },
    { id: 'EMP016', name: 'Zeeshan Malik', father: 'Malik Pervez', cnic: '42301-6789016-1', dob: '1989-11-17', g: 'M', dept: 'ITDEV', desig: 'Senior Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Remote', wl: 'Remote', shift: 'Flexible', doj: '2020-09-01', mgr: 'EMP006', portal: 'employee', att: 'good' },
    { id: 'EMP017', name: 'Waqas Ahmed', father: 'Ahmed Bashir', cnic: '42101-7890117-3', dob: '1995-08-09', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2023-05-01', mgr: 'EMP006', portal: 'employee', att: 'average' },
    { id: 'EMP018', name: 'Adnan Shah', father: 'Shah Kamal', cnic: '42201-8901218-5', dob: '1999-02-14', g: 'M', dept: 'ITDEV', desig: 'Junior Software Engineer', emp_type: 'Probationary', status: 'Probation', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2025-10-01', mgr: 'EMP007', portal: 'employee', att: 'average', prob_end: '2026-04-01' },
    { id: 'EMP019', name: 'Mahnoor Siddiqui', father: 'Siddiqui Imran', cnic: '42301-9012319-7', dob: '1997-06-26', g: 'F', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2023-08-01', mgr: 'EMP008', portal: 'employee', att: 'good' },
    { id: 'EMP020', name: 'Atif Abbasi', father: 'Abbasi Naeem', cnic: '42101-0123420-9', dob: '1993-10-05', g: 'M', dept: 'ITDEV', desig: 'QA Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-02-01', mgr: 'EMP006', portal: 'employee', att: 'excellent' },
    { id: 'EMP021', name: 'Irfan Baig', father: 'Baig Zubair', cnic: '42201-1234521-1', dob: '1991-04-18', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Contract', status: 'Active', wm: 'Remote', wl: 'Remote', shift: 'Flexible', doj: '2024-07-01', mgr: 'EMP006', portal: 'employee', att: 'good', contract_end: '2025-06-30' },
    { id: 'EMP022', name: 'Fatima Qureshi', father: 'Qureshi Tariq', cnic: '42301-2345622-3', dob: '1994-12-01', g: 'F', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2023-11-01', mgr: 'EMP007', portal: 'employee', att: 'good' },
    { id: 'EMP023', name: 'Asad Rizvi', father: 'Rizvi Sajjad', cnic: '42101-3456723-5', dob: '1996-03-21', g: 'M', dept: 'ITDEV', desig: 'Software Engineer', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2024-01-15', mgr: 'EMP008', portal: 'employee', att: 'average' },
    { id: 'EMP024', name: 'Nimra Cheema', father: 'Cheema Asif', cnic: '42201-4567824-7', dob: '1998-07-14', g: 'F', dept: 'ITDEV', desig: 'Junior Software Engineer', emp_type: 'Internship', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2025-06-01', mgr: 'EMP014', portal: 'employee', att: 'good' },
    { id: 'EMP025', name: 'Rizwan Cheema', father: 'Cheema Sabir', cnic: '42301-5678925-9', dob: '1993-09-08', g: 'M', dept: 'ITDEV', desig: 'DevOps Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2023-03-15', mgr: 'EMP013', portal: 'employee', att: 'good' },
    // ── IT-INF (EMP026–EMP033) ──────────────────────────────────────────────
    { id: 'EMP026', name: 'Kamran Bajwa', father: 'Bajwa Shahzad', cnic: '42101-6789026-1', dob: '1984-06-10', g: 'M', dept: 'ITINF', desig: 'IT Infrastructure Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2019-03-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP027', name: 'Naveed Bhatti', father: 'Bhatti Maqsood', cnic: '42201-7890127-3', dob: '1990-02-28', g: 'M', dept: 'ITINF', desig: 'Systems Administrator', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-05-01', mgr: 'EMP026', portal: 'employee', att: 'good' },
    { id: 'EMP028', name: 'Shahid Gondal', father: 'Gondal Rafique', cnic: '42301-8901228-5', dob: '1992-11-15', g: 'M', dept: 'ITINF', desig: 'Network Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-02-15', mgr: 'EMP026', portal: 'employee', att: 'good' },
    { id: 'EMP029', name: 'Rashid Lodhi', father: 'Lodhi Amjad', cnic: '42101-9012329-7', dob: '1989-08-20', g: 'M', dept: 'ITINF', desig: 'Systems Administrator', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2020-11-01', mgr: 'EMP026', portal: 'employee', att: 'average' },
    { id: 'EMP030', name: 'Khalid Warsi', father: 'Warsi Saleem', cnic: '42201-0123430-9', dob: '1991-04-05', g: 'M', dept: 'ITINF', desig: 'Network Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2021-08-15', mgr: 'EMP026', portal: 'employee', att: 'good' },
    { id: 'EMP031', name: 'Tariq Ansari', father: 'Ansari Javed', cnic: '42301-1234531-1', dob: '1993-01-12', g: 'M', dept: 'ITINF', desig: 'Systems Administrator', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2022-04-01', mgr: 'EMP026', portal: 'employee', att: 'good' },
    { id: 'EMP032', name: 'Sajid Hashmi', father: 'Hashmi Nasir', cnic: '42101-2345632-3', dob: '1994-07-29', g: 'M', dept: 'ITINF', desig: 'Network Engineer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Evening Shift', doj: '2023-01-01', mgr: 'EMP026', portal: 'employee', att: 'poor' },
    { id: 'EMP033', name: 'Shazia Mirza', father: 'Mirza Azhar', cnic: '42201-3456733-5', dob: '1996-03-17', g: 'F', dept: 'ITINF', desig: 'IT Support Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2024-03-01', mgr: 'EMP026', portal: 'employee', att: 'good' },
    // ── HR (EMP034–EMP041) ──────────────────────────────────────────────────
    { id: 'EMP034', name: 'Rabia Javed', father: 'Javed Mehmood', cnic: '42301-4567834-7', dob: '1990-09-08', g: 'F', dept: 'HR', desig: 'HR Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-07-01', mgr: 'EMP004', portal: 'hr_executive', att: 'good' },
    { id: 'EMP035', name: 'Amna Siddiqui', father: 'Siddiqui Rashid', cnic: '42101-5678935-9', dob: '1993-12-22', g: 'F', dept: 'HR', desig: 'HR Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-09-01', mgr: 'EMP005', portal: 'employee', att: 'good' },
    { id: 'EMP036', name: 'Hina Abbasi', father: 'Abbasi Hafeez', cnic: '42201-6789036-1', dob: '1994-05-14', g: 'F', dept: 'HR', desig: 'HR Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2023-03-15', mgr: 'EMP005', portal: 'employee', att: 'average' },
    { id: 'EMP037', name: 'Saima Baig', father: 'Baig Khalid', cnic: '42301-7890137-3', dob: '1991-02-01', g: 'F', dept: 'HR', desig: 'HR Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2022-06-01', mgr: 'EMP004', portal: 'employee', att: 'good' },
    { id: 'EMP038', name: 'Nadia Rizvi', father: 'Rizvi Qamar', cnic: '42101-8901238-5', dob: '1995-10-17', g: 'F', dept: 'HR', desig: 'HR Assistant', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2024-01-01', mgr: 'EMP005', portal: 'employee', att: 'good' },
    { id: 'EMP039', name: 'Aamir Gillani', father: 'Gillani Shaukat', cnic: '42201-9012339-7', dob: '1988-07-25', g: 'M', dept: 'HR', desig: 'HR Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2019-11-01', mgr: 'EMP004', portal: 'hr_manager', att: 'excellent' },
    { id: 'EMP040', name: 'Bushra Lodhi', father: 'Lodhi Waheed', cnic: '42301-0123440-9', dob: '1993-04-06', g: 'F', dept: 'HR', desig: 'HR Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2022-03-01', mgr: 'EMP039', portal: 'hr_executive', att: 'good' },
    { id: 'EMP041', name: 'Zubair Naqvi', father: 'Naqvi Murtaza', cnic: '42101-1234541-1', dob: '1996-08-11', g: 'M', dept: 'HR', desig: 'HR Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2024-07-15', mgr: 'EMP037', portal: 'employee', att: 'average' },
    // ── FINANCE (EMP042–EMP051) ─────────────────────────────────────────────
    { id: 'EMP042', name: 'Faisal Ansari', father: 'Ansari Khurram', cnic: '42201-2345642-3', dob: '1983-11-30', g: 'M', dept: 'FIN', desig: 'Finance Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2018-04-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP043', name: 'Ayesha Naqvi', father: 'Naqvi Waseem', cnic: '42301-3456743-5', dob: '1990-06-14', g: 'F', dept: 'FIN', desig: 'Senior Accountant', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2020-08-01', mgr: 'EMP042', portal: 'employee', att: 'good' },
    { id: 'EMP044', name: 'Waseem Bajwa', father: 'Bajwa Zulfiqar', cnic: '42101-4567844-7', dob: '1992-03-22', g: 'M', dept: 'FIN', desig: 'Accountant', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-10-01', mgr: 'EMP042', portal: 'employee', att: 'good' },
    { id: 'EMP045', name: 'Nadeem Tarar', father: 'Tarar Idrees', cnic: '42201-5678945-9', dob: '1994-01-08', g: 'M', dept: 'FIN', desig: 'Accountant', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-05-15', mgr: 'EMP042', portal: 'employee', att: 'average' },
    { id: 'EMP046', name: 'Maryam Abbasi', father: 'Abbasi Zahid', cnic: '42301-6789046-1', dob: '1995-09-19', g: 'F', dept: 'FIN', desig: 'Finance Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2023-02-01', mgr: 'EMP042', portal: 'employee', att: 'good' },
    { id: 'EMP047', name: 'Shoaib Warsi', father: 'Warsi Amjad', cnic: '42101-7890147-3', dob: '1991-05-27', g: 'M', dept: 'FIN', desig: 'Senior Accountant', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2020-12-01', mgr: 'EMP042', portal: 'employee', att: 'good' },
    { id: 'EMP048', name: 'Aroha Bhatti', father: 'Bhatti Fareed', cnic: '42201-8901248-5', dob: '1993-07-03', g: 'F', dept: 'FIN', desig: 'Accountant', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-09-15', mgr: 'EMP042', portal: 'employee', att: 'good' },
    { id: 'EMP049', name: 'Junaid Siddiqui', father: 'Siddiqui Tahir', cnic: '42301-9012349-7', dob: '1996-12-11', g: 'M', dept: 'FIN', desig: 'Finance Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2024-04-01', mgr: 'EMP042', portal: 'employee', att: 'average' },
    { id: 'EMP050', name: 'Sidra Hashmi', father: 'Hashmi Bilal', cnic: '42101-0123450-9', dob: '1997-04-16', g: 'F', dept: 'FIN', desig: 'Finance Executive', emp_type: 'Probationary', status: 'Probation', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2025-09-01', mgr: 'EMP043', portal: 'employee', att: 'good', prob_end: '2026-03-01' },
    { id: 'EMP051', name: 'Qasim Gillani', father: 'Gillani Naseer', cnic: '42201-1234551-1', dob: '1989-10-30', g: 'M', dept: 'FIN', desig: 'Finance Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2020-02-15', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    // ── SALES (EMP052–EMP071) ───────────────────────────────────────────────
    { id: 'EMP052', name: 'Tahira Aslam', father: 'Aslam Shahid', cnic: '42301-2345652-3', dob: '1985-08-07', g: 'F', dept: 'SALES', desig: 'Sales Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2018-09-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP053', name: 'Shahzad Mirza', father: 'Mirza Asim', cnic: '42101-3456753-5', dob: '1990-03-15', g: 'M', dept: 'SALES', desig: 'Senior Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2020-05-01', mgr: 'EMP052', portal: 'employee', att: 'good' },
    { id: 'EMP054', name: 'Uzma Sheikh', father: 'Sheikh Iftikhar', cnic: '42201-4567854-7', dob: '1992-11-22', g: 'F', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-08-01', mgr: 'EMP052', portal: 'employee', att: 'good' },
    { id: 'EMP055', name: 'Kamran Raza', father: 'Raza Farhan', cnic: '42301-5678955-9', dob: '1993-07-19', g: 'M', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2022-01-15', mgr: 'EMP052', portal: 'employee', att: 'average' },
    { id: 'EMP056', name: 'Mudassar Lodhi', father: 'Lodhi Danish', cnic: '42101-6789056-1', dob: '1991-05-04', g: 'M', dept: 'SALES', desig: 'Senior Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2020-10-01', mgr: 'EMP052', portal: 'employee', att: 'good' },
    { id: 'EMP057', name: 'Sundas Cheema', father: 'Cheema Umar', cnic: '42201-7890157-3', dob: '1994-09-27', g: 'F', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2022-06-01', mgr: 'EMP052', portal: 'employee', att: 'good' },
    { id: 'EMP058', name: 'Omer Aslam', father: 'Aslam Nasir', cnic: '42301-8901258-5', dob: '1995-02-13', g: 'M', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2023-04-01', mgr: 'EMP052', portal: 'employee', att: 'average' },
    { id: 'EMP059', name: 'Lubna Gondal', father: 'Gondal Shakeel', cnic: '42101-9012359-7', dob: '1988-12-05', g: 'F', dept: 'SALES', desig: 'Sales Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2019-07-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP060', name: 'Yasmin Warsi', father: 'Warsi Ataur', cnic: '42201-0123460-9', dob: '1992-04-28', g: 'F', dept: 'SALES', desig: 'Senior Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2021-03-01', mgr: 'EMP059', portal: 'employee', att: 'good' },
    { id: 'EMP061', name: 'Ahsan Bhatti', father: 'Bhatti Arshad', cnic: '42301-1234561-1', dob: '1993-10-09', g: 'M', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-11-01', mgr: 'EMP059', portal: 'employee', att: 'good' },
    { id: 'EMP062', name: 'Afshan Tarar', father: 'Tarar Shahbaz', cnic: '42101-2345662-3', dob: '1996-06-16', g: 'F', dept: 'SALES', desig: 'Sales Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2024-02-01', mgr: 'EMP053', portal: 'employee', att: 'average' },
    { id: 'EMP063', name: 'Saad Butt', father: 'Butt Wajid', cnic: '42201-3456763-5', dob: '1997-01-24', g: 'M', dept: 'SALES', desig: 'Sales Officer', emp_type: 'Probationary', status: 'Probation', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2025-11-01', mgr: 'EMP056', portal: 'employee', att: 'poor', prob_end: '2026-05-01' },
    { id: 'EMP064', name: 'Waleed Chaudhry', father: 'Chaudhry Zahid', cnic: '42301-4567864-7', dob: '1994-08-31', g: 'M', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2022-09-01', mgr: 'EMP057', portal: 'employee', att: 'good' },
    { id: 'EMP065', name: 'Iqra Siddiqui', father: 'Siddiqui Ahsan', cnic: '42101-5678965-9', dob: '1995-05-07', g: 'F', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2023-07-01', mgr: 'EMP057', portal: 'employee', att: 'good' },
    { id: 'EMP066', name: 'Danish Qureshi', father: 'Qureshi Zafar', cnic: '42201-6789066-1', dob: '1991-03-19', g: 'M', dept: 'SALES', desig: 'Senior Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-01-01', mgr: 'EMP052', portal: 'employee', att: 'good' },
    { id: 'EMP067', name: 'Farah Ansari', father: 'Ansari Sabir', cnic: '42301-7890167-3', dob: '1992-09-12', g: 'F', dept: 'SALES', desig: 'Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-03-15', mgr: 'EMP052', portal: 'employee', att: 'average' },
    { id: 'EMP068', name: 'Zainab Mirza', father: 'Mirza Aamir', cnic: '42101-8901268-5', dob: '1994-11-28', g: 'F', dept: 'SALES', desig: 'Sales Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2024-06-01', mgr: 'EMP060', portal: 'employee', att: 'good' },
    { id: 'EMP069', name: 'Babar Malik', father: 'Malik Jamil', cnic: '42201-9012369-7', dob: '1987-06-14', g: 'M', dept: 'SALES', desig: 'Sales Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2019-03-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP070', name: 'Shazia Butt', father: 'Butt Pervaiz', cnic: '42301-0123470-9', dob: '1993-02-06', g: 'F', dept: 'SALES', desig: 'Senior Sales Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2021-05-15', mgr: 'EMP069', portal: 'employee', att: 'good' },
    { id: 'EMP071', name: 'Hassan Lodhi', father: 'Lodhi Mukhtar', cnic: '42101-1234571-1', dob: '1996-07-21', g: 'M', dept: 'SALES', desig: 'Sales Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2024-09-01', mgr: 'EMP069', portal: 'employee', att: 'average' },
    // ── OPERATIONS (EMP072–EMP086) ──────────────────────────────────────────
    { id: 'EMP072', name: 'Rehman Abbasi', father: 'Abbasi Khalid', cnic: '42201-2345672-3', dob: '1984-04-17', g: 'M', dept: 'OPS', desig: 'Operations Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2018-07-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP073', name: 'Sana Hashmi', father: 'Hashmi Asif', cnic: '42301-3456773-5', dob: '1990-11-03', g: 'F', dept: 'OPS', desig: 'Operations Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2020-09-01', mgr: 'EMP072', portal: 'employee', att: 'good' },
    { id: 'EMP074', name: 'Tariq Gillani', father: 'Gillani Aamir', cnic: '42101-4567874-7', dob: '1992-06-25', g: 'M', dept: 'OPS', desig: 'Operations Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-11-01', mgr: 'EMP072', portal: 'employee', att: 'average' },
    { id: 'EMP075', name: 'Mehwish Raza', father: 'Raza Wajid', cnic: '42201-5678975-9', dob: '1993-09-14', g: 'F', dept: 'OPS', desig: 'Operations Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-07-01', mgr: 'EMP072', portal: 'employee', att: 'good' },
    { id: 'EMP076', name: 'Mushtaq Ahmed', father: 'Ahmed Riaz', cnic: '42301-6789076-1', dob: '1988-02-08', g: 'M', dept: 'OPS', desig: 'Operations Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2019-04-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP077', name: 'Nida Siddiqui', father: 'Siddiqui Omar', cnic: '42101-7890177-3', dob: '1994-05-31', g: 'F', dept: 'OPS', desig: 'Operations Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2022-02-15', mgr: 'EMP076', portal: 'employee', att: 'good' },
    { id: 'EMP078', name: 'Rizwan Tarar', father: 'Tarar Arshad', cnic: '42201-8901278-5', dob: '1995-10-20', g: 'M', dept: 'OPS', desig: 'Operations Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2023-08-01', mgr: 'EMP076', portal: 'employee', att: 'average' },
    { id: 'EMP079', name: 'Soha Bajwa', father: 'Bajwa Munawar', cnic: '42301-9012379-7', dob: '1997-03-06', g: 'F', dept: 'OPS', desig: 'Operations Officer', emp_type: 'Probationary', status: 'Probation', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2025-07-01', mgr: 'EMP076', portal: 'employee', att: 'good', prob_end: '2026-01-01' },
    { id: 'EMP080', name: 'Arif Nawaz', father: 'Nawaz Habib', cnic: '42101-0123480-9', dob: '1986-08-14', g: 'M', dept: 'OPS', desig: 'Operations Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2019-09-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP081', name: 'Rukhsana Khan', father: 'Khan Bashir', cnic: '42201-1234581-1', dob: '1991-01-26', g: 'F', dept: 'OPS', desig: 'Operations Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2021-06-01', mgr: 'EMP080', portal: 'employee', att: 'good' },
    { id: 'EMP082', name: 'Adeel Shah', father: 'Shah Waheed', cnic: '42301-2345682-3', dob: '1993-04-10', g: 'M', dept: 'OPS', desig: 'Operations Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2022-10-15', mgr: 'EMP080', portal: 'employee', att: 'poor' },
    { id: 'EMP083', name: 'Shahla Qureshi', father: 'Qureshi Waqar', cnic: '42101-3456783-5', dob: '1994-12-18', g: 'F', dept: 'OPS', desig: 'Operations Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Evening Shift', doj: '2023-05-01', mgr: 'EMP072', portal: 'employee', att: 'average' },
    { id: 'EMP084', name: 'Saiful Islam', father: 'Islam Rafiq', cnic: '42201-4567884-7', dob: '1990-07-08', g: 'M', dept: 'OPS', desig: 'Operations Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-04-01', mgr: 'EMP072', portal: 'employee', att: 'average' },
    { id: 'EMP085', name: 'Razia Ansari', father: 'Ansari Irfan', cnic: '42301-5678985-9', dob: '1996-09-03', g: 'F', dept: 'OPS', desig: 'Operations Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2024-05-01', mgr: 'EMP072', portal: 'employee', att: 'good' },
    { id: 'EMP086', name: 'Hamid Bhatti', father: 'Bhatti Safdar', cnic: '42101-6789086-1', dob: '1989-11-27', g: 'M', dept: 'OPS', desig: 'Operations Executive', emp_type: 'Full-time', status: 'On Leave', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2020-03-15', mgr: 'EMP072', portal: 'employee', att: 'average' },
    // ── MARKETING (EMP087–EMP094) ────────────────────────────────────────────
    { id: 'EMP087', name: 'Noman Akhtar', father: 'Akhtar Farooq', cnic: '42201-7890187-3', dob: '1986-03-22', g: 'M', dept: 'MKT', desig: 'Marketing Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2019-01-07', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP088', name: 'Shaista Chaudhry', father: 'Chaudhry Mujtaba', cnic: '42301-8901288-5', dob: '1991-07-15', g: 'F', dept: 'MKT', desig: 'Marketing Executive', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-08-01', mgr: 'EMP087', portal: 'employee', att: 'good' },
    { id: 'EMP089', name: 'Farhan Ali', father: 'Ali Shehzad', cnic: '42101-9012389-7', dob: '1993-05-09', g: 'M', dept: 'MKT', desig: 'Marketing Executive', emp_type: 'Full-time', status: 'Active', wm: 'Hybrid', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2022-04-01', mgr: 'EMP087', portal: 'employee', att: 'good' },
    { id: 'EMP090', name: 'Aisha Gondal', father: 'Gondal Javed', cnic: '42201-0123490-9', dob: '1994-01-31', g: 'F', dept: 'MKT', desig: 'Content Writer', emp_type: 'Full-time', status: 'Active', wm: 'Remote', wl: 'Remote', shift: 'Flexible', doj: '2023-02-15', mgr: 'EMP087', portal: 'employee', att: 'good' },
    { id: 'EMP091', name: 'Bilal Cheema', father: 'Cheema Sajid', cnic: '42301-1234591-1', dob: '1995-10-24', g: 'M', dept: 'MKT', desig: 'Marketing Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2023-09-01', mgr: 'EMP087', portal: 'employee', att: 'average' },
    { id: 'EMP092', name: 'Saira Warsi', father: 'Warsi Babar', cnic: '42101-2345692-3', dob: '1992-08-17', g: 'F', dept: 'MKT', desig: 'Marketing Executive', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2022-07-15', mgr: 'EMP087', portal: 'employee', att: 'good' },
    { id: 'EMP093', name: 'Usman Siddiqui', father: 'Siddiqui Imtiaz', cnic: '42201-3456793-5', dob: '1996-04-05', g: 'M', dept: 'MKT', desig: 'Content Writer', emp_type: 'Contract', status: 'Active', wm: 'Remote', wl: 'Remote', shift: 'Flexible', doj: '2024-11-01', mgr: 'EMP087', portal: 'employee', att: 'good', contract_end: '2025-10-31' },
    { id: 'EMP094', name: 'Tahira Baig', father: 'Baig Noman', cnic: '42301-4567894-7', dob: '1990-12-29', g: 'F', dept: 'MKT', desig: 'Marketing Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2020-05-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    // ── ADMIN (EMP095–EMP100) ────────────────────────────────────────────────
    { id: 'EMP095', name: 'Jameel Khan', father: 'Khan Rehmat', cnic: '42101-5678995-9', dob: '1982-09-01', g: 'M', dept: 'ADMIN', desig: 'Admin Manager', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2017-06-01', mgr: 'EMP001', portal: 'employee', att: 'excellent' },
    { id: 'EMP096', name: 'Samina Javed', father: 'Javed Ameer', cnic: '42201-6789096-1', dob: '1990-06-22', g: 'F', dept: 'ADMIN', desig: 'Admin Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-02-01', mgr: 'EMP095', portal: 'employee', att: 'good' },
    { id: 'EMP097', name: 'Rasheed Chaudhry', father: 'Chaudhry Ghulam', cnic: '42301-7890197-3', dob: '1986-11-14', g: 'M', dept: 'ADMIN', desig: 'Admin Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Lahore Office', shift: 'Morning Shift', doj: '2019-08-15', mgr: 'EMP095', portal: 'employee', att: 'good' },
    { id: 'EMP098', name: 'Nadia Hashmi', father: 'Hashmi Tariq', cnic: '42101-8901298-5', dob: '1993-03-18', g: 'F', dept: 'ADMIN', desig: 'Office Coordinator', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2022-08-01', mgr: 'EMP095', portal: 'employee', att: 'good' },
    { id: 'EMP099', name: 'Furqan Malik', father: 'Malik Tahir', cnic: '42201-9012399-7', dob: '1991-07-06', g: 'M', dept: 'ADMIN', desig: 'Admin Officer', emp_type: 'Full-time', status: 'Active', wm: 'On-site', wl: 'Karachi HQ', shift: 'Morning Shift', doj: '2021-11-15', mgr: 'EMP095', portal: 'employee', att: 'average' },
    { id: 'EMP100', name: 'Huma Abbasi', father: 'Abbasi Fahim', cnic: '42301-0123500-9', dob: '1994-05-14', g: 'F', dept: 'ADMIN', desig: 'Office Coordinator', emp_type: 'Probationary', status: 'Probation', wm: 'On-site', wl: 'Islamabad Office', shift: 'Morning Shift', doj: '2025-12-01', mgr: 'EMP095', portal: 'employee', att: 'average', prob_end: '2026-06-01' },
];

// users with portal accounts (portal_role != null)
const PORTAL_EMPLOYEES = EMPLOYEES.filter(e => e.portal);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── TRUNCATE ──────────────────────────────────────────────────────────────
        console.log('Truncating tables…');
        await client.query(`
      TRUNCATE
        activity_logs, audit_logs, directory_entries,
        employee_penalties, penalty_rules,
        urgent_alerts, pending_actions, notifications, calendar_events,
        leave_requests, leave_balances, leave_capacity_config, leave_policies,
        attendance, employee_job_history, job_info,
        users, emergency_contacts, employee_bank_accounts, employee_medical, employee_info,
        role_permissions, permissions, roles,
        leave_types, shifts, designations,
        departments, employment_types, job_statuses,
        work_locations, work_modes
      RESTART IDENTITY CASCADE
    `);


        // ── 1. WORK MODES ─────────────────────────────────────────────────────────
        console.log('Seeding work_modes…');
        const wmRows = await client.query(
            `INSERT INTO work_modes (mode_name) SELECT unnest($1::text[]) RETURNING id, mode_name`,
            [WORK_MODES_DATA]
        );
        const WM = Object.fromEntries(wmRows.rows.map(r => [r.mode_name, r.id]));

        // ── 2. WORK LOCATIONS ─────────────────────────────────────────────────────
        console.log('Seeding work_locations…');
        const wlRows = await client.query(
            `INSERT INTO work_locations (location_name) SELECT unnest($1::text[]) RETURNING id, location_name`,
            [WORK_LOCATIONS_DATA]
        );
        const WL = Object.fromEntries(wlRows.rows.map(r => [r.location_name, r.id]));

        // ── 3. EMPLOYMENT TYPES ───────────────────────────────────────────────────
        console.log('Seeding employment_types…');
        const etRows = await client.query(
            `INSERT INTO employment_types (type_name) SELECT unnest($1::text[]) RETURNING id, type_name`,
            [EMP_TYPES_DATA]
        );
        const ET = Object.fromEntries(etRows.rows.map(r => [r.type_name, r.id]));

        // ── 4. JOB STATUSES ───────────────────────────────────────────────────────
        console.log('Seeding job_statuses…');
        const jsRows = await client.query(
            `INSERT INTO job_statuses (status_name) SELECT unnest($1::text[]) RETURNING id, status_name`,
            [JOB_STATUSES_DATA]
        );
        const JS = Object.fromEntries(jsRows.rows.map(r => [r.status_name, r.id]));

        // ── 5. SHIFTS ─────────────────────────────────────────────────────────────
        console.log('Seeding shifts…');
        const shiftRows = await client.query(
            `INSERT INTO shifts (name, start_time, end_time, late_after_minutes)
       VALUES ($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12)
       RETURNING id, name`,
            SHIFTS_DATA.flatMap(s => [s.name, s.start, s.end, s.late])
        );
        const SH = Object.fromEntries(shiftRows.rows.map(r => [r.name, r.id]));

        // ── 6. DEPARTMENTS (two-pass for parent refs) ─────────────────────────────
        console.log('Seeding departments…');
        const DEPT = {};
        // pass 1: no parent
        for (const d of DEPARTMENTS_DATA.filter(d => !d.parent)) {
            const r = await client.query(
                `INSERT INTO departments (department_code, department_name) VALUES ($1,$2) RETURNING id`,
                [d.code, d.name]
            );
            DEPT[d.code] = r.rows[0].id;
        }
        // pass 2: with parent
        for (const d of DEPARTMENTS_DATA.filter(d => d.parent)) {
            const r = await client.query(
                `INSERT INTO departments (department_code, department_name, parent_department_id) VALUES ($1,$2,$3) RETURNING id`,
                [d.code, d.name, DEPT[d.parent]]
            );
            DEPT[d.code] = r.rows[0].id;
        }

        // ── 7. DESIGNATIONS ───────────────────────────────────────────────────────
        console.log('Seeding designations…');
        const desigRows = await client.query(
            `INSERT INTO designations (title) SELECT unnest($1::text[]) RETURNING id, title`,
            [DESIGNATIONS_DATA]
        );
        const DES = Object.fromEntries(desigRows.rows.map(r => [r.title, r.id]));

        // ── 8. PERMISSIONS ────────────────────────────────────────────────────────
        console.log('Seeding permissions…');
        const permValues = PERMISSION_KEYS.map((_, i) =>
            `($${i * 2 + 1}, $${i * 2 + 2})`
        ).join(',');
        const permRes = await client.query(
            `INSERT INTO permissions (permission_key, description) VALUES ${permValues} RETURNING id, permission_key`,
            PERMISSION_KEYS.flat()
        );
        const PERM = Object.fromEntries(permRes.rows.map(r => [r.permission_key, r.id]));

        // ── 9. ROLES ──────────────────────────────────────────────────────────────
        console.log('Seeding roles…');
        const ROLE = {};
        // Core roles per dept
        const roleDefs = [
            { name: 'super_admin', dept: 'ITDEV', desc: 'Full system access' },
            { name: 'hr_manager', dept: 'HR', desc: 'HR management access' },
            { name: 'hr_executive', dept: 'HR', desc: 'HR executive access' },
            // employee role for every dept
            ...['ITDEV', 'ITINF', 'HR', 'FIN', 'SALES', 'OPS', 'MKT', 'ADMIN'].map(d => ({
                name: 'employee', dept: d, desc: 'Standard employee portal access'
            })),
        ];
        for (const rd of roleDefs) {
            const r = await client.query(
                `INSERT INTO roles (department_id, role_name, description) VALUES ($1,$2,$3)
         ON CONFLICT (department_id, role_name) DO NOTHING RETURNING id`,
                [DEPT[rd.dept], rd.name, rd.desc]
            );
            const id = r.rows[0]?.id;
            if (id) ROLE[`${rd.name}_${rd.dept}`] = id;
        }
        // Retrieve all roles for lookups
        const allRoles = await client.query(`SELECT id, role_name, department_id FROM roles`);
        for (const r of allRoles.rows) {
            const deptCode = Object.entries(DEPT).find(([, id]) => id === r.department_id)?.[0];
            ROLE[`${r.role_name}_${deptCode}`] = r.id;
        }

        // ── 10. ROLE_PERMISSIONS ─────────────────────────────────────────────────
        console.log('Seeding role_permissions…');
        for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
            // Find all role IDs matching this role name
            const matchingRoleIds = Object.entries(ROLE)
                .filter(([k]) => k.startsWith(`${roleName}_`))
                .map(([, v]) => v);

            for (const roleId of matchingRoleIds) {
                for (const pk of permKeys) {
                    if (!PERM[pk]) continue;
                    await client.query(
                        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                        [roleId, PERM[pk]]
                    );
                }
            }
        }

        // ── 11. EMPLOYEE_INFO (100 employees) ────────────────────────────────────
        console.log('Seeding employee_info (100 employees)…');
        for (const e of EMPLOYEES) {
            await client.query(
                `INSERT INTO employee_info (employee_id, name, father_name, cnic, date_of_birth)
         VALUES ($1,$2,$3,$4,$5)`,
                [e.id, e.name, e.father, e.cnic, e.dob]
            );
        }

        // ── 12. EXTRA INFO (Emergency, Bank, Medical) ───────────────────────────
        console.log('Seeding split extra info (Emergency, Bank, Medical)…');
        const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Hyderabad', 'Multan', 'Faisalabad', 'Quetta'];
        const BANKS = ['HBL', 'UBL', 'MCB', 'ABL', 'Meezan Bank', 'Bank Al Falah', 'Bank Al Habib', 'Faysal Bank', 'SCB'];
        const RELATIONS = ['father', 'mother', 'brother', 'sister', 'wife', 'husband', 'son', 'daughter', 'friend', 'neighbor', 'other'];
        const BLOODS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

        for (let i = 0; i < EMPLOYEES.length; i++) {
            const e = EMPLOYEES[i];
            const idx = i + 1;
            const city = CITIES[i % CITIES.length];
            const bank = coin(0.85) ? BANKS[i % BANKS.length] : null;

            // Emergency Contacts
            await client.query(
                `INSERT INTO emergency_contacts
           (employee_id, contact_1, contact_2, perment_address, postal_address, 
            e_contact_1_relation, e_contact_1_full_name, e_contact_1_phone, 
            e_contact_1_phone_country_code, e_contact_1_email, primary_contact)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [
                    e.id,
                    `0300-${String(idx).padStart(7, '0')}`,
                    coin(0.6) ? `0312-${String(idx + 5000).padStart(7, '0')}` : null,
                    `House ${idx}, Block ${String.fromCharCode(65 + (i % 10))}, ${city}`,
                    coin(0.7) ? `House ${idx}, Block ${String.fromCharCode(65 + (i % 10))}, ${city}` : `P.O. Box ${idx}, ${city}`,
                    pick(RELATIONS),
                    `Emergency Contact ${idx}`,
                    `0321-${String(idx + 10000).padStart(7, '0')}`,
                    '+92',
                    `emergency${idx}@example.com`,
                    1
                ]
            );

            // Bank Account
            if (bank) {
                await client.query(
                    `INSERT INTO employee_bank_accounts
             (employee_id, bank_name, branch_name, branch_code, iban, account_title, account_number, account_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [
                        e.id,
                        bank,
                        'Main Branch',
                        '001',
                        `PK${rand(10, 99)}${bank.slice(0, 4).toUpperCase()}${String(idx).padStart(14, '0')}`,
                        e.name,
                        String(rand(100000000, 999999999)),
                        'salary'
                    ]
                );
            }

            // Medical Info
            await client.query(
                `INSERT INTO employee_medical
           (employee_id, blood_group, gender, height_cm, weight_kg)
         VALUES ($1,$2,$3,$4,$5)`,
                [
                    e.id,
                    pick(BLOODS),
                    e.g === 'M' ? 'male' : 'female',
                    rand(150, 190),
                    rand(50, 100)
                ]
            );
        }


        // ── 13. USERS ─────────────────────────────────────────────────────────────
        console.log('Seeding users…');
        const USER = {}; // employee_id → user uuid

        // Password map: super_admin gets special pass, rest get password123
        const passwordMap = {
            'EMP001': 'zaidkhan123',
        };
        const defaultPass = 'password123';

        for (const e of PORTAL_EMPLOYEES) {
            const roleName = e.portal;
            const deptCode = e.dept;
            const roleKey = `${roleName}_${deptCode}`;
            const roleId = ROLE[roleKey] ?? null;

            const emailFirst = e.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
            // Special emails for security test targets
            const emailMap = {
                'EMP001': 'zaidbinasif468@gmail.com',
                'EMP002': 'huzaifa.kaleem@company.com',
                'EMP003': 'ahmed.ali@company.com',
                'EMP004': 'sadia.malik@company.com',
                'EMP005': 'imran.shah@company.com',
                'EMP034': 'rabia.javed@company.com',
                'EMP039': 'aamir.gillani@company.com',
                'EMP040': 'bushra.lodhi@company.com',
            };
            const email = emailMap[e.id] ?? `${emailFirst}@company.com`;
            const pwd = passwordMap[e.id] ?? defaultPass;
            const hashed = await hash(pwd);

            const r = await client.query(
                `INSERT INTO users (employee_id, email, password, role_id, must_change_password, password_changed_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                [e.id, email, hashed, roleId, false, new Date('2024-01-01')]
            );
            USER[e.id] = r.rows[0].id;
        }

        const SA_USER_ID = USER['EMP001'];
        const HRM_USER_ID = USER['EMP004'];
        const HRE_USER_ID = USER['EMP005'];

        // ── 14. JOB_INFO ──────────────────────────────────────────────────────────
        console.log('Seeding job_info…');
        for (const e of EMPLOYEES) {
            await client.query(
                `INSERT INTO job_info
           (employee_id, department_id, designation_id, employment_type_id, job_status_id,
            work_mode_id, work_location_id, shift_id, date_of_joining, date_of_exit,
            probation_end_date, contract_end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                [
                    e.id,
                    DEPT[e.dept],
                    DES[e.desig],
                    ET[e.emp_type],
                    JS[e.status],
                    WM[e.wm],
                    WL[e.wl],
                    SH[e.shift],
                    e.doj,
                    null, // no exits
                    e.prob_end ?? null,
                    e.contract_end ?? null,
                ]
            );
        }

        // ── 15. EMPLOYEE_JOB_HISTORY (30% of employees have history) ─────────────
        console.log('Seeding employee_job_history…');
        const historyEmps = EMPLOYEES.filter((_, i) => i % 3 === 0 && i > 0);
        for (const e of historyEmps) {
            // Previous role: one level lower in same dept, 2-3 years back
            const prevStartDate = new Date(e.doj);
            prevStartDate.setFullYear(prevStartDate.getFullYear() - rand(2, 4));
            const prevEndDate = new Date(e.doj);
            prevEndDate.setDate(prevEndDate.getDate() - 1);

            const lowerDesigs = {
                'Engineering Manager': 'Senior Software Engineer',
                'Senior Software Engineer': 'Software Engineer',
                'Software Engineer': 'Junior Software Engineer',
                'IT Infrastructure Manager': 'Systems Administrator',
                'HR Manager': 'HR Executive',
                'HR Executive': 'HR Officer',
                'Finance Manager': 'Senior Accountant',
                'Senior Accountant': 'Accountant',
                'Sales Manager': 'Senior Sales Executive',
                'Senior Sales Executive': 'Sales Executive',
                'Operations Manager': 'Operations Executive',
                'Marketing Manager': 'Marketing Executive',
            };
            const prevDesig = lowerDesigs[e.desig] ?? e.desig;
            if (!DES[prevDesig]) continue;

            await client.query(
                `INSERT INTO employee_job_history
           (employee_id, department_id, designation_id, manager_emp_id, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    e.id,
                    DEPT[e.dept],
                    DES[prevDesig],
                    e.mgr,
                    prevStartDate.toISOString().split('T')[0],
                    prevEndDate.toISOString().split('T')[0],
                ]
            );
        }

        // ── 16. LEAVE TYPES ───────────────────────────────────────────────────────
        console.log('Seeding leave_types…');
        const LT = {};
        for (const lt of LEAVE_TYPES_DATA) {
            const r = await client.query(
                `INSERT INTO leave_types (name) VALUES ($1) RETURNING id`,
                [lt.name]
            );
            LT[lt.name] = { id: r.rows[0].id, days: lt.days };
        }

        // ── 17. LEAVE_POLICIES (per dept per leave type, 2025 & 2026) ────────────
        console.log('Seeding leave_policies…');
        const targetDepts = ['ITDEV', 'ITINF', 'HR', 'FIN', 'SALES', 'OPS', 'MKT', 'ADMIN'];
        for (const year of [2025, 2026]) {
            for (const deptCode of targetDepts) {
                for (const lt of LEAVE_TYPES_DATA) {
                    const days = lt.days[deptCode] ?? lt.days['default'];
                    await client.query(
                        `INSERT INTO leave_policies (department_id, leave_type_id, days_allowed, year)
             VALUES ($1,$2,$3,$4) ON CONFLICT ON CONSTRAINT unique_policy_per_type_year DO NOTHING`,
                        [DEPT[deptCode], LT[lt.name].id, days, year]
                    );
                }
            }
        }

        // ── 18. LEAVE_CAPACITY_CONFIG ─────────────────────────────────────────────
        console.log('Seeding leave_capacity_config…');
        for (const deptCode of targetDepts) {
            await client.query(
                `INSERT INTO leave_capacity_config (department_id, max_percent, created_by)
         VALUES ($1,$2,$3) ON CONFLICT (department_id) DO NOTHING`,
                [DEPT[deptCode], 50, SA_USER_ID]
            );
        }

        // ── 19. LEAVE_BALANCES (all employees, all leave types, 2025 & 2026) ──────
        console.log('Seeding leave_balances…');
        for (const e of EMPLOYEES) {
            const deptCode = e.dept;
            for (const year of [2025, 2026]) {
                for (const lt of LEAVE_TYPES_DATA) {
                    const allowed = lt.days[deptCode] ?? lt.days['default'];
                    // Realistic used days: random 0..allowed (2025 mostly consumed, 2026 partial)
                    let used = 0;
                    if (year === 2025) {
                        used = rand(0, Math.min(allowed, allowed > 0 ? Math.floor(allowed * 0.8) : 0));
                    } else {
                        used = rand(0, Math.min(allowed, allowed > 0 ? Math.floor(allowed * 0.3) : 0));
                    }
                    const balance = Math.max(0, allowed - used);
                    await client.query(
                        `INSERT INTO leave_balances (employee_id, leave_type_id, year, balance, used)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT ON CONSTRAINT unique_balance DO NOTHING`,
                        [e.id, LT[lt.name].id, year, balance, used]
                    );
                }
            }
        }

        // ── 20. LEAVE_REQUESTS (realistic: ~65% of employees have leaves) ─────────
        console.log('Seeding leave_requests…');
        const leaveEmployees = EMPLOYEES.filter((_, i) => i % 3 !== 1 || i < 10);
        const leaveStatuses = ['approved', 'approved', 'approved', 'pending', 'rejected', 'cancelled'];

        for (const e of leaveEmployees) {
            const numLeaves = rand(1, 4);
            for (let n = 0; n < numLeaves; n++) {
                // random date in 2025
                const startMo = rand(1, 11);
                const startDay = rand(1, 20);
                const startDate = `2025-${String(startMo).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
                const durationDays = rand(1, 5);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + durationDays - 1);
                const endDateStr = endDate.toISOString().split('T')[0];

                const ltName = pick(Object.keys(LT));
                const status = pick(leaveStatuses);
                const reviewerUserId = pick([HRM_USER_ID, HRE_USER_ID, USER['EMP034'] ?? HRM_USER_ID].filter(Boolean));

                await client.query(
                    `INSERT INTO leave_requests
             (employee_id, leave_type_id, start_date, end_date, reason, status, reviewed_by, reviewed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [
                        e.id,
                        LT[ltName].id,
                        startDate,
                        endDateStr,
                        pick([
                            'Family event requiring travel',
                            'Medical appointment and recovery',
                            'Personal matters requiring attention',
                            'Annual vacation',
                            'Child school admission',
                            'Home relocation',
                            'Religious observance',
                            'Out-of-city emergency',
                            null,
                        ]),
                        status,
                        status !== 'pending' ? reviewerUserId : null,
                        status !== 'pending' ? new Date(`2025-${String(startMo).padStart(2, '0')}-05`) : null,
                    ]
                );
            }
        }

        // ── 21. ATTENDANCE (Oct 2025 – Mar 2026, realistic patterns) ─────────────
        console.log(`Seeding attendance (${WORKING_DAYS.length} working days × 100 employees)…`);

        const attProfile = {
            excellent: { presentRate: 0.97, lateRate: 0.02, halfDayRate: 0.01, absentRate: 0.00 },
            good: { presentRate: 0.88, lateRate: 0.06, halfDayRate: 0.03, absentRate: 0.03 },
            average: { presentRate: 0.75, lateRate: 0.10, halfDayRate: 0.05, absentRate: 0.10 },
            poor: { presentRate: 0.62, lateRate: 0.12, halfDayRate: 0.06, absentRate: 0.20 },
        };

        // Build approved leave date sets per employee
        const leaveRows = await client.query(
            `SELECT employee_id, start_date, end_date FROM leave_requests WHERE status = 'approved'`
        );
        const approvedLeaves = {};
        for (const lr of leaveRows.rows) {
            if (!approvedLeaves[lr.employee_id]) approvedLeaves[lr.employee_id] = new Set();
            const d = new Date(lr.start_date);
            const end = new Date(lr.end_date);
            while (d <= end) {
                approvedLeaves[lr.employee_id].add(d.toISOString().split('T')[0]);
                d.setDate(d.getDate() + 1);
            }
        }

        const INSERT_BATCH = 500;
        let attBuffer = [];

        async function flushAtt() {
            if (!attBuffer.length) return;
            const vals = attBuffer.map((_, i) => {
                const b = i * 9;
                return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
            }).join(',');
            await client.query(
                `INSERT INTO attendance
           (employee_id, shift_id, date, check_in, check_out, status, marked_by, ack, state)
         VALUES ${vals}
         ON CONFLICT ON CONSTRAINT unique_attendance_per_day DO NOTHING`,
                attBuffer.flat()
            );
            attBuffer = [];
        }

        for (const e of EMPLOYEES) {
            const profile = attProfile[e.att ?? 'good'];
            const shiftId = SH[e.shift];
            const markedBy = USER[e.id] ? (e.portal === 'super_admin' || e.portal?.startsWith('hr') ? USER[e.id] : HRM_USER_ID) : HRM_USER_ID;
            const leaveSet = approvedLeaves[e.id] ?? new Set();

            // On-leave employees get fewer attendance records
            if (e.status === 'On Leave') continue;

            for (const day of WORKING_DAYS) {
                // Skip if on approved leave
                if (leaveSet.has(day)) {
                    attBuffer.push([e.id, shiftId, day, null, null, 'on_leave', markedBy, true, 'locked']);
                    if (attBuffer.length >= INSERT_BATCH) await flushAtt();
                    continue;
                }

                const r = Math.random();
                let status, checkIn, checkOut, ack, state;

                const cumP = profile.presentRate;
                const cumL = cumP + profile.lateRate;
                const cumH = cumL + profile.halfDayRate;

                if (r < cumP) {
                    status = 'present';
                    const minsDiff = rand(-10, 5);
                    checkIn = padTime(9, Math.max(0, minsDiff));
                    checkOut = padTime(18, rand(-15, 30));
                } else if (r < cumL) {
                    status = 'late';
                    checkIn = padTime(rand(9, 10), rand(20, 59));
                    checkOut = padTime(18, rand(0, 45));
                } else if (r < cumH) {
                    status = 'half_day';
                    checkIn = padTime(9, rand(0, 10));
                    checkOut = padTime(13, rand(30, 59));
                } else {
                    status = 'absent';
                    checkIn = null;
                    checkOut = null;
                }

                // Ack: older records are acknowledged, recent ones are not
                const dayDate = new Date(day);
                const cutoff = new Date('2026-02-01');
                ack = dayDate < cutoff ? coin(0.85) : false;
                state = dayDate < new Date('2025-12-01') ? 'locked' : (dayDate < cutoff ? 'saved' : 'draft');

                attBuffer.push([e.id, shiftId, day, checkIn, checkOut, status, markedBy, ack, state]);
                if (attBuffer.length >= INSERT_BATCH) await flushAtt();
            }
        }
        await flushAtt();

        // ── 22. CALENDAR EVENTS ───────────────────────────────────────────────────
        console.log('Seeding calendar_events…');
        const calEvents = [
            // Pakistani public holidays
            { type: 'holiday', date: '2025-10-29', title: 'National Holiday — Charter of Democracy Day', vis: 'all' },
            { type: 'holiday', date: '2025-11-09', title: 'Iqbal Day — National Holiday', vis: 'all' },
            { type: 'holiday', date: '2025-12-25', title: "Quaid-e-Azam Day & Christmas — National Holiday", vis: 'all' },
            { type: 'holiday', date: '2026-01-01', title: 'New Year\'s Day — Office Closed', vis: 'all' },
            { type: 'holiday', date: '2026-02-05', title: 'Kashmir Solidarity Day — National Holiday', vis: 'all' },
            { type: 'holiday', date: '2026-03-23', title: 'Pakistan Day — National Holiday', vis: 'all' },
            // Company events
            { type: 'event', date: '2025-10-15', title: 'Q3 Performance Review Week Begins', vis: 'all' },
            { type: 'event', date: '2025-11-01', title: 'Annual Appraisal Forms Open', vis: 'hr' },
            { type: 'event', date: '2025-11-15', title: 'Town Hall — Company Strategy 2026', vis: 'all' },
            { type: 'event', date: '2025-12-01', title: 'End-of-Year HR Audit Begins', vis: 'hr' },
            { type: 'event', date: '2025-12-15', title: 'Last Day for Annual Leave Requests (2025)', vis: 'all' },
            { type: 'event', date: '2026-01-05', title: 'New Year Kickoff — All Hands Meeting', vis: 'all' },
            { type: 'event', date: '2026-01-15', title: 'Q1 OKR Setting Deadline', vis: 'hr' },
            { type: 'event', date: '2026-02-14', title: 'Team Building Activity — Karachi HQ', vis: 'all' },
            { type: 'event', date: '2026-03-01', title: 'H1 Mid-Point Sync — Department Leads', vis: 'hr' },
            { type: 'event', date: '2026-03-15', title: 'Annual Salary Review Announcements', vis: 'all' },
            // Training / workshops
            { type: 'training', date: '2025-10-22', title: 'Cyber Security Awareness Training', vis: 'all' },
            { type: 'training', date: '2025-12-10', title: 'Leadership Development Workshop — Managers', vis: 'hr' },
            { type: 'training', date: '2026-02-20', title: 'New HR System Demo Session', vis: 'hr' },
            { type: 'training', date: '2026-03-10', title: 'Onboarding Program — New Joiners Batch 1', vis: 'hr' },
        ];
        for (const ev of calEvents) {
            await client.query(
                `INSERT INTO calendar_events (type, date, title, visibility, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
                [ev.type, ev.date, ev.title, ev.vis, SA_USER_ID]
            );
        }

        // ── 23. NOTIFICATIONS ─────────────────────────────────────────────────────
        console.log('Seeding notifications…');
        // Role-wide notifications
        const roleNotifs = [
            { role: 'hr_manager', type: 'system', msg: 'Annual leave balance rollover for 2026 has been processed.', read: true },
            { role: 'hr_manager', type: 'alert', msg: '3 employees have CNIC expiry within 30 days. Please review urgent alerts.', read: false },
            { role: 'hr_manager', type: 'system', msg: 'Attendance batch for November 2025 is pending submission.', read: false },
            { role: 'hr_executive', type: 'system', msg: '7 leave requests are awaiting your review.', read: false },
            { role: 'employee', type: 'system', msg: 'Your leave balance for 2026 has been updated. Log in to view.', read: false },
            { role: 'employee', type: 'reminder', msg: 'Reminder: Attendance acknowledgement for Oct–Nov is pending.', read: false },
        ];
        for (const n of roleNotifs) {
            await client.query(
                `INSERT INTO notifications (role, type, message, is_read, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
                [n.role, n.type, n.msg, n.read, SA_USER_ID]
            );
        }
        // Per-user notifications (for portal users)
        for (const e of PORTAL_EMPLOYEES.slice(0, 30)) {
            if (!USER[e.id]) continue;
            const msgs = [
                `Welcome back! Your profile is up to date.`,
                `Your leave request for December 2025 has been ${pick(['approved', 'reviewed'])}.`,
                `Attendance record for ${pick(['October', 'November', 'December'])} 2025 is now available.`,
                `Reminder: Submit your Q4 performance self-assessment by March 15.`,
            ];
            await client.query(
                `INSERT INTO notifications (user_id, type, message, is_read, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
                [USER[e.id], 'info', pick(msgs), coin(0.5), HRM_USER_ID]
            );
        }

        // ── 24. PENDING_ACTIONS ───────────────────────────────────────────────────
        console.log('Seeding pending_actions…');
        const pendingCandidates = EMPLOYEES.filter((_, i) => i % 7 === 0);
        for (const e of pendingCandidates) {
            const missing = [];
            if (!coin(0.6)) missing.push('bank_account');
            if (!coin(0.7)) missing.push('emergency_contact');
            if (!coin(0.8)) missing.push('permanent_address');
            if (missing.length === 0) missing.push('profile_photo');

            await client.query(
                `INSERT INTO pending_actions (employee_id, missing_fields, status)
         VALUES ($1,$2,$3)`,
                [e.id, JSON.stringify(missing), coin(0.7) ? 'open' : 'resolved']
            );
        }

        // ── 25. URGENT_ALERTS ────────────────────────────────────────────────────
        console.log('Seeding urgent_alerts…');
        const alertCandidates = EMPLOYEES.filter((_, i) => i % 9 === 0);
        const alertTypes = ['cnic_expiry', 'probation_ending', 'contract_ending', 'notice_period'];
        for (const e of alertCandidates) {
            const atype = pick(alertTypes);
            // Expiry within next 60 days
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + rand(5, 60));
            await client.query(
                `INSERT INTO urgent_alerts (employee_id, type, expiry_date, status)
         VALUES ($1,$2,$3,$4)`,
                [e.id, atype, expDate.toISOString().split('T')[0], coin(0.6) ? 'open' : 'resolved']
            );
        }

        // ── 26. PENALTY_RULES ────────────────────────────────────────────────────
        console.log('Seeding penalty_rules…');
        const penaltyRuleDefs = [
            { name: 'Late Arrival (1st)', amount: 200, type: 'flat', active: true },
            { name: 'Late Arrival (Repeat)', amount: 500, type: 'flat', active: true },
            { name: 'Unauthorized Absence', amount: 1000, type: 'flat', active: true },
            { name: 'Dress Code Violation', amount: 300, type: 'flat', active: true },
            { name: 'Performance Deduction', amount: 5, type: 'percentage', active: true },
            { name: 'Early Departure', amount: 400, type: 'flat', active: true },
            { name: 'Equipment Damage', amount: 2000, type: 'flat', active: false },
        ];
        const PR = {};
        for (const p of penaltyRuleDefs) {
            const r = await client.query(
                `INSERT INTO penalty_rules (name, amount_pkr, type, is_active, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
                [p.name, p.amount, p.type, p.active, SA_USER_ID]
            );
            PR[p.name] = r.rows[0].id;
        }

        // ── 27. EMPLOYEE_PENALTIES (poor/average attendance employees) ────────────
        console.log('Seeding employee_penalties…');
        const penaltyEmps = EMPLOYEES.filter(e => e.att === 'poor' || (e.att === 'average' && coin(0.4)));
        for (const e of penaltyEmps) {
            const numPenalties = rand(1, 3);
            for (let n = 0; n < numPenalties; n++) {
                const mo = rand(10, 12);
                const day = rand(1, 28);
                const pDate = `2025-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const rule = pick(['Late Arrival (1st)', 'Late Arrival (Repeat)', 'Unauthorized Absence', 'Early Departure']);
                const status = pick(['pending', 'approved', 'approved', 'rejected']);
                await client.query(
                    `INSERT INTO employee_penalties
             (employee_id, rule_id, date, reason, status, proposed_by, reviewed_by, reviewed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [
                        e.id,
                        PR[rule],
                        pDate,
                        `Repeated ${rule.toLowerCase()} — warning issued`,
                        status,
                        HRM_USER_ID,
                        status !== 'pending' ? HRM_USER_ID : null,
                        status !== 'pending' ? new Date(`2025-${String(mo).padStart(2, '0')}-${String(Math.min(day + 2, 28)).padStart(2, '0')}`) : null,
                    ]
                );
            }
        }

        // ── 28. DIRECTORY_ENTRIES (all 100 employees) ─────────────────────────────
        console.log('Seeding directory_entries…');
        const availabilities = ['available', 'available', 'available', 'busy', 'out_of_office'];
        for (let i = 0; i < EMPLOYEES.length; i++) {
            const e = EMPLOYEES[i];
            const emailMap = {
                'EMP001': 'zaidbinasif468@gmail.com', 'EMP002': 'huzaifa.kaleem@company.com',
                'EMP003': 'ahmed.ali@company.com', 'EMP004': 'sadia.malik@company.com',
                'EMP005': 'imran.shah@company.com',
            };
            const dirEmail = emailMap[e.id] ?? `${e.name.toLowerCase().replace(/\s+/g, '.')}@company.com`;
            const intExt = String(1000 + i + 1);
            await client.query(
                `INSERT INTO directory_entries
           (employee_id, name, email, phone_internal, phone_mobile, phone_mobile_public,
            role_title, department_id, branch_id, availability, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [
                    e.id,
                    e.name,
                    dirEmail,
                    intExt,
                    `0300-${String(i + 1).padStart(7, '0')}`,
                    coin(0.3), // 30% make mobile public
                    e.desig,
                    DEPT[e.dept],
                    WL[e.wl],
                    pick(availabilities),
                    SA_USER_ID,
                ]
            );
        }

        await client.query('COMMIT');
        console.log('\n✅  Seed complete.');
        console.log(`   Employees : ${EMPLOYEES.length}`);
        console.log(`   Portal users: ${PORTAL_EMPLOYEES.length}`);
        console.log(`   Working days seeded: ${WORKING_DAYS.length}`);
        console.log('\n  Core login credentials:');
        console.log('   super_admin   → zaidbinasif468@gmail.com  / zaidkhan123');
        console.log('   hr_manager    → sadia.malik@company.com   / password123');
        console.log('   hr_executive  → imran.shah@company.com    / password123');
        console.log('   employee      → huzaifa.kaleem@company.com / password123  (EMP002)');
        console.log('   employee2     → ahmed.ali@company.com     / password123  (EMP003)');
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('\n❌  Seed failed — rolled back.', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();