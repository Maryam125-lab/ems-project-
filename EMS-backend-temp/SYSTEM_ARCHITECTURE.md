# EMS Complete System Flow & Architecture

## Database Layer — All Tables In Dependency Order

### LOOKUP / CONFIG (no FKs)
├── departments
├── designations
├── employment_types
├── job_statuses
├── work_modes
├── work_locations
├── shifts
├── leave_types
├── permissions

### ROLES & ACCESS
├── roles                    → departments
├── role_permissions         → roles, permissions

### EMPLOYEE CORE
├── employee_info            (employee_id is PK — varchar EMP001)
├── emergency_contacts       → employee_info  (1-to-1)
├── employee_bank_accounts   → employee_info  (1-to-many)
├── employee_medical         → employee_info  (1-to-1)
├── extra_employee_info      → employee_info  (1-to-1)

### EMPLOYEE JOB
├── job_info                 → employee_info, departments, designations,
│                              employment_types, job_statuses,
│                              work_modes, work_locations, shifts
├── employee_job_history     → employee_info, departments, designations

### PORTAL ACCESS
├── users                    → employee_info, roles

### LEAVE
├── leave_policies           → departments, leave_types
├── leave_balances           → employee_info, leave_types
├── leave_capacity_config    → departments
├── leave_requests           → employee_info, leave_types, users(reviewed_by)

### ATTENDANCE
├── attendance               → employee_info, shifts, users(marked_by)

### PENALTIES
├── penalty_rules            → users(created_by)
├── employee_penalties       → employee_info, penalty_rules, users

### NOTIFICATIONS & ALERTS
├── notifications            → users
├── pending_actions          → employee_info
├── urgent_alerts            → employee_info
├── calendar_events          → users

### DIRECTORY
├── directory_entries        → employee_info, departments, work_locations

### AUDIT
├── audit_logs               → users
├── activity_logs            → users

---

## Role System — Who Can Do What

### super_admin
  - Role linked to NULL department_id (global)
  - Gets ALL permissions
  - Bypasses all RBAC checks
  - Can access any employee's data

### hr_manager (HR dept)
  - `config:read`
  - `employees:read` + `write`
  - `leave:read` + `write` + `approve`
  - `attendance:read` + `write`
  - `calendar:read` + `write`
  - `notifications:read` + `write`
  - `alerts:read`
  - `pending_actions:read`
  - `dashboard:read`
  - `directory:read` + `write`

### hr_executive (HR dept)
  - Same as `hr_manager` MINUS:
    - ✗ `employees:write`
    - ✗ `leave:write`
    - ✗ `leave:approve`
    - ✗ `attendance:write`
    - ✗ `notifications:write`
    - ✗ `dashboard:read` (Correction: Ensured consistency between seed sets)

### employee (per dept — IT/FIN/SAL each get their own role row)
  - `employees:read` → SELF ONLY enforced in controller
  - `leave:read` → SELF ONLY
  - `leave:write` → Submit own requests only
  - `attendance:read` → SELF ONLY
  - `calendar:read`
  - `notifications:read` → SELF ONLY
  - `directory:read`

---

## Full Employee Creation Flow

1.  **STEP 1 — Lookup data must exist first**
    - HR checks: departments, designations, employment_types, job_statuses, work_modes, work_locations, shifts.
    - These are seeded once, managed via config routes.
2.  **STEP 2 — Create employee_info**
    - `POST /api/employees`
    - Body: `employee_id`, `name`, `father_name`, `cnic`, `date_of_birth`
    - Result: base record created, `employee_id` is now valid FK.
3.  **STEP 3 — Fill supporting tables** (can be done after step 2)
    - `POST /api/emergency-contacts` → `emergency_contacts` (1-to-1)
    - `POST /api/extra-employees` → `extra_employee_info` (1-to-1)
    - `POST /api/employee-bank-accounts` → `employee_bank_accounts`
    - `POST /api/employee-medical` → `employee_medical` (1-to-1)
4.  **STEP 4 — Assign job**
    - `POST /api/job-info`
    - Body: `employee_id` + all FK IDs (`dept`, `desig`, `emp_type`, `job_status`, `work_mode`, `work_location`, `shift`, `date_of_joining`).
    - Also inserts into `employee_job_history` automatically.
5.  **STEP 5 — Create portal user** (gives login access)
    - `POST /api/users`
    - Body: `employee_id`, `email`, `password`, `role_id`
    - Password is bcrypt hashed on server.
    - `must_change_password = true` by default.
    - Employee gets JWT on first login, forced to change password.
6.  **STEP 6 — System auto-creates**
    - `pending_actions` row if any required fields are missing.
    - `urgent_alerts` if `probation_end` or `contract_end` is near.
    - `directory_entries` if configured.
    - `leave_balances` for current year across all leave types.
7.  **STEP 7 — Employee first login**
    - `POST /api/auth/login` → returns JWT in `httpOnly` cookie (`ems_jwt`).
    - If `must_change_password = true` → redirect to change password.
    - `POST /api/auth/change-password`.

---

## Attendance Flow

### HR MARKS ATTENDANCE (daily or batch)
- `POST /api/attendance/batch`
- Body: `{ date, rows: [{ employee_id, shift_id, check_in, check_out, status, notes }] }`
- Status options: `present` | `absent` | `late` | `half_day` | `holiday` | `on_leave`
- `marked_by` = HR user UUID
- `state` = `draft` initially
- `ack` = `false` initially

### HR SAVES / SUBMITS
- `PATCH /api/attendance/:id` → `state`: `draft` → `saved` → `submitted`
- Once submitted = locked (employees can now see it).

### EMPLOYEE ACKNOWLEDGES
- `PATCH /api/attendance/:attendanceId/ack`
- Only the OWNER employee can ack their own record.
- HR cannot ack (403).
- Another employee cannot ack (403).
- `super_admin` can ack as override.
- Sets `ack = true`.

### HR UNLOCK (if correction needed)
- `PATCH /api/attendance/:id/unlock`
- `state` → `ho_unlocked`
- HR can then correct and re-submit.

### EMPLOYEE VIEWS
- `GET /api/attendance` → only own records (controller filters by `employee_id` from JWT).
- `GET /api/attendance/daily?date=` → own record for that date.
- `GET /api/attendance/report?month=&year=` → own monthly summary.

### HR VIEWS
- `GET /api/attendance` → all employees.
- `GET /api/attendance/daily?date=` → all employees for that date.
- `GET /api/attendance/report` → full report.

---

## Leave Flow

### SETUP (HR does once per year per department)
- `POST /api/leave-types` → create Annual, Sick, Casual, Unpaid etc.
- `POST /api/leave-policies` → `days_allowed` per dept per `leave_type` per year.
- `POST /api/leave-balances` → initialize balance per employee per type per year.
- `POST /api/leave-capacity-config` → max % of dept that can be on leave simultaneously.

### EMPLOYEE APPLIES
- `POST /api/leave-requests`
- Body: `{ leave_type_id, start_date, end_date, reason }`
- System checks: balance available, capacity not exceeded, no overlap.
- Status = `pending`.
- Notification sent to HR.

### HR REVIEWS
- `GET /api/leave-requests` → all pending requests.
- `PATCH /api/leave-requests/:id/approve`
- `PATCH /api/leave-requests/:id/reject` → requires `rejection_reason`.
- Leave balance updated: `used++`, `balance--` on approval.

### HR CAN FORCE-END A LEAVE EARLY
- `PATCH /api/leave-requests/:id`
- Body: `{ end_by_force: date }` → employee recalled before original `end_date`.

### EMPLOYEE TRACKS
- `GET /api/leave-requests/mine` → own requests + status.
- `GET /api/leave-requests/balances` → own balances per type.
- `GET /api/leave-requests/balances/mine`
- `GET /api/leave-requests/calendar?month=&year=` → calendar view of own leaves.

### ATTENDANCE AUTO-MARKS
- When leave is approved for a date, attendance status = `on_leave` for those dates.

---

## Penalty Flow

### SETUP
- `POST /api/penalty-rules`
- Body: `{ name, amount_pkr, type: 'flat'|'percentage', is_active }`
- Examples: Late Arrival = 200 PKR flat, Performance = 5% percentage.

### HR PROPOSES PENALTY
- `POST /api/employee-penalties` (or `/api/penalties`)
- Body: `{ employee_id, rule_id, date, reason }`
- Status = `pending`.
- `proposed_by` = HR user UUID.
- `submitted_to_ho_at` = `now()`.

### HO (Head Office) / SUPER_ADMIN REVIEWS
- `PATCH /api/employee-penalties/:id/approve`
- `PATCH /api/employee-penalties/:id/reject`
- `reviewed_by` = reviewer UUID.
- `review_note` = reason.

### EMPLOYEE ACKNOWLEDGES
- `PATCH /api/penalties/:id/ack` → `employee_ack = true`, `employee_acked_at = now()`.

### HR / SUPER_ADMIN VIEWS
- `GET /api/employee-penalties` → all penalties.
- `GET /api/employee-penalties?status=pending`
- `GET /api/employee-penalties?employee_id=EMP002`

### EMPLOYEE VIEWS
- `GET /api/employee-penalties` → SELF ONLY (controller filters).

---

## RBAC Enforcement — How It Works In Code

### MIDDLEWARE STACK per route:
1.  **verifyToken** → reads JWT from cookie or Authorization header. Decodes payload: `{ userId, employeeId, roleId, roleName }`. Attaches to `req.user`. Returns 401 if missing/expired/invalid.
2.  **requirePermission** → checks `role_permissions` table (or JWT-embedded perms). Returns 403 if role lacks permission.
3.  **validate()** → Zod schema validation. Returns 400/422 if body/params/query invalid.
4.  **controller** → business logic. Employee controllers ALWAYS filter by `req.user.employeeId`.

### SELF-SERVICE ENFORCEMENT (in controllers):
- `GET /employees` → if `role=employee`: `WHERE employee_id = req.user.employeeId`.
- `GET /employees/:id` → if `role=employee` and `id != own UUID` → 403.
- `GET /job-info` → if `role=employee`: `WHERE employee_id = req.user.employeeId`.
- `GET /leave-balances`, `GET /attendance`, etc. follow the same pattern.

### SPECIAL ROUTES (Restricted Access):
- `GET /employees/ids` → employee: deny (can't enumerate all IDs).
- `PATCH /attendance/:id/ack` → only owner employee or `super_admin`.
- `GET /leave-balances/year/:year` → employee: deny.
- `GET /dashboard/metrics` → employee: deny.
- `GET /pending-actions` → employee: deny.
- `GET /urgent-alerts` → employee: deny.

---

## JWT Payload Structure
```javascript
{
  userId:     "uuid",           // users.id
  employeeId: "EMP002",         // users.employee_id
  roleId:     "uuid",           // users.role_id
  roleName:   "employee",       // roles.role_name
  email:      "user@company.com",
  iat:        1234567890,
  exp:        1234567890
}
```
