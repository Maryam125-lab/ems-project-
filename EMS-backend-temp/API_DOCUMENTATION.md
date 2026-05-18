# EMS API Documentation

**Base URL**: `http://localhost:3001/api`  
**Standard Response Format**:  
Success: `{ "success": true, "data": { ... } }`  
Error: `{ "success": false, "error": { "code": "STRING", "message": "..." } }`

---

## 1. Authentication (`/auth`)

### Login
*   **Endpoint**: `POST /auth/login`
*   **Description**: Authenticates user and sets JWT cookie + CSRF cookie.
*   **Payload**: `{ "email": "user@company.com", "password": "password123" }`
*   **Success (200)**: Sets `ems_jwt` cookie. Returns user object.
*   **Error (401)**: Invalid credentials.

### Logout
*   **Endpoint**: `POST /auth/logout`
*   **Auth**: Token required.
*   **Success (200)**: Clears authentication cookies.

### Current Session
*   **Endpoint**: `GET /auth/session`
*   **Auth**: Token required.
*   **Success (200)**: Returns current user ID, employee ID, and role info.

### Change Password
*   **Endpoint**: `POST /auth/change-password`
*   **Auth**: Token required.
*   **Payload**: `{ "current_password": "...", "new_password": "..." }`
*   **Success (200)**: Updates password and issues new JWT.

---

## 2. Employee Management

### List Employees
*   **Endpoint**: `GET /employees`
*   **Permission**: `employees:read`
*   **Note**: If role is `employee`, returns only own record.

### Create Employee (Core Info)
*   **Endpoint**: `POST /employees`
*   **Permission**: `employees:write`
*   **Payload**: `{ "employee_id": "EMP...", "name": "...", "father_name": "...", "cnic": "...", "date_of_birth": "YYYY-MM-DD" }`

### Supporting Info Endpoints
*   `POST/PUT /emergency-contacts`
*   `POST/PUT /extra-employees`
*   `POST/PUT /employee-bank-accounts`
*   `POST/PUT /employee-medical`
*   `POST/PUT /job-info`
*   `GET /employee-job-history/:id`

---

## 3. Attendance (`/attendance`)

### Batch Attendance
*   **Endpoint**: `POST /attendance/batch`
*   **Permission**: `attendance:write`
*   **Payload**: `{ "date": "YYYY-MM-DD", "rows": [...] }`

### Daily Sheet
*   **Endpoint**: `GET /attendance/daily?date=YYYY-MM-DD`
*   **Permission**: `attendance:read`

### Acknowledge Attendance
*   **Endpoint**: `PATCH /attendance/:attendanceId/ack`
*   **Auth**: Only owner employee or `super_admin`.

### Unlock Attendance
*   **Endpoint**: `PATCH /attendance/:id/unlock`
*   **Permission**: `HR+`

---

## 4. Leave Management (`/leave-requests`)

### Submit Leave
*   **Endpoint**: `POST /leave-requests`
*   **Payload**: `{ "leave_type_id": "UUID", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "reason": "..." }`

### Approve/Reject
*   **Endpoints**: `PATCH /leave-requests/:id/approve` | `PATCH /leave-requests/:id/reject`
*   **Permission**: `leave:approve`

### My Leaves & Balances
*   `GET /leave-requests/mine`
*   `GET /leave-requests/balances`
*   `GET /leave-requests/calendar`

---

## 5. Penalties

### Propose Penalty
*   **Endpoint**: `POST /employee-penalties`
*   **Payload**: `{ "employee_id": "EMP...", "rule_id": "UUID", "date": "YYYY-MM-DD", "reason": "..." }`

### Review Penalty
*   **Endpoints**: `PATCH /employee-penalties/:id/approve` | `PATCH /employee-penalties/:id/reject`
*   **Permission**: `HR+`

### Acknowledge Penalty
*   **Endpoint**: `PATCH /penalties/:id/ack`
*   **Auth**: Owner only.

---

## 6. System Configuration (`/config`)

### Lookup Data
*   **Endpoint**: `GET /config/:entity`
*   **Entities**: `departments`, `designations`, `shifts`, `leave-types`, etc.

---

## 7. Status Code Reference

| Code | Meaning | Reason |
| :--- | :--- | :--- |
| **200** | OK | Request succeeded. |
| **201** | Created | Resource successfully created. |
| **401** | Unauthorized | No token or invalid token provided. |
| **403** | Forbidden | Insufficient permissions (RBAC) or mandatory password change required. |
| **404** | Not Found | Route or database record does not exist. |
| **422** | Unprocessable | Validation failed. |
| **500** | Server Error | Database error or unexpected server-side logic failure. |
