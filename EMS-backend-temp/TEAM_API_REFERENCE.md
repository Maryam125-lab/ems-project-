# EMS Backend — Team API Reference (Internal)

**Base URL**: `http://localhost:3001/api`  
**Global Header**: `Authorization: Bearer <TOKEN>` (Not needed for `/auth/login`)

---

## 1. Authentication (`/auth`)

### [POST] Login
*   **Path**: `/auth/login`
*   **Returns**: Sets HTTP-Only cookie `ems_jwt`.

### [POST] Logout
*   **Path**: `/auth/logout`

### [GET] Session Info
*   **Path**: `/auth/session`

### [POST] Change Password
*   **Path**: `/auth/change-password`

---

## 2. Employee Management

### [GET] List Employees
*   **Path**: `/employees`
*   **Note**: Automatically filters by `employeeId` if role is `employee`.

### [POST] Create Employee (Base)
*   **Path**: `/employees`
*   **Permissions**: `employees:write`

### Supporting Profile Endpoints
*   `POST/PUT /emergency-contacts`
*   `POST/PUT /extra-employees`
*   `POST/PUT /employee-bank-accounts`
*   `POST/PUT /employee-medical`
*   `POST/PUT /job-info`
*   `GET /employee-job-history/:id`

---

## 3. Attendance (`/attendance`)

### [POST] Batch Marking
*   **Path**: `/attendance/batch`
*   **Permissions**: `attendance:write`

### [GET] Daily View
*   **Path**: `/attendance/daily?date=YYYY-MM-DD`

### [PATCH] Acknowledge
*   **Path**: `/attendance/:attendanceId/ack`

### [PATCH] Unlock
*   **Path**: `/attendance/:id/unlock`

---

## 4. Leave Management (`/leave-requests`)

### [POST] Submit Request
*   **Path**: `/leave-requests`

### [PATCH] Decisions
*   **Paths**: `/leave-requests/:id/approve` | `/leave-requests/:id/reject`
*   **Permissions**: `leave:approve`

### [GET] My Data
*   `GET /leave-requests/mine`
*   `GET /leave-requests/balances`
*   `GET /leave-requests/calendar`

---

## 5. Penalties

### [POST] Propose
*   **Path**: `/employee-penalties` (or `/penalties`)

### [PATCH] Review
*   **Paths**: `/employee-penalties/:id/approve` | `/reject`

### [PATCH] Ack
*   **Path**: `/penalties/:id/ack`

---

## 6. Global Configuration (`/config`)

### [GET] Lookup Data
*   **Path**: `/config/:entity`
*   **Entities**: `departments`, `designations`, `employment-types`, `job-statuses`, `work-modes`, `work-locations`, `shifts`, `leave-types`, `leave-policies`, `penalty-rules`.

---

## 7. Error Codes (Standard)

| Status | Code | Meaning |
| :--- | :--- | :--- |
| **401** | `UNAUTHORIZED` | Token missing or expired. |
| **403** | `FORBIDDEN` | RBAC failure or `MUST_CHANGE_PASSWORD`. |
| **422** | `VALIDATION_ERROR` | Schema mismatch. |
| **404** | `NOT_FOUND` | Path or Record doesn't exist. |
| **500** | `INTERNAL_SERVER_ERROR` | Unexpected crash. |
