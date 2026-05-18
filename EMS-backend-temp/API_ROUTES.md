# EMS API Routes (Strict Reference)

Base URL: `http://localhost:3000`

Global facts (applies to every non-public route):
- Auth header: `Authorization: Bearer <JWT>`
- Superadmin bypass: `req.user.is_super_admin === true` bypasses permission checks.
- Validation failures (Zod): `422` with `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"Required"}]}`
- Invalid JSON body: `400` with `{ "error": "Invalid request payload", "details": "Expected valid JSON object" }`
- Permission failure: `403` with `{ "error": "Insufficient permissions." }`

## Public

### GET /
- **Access Level**: `Public`
- **Description**: Health check (server status).
- **Auth Required**: `None`
- **Request Payload**: None
- **Notes & Facts**:
  - Response: `{ "message": "server is running" }`a

### POST /api/auth/login
- **Access Level**: `Public`
- **Description**: Login and receive a JWT token + user payload.
- **Auth Required**: `None`
- **Request Payload**:
  ```json
  {
    "email": "string", // Required | must be a valid email address
    "password": "string" // Required | plain password (min length enforced by user creation rules)
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing `email` or `password` | 400 | `{"error":"Email and password are required."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
| Invalid credentials | 401 | `{"error":"Invalid email or password"}` |
- **Notes & Facts**:
  - Rate limit: not implemented (recommended to add).

## Employees (Employee Info)

### GET /api/employees
- **Access Level**: `Employee`
- **Description**: List employees (HR sees all; employee sees only self).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `employees:read`
  - Query params:
    - `search`: `string` (Optional) - search by employee name or employee_id (implementation in `employeeService.search`).
  - Self-service behavior:
    - Employee role receives `[]` or `[self]` only.
    - HR roles receive all rows (optionally filtered by `search`).
  - Pagination: not implemented.

### GET /api/employees/ids
- **Access Level**: `HR`
- **Description**: Return all `employee_id` values for dropdowns/lookups (HR only).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `employees:read`
  - Additional rule: employee role is blocked even if it has `employees:read` (anti-enumeration).
  - Employee blocked response: `403` with `{"error":"Access denied."}`

### GET /api/employees/:id
- **Access Level**: `Employee`
- **Description**: Read a single employee by UUID (`employee_info.id`).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `employees:read`
  - Path params:
    - `id`: `uuid` (Required) - `employee_info.id`
  - Self-service behavior:
    - Employee can access only their own UUID record.
    - If employee tries another UUID: `403` with `{"error":"Access denied. You can only access your own data."}`
  - Not found: `404` with `{"error":"Employee not found."}`

### POST /api/employees
- **Access Level**: `HR`
- **Description**: Create a new employee (employee_info).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Required | minLen=1 maxLen=10
    "name": "string", // Required | minLen=1 maxLen=100
    "father_name": "string", // Required | minLen=1 maxLen=100
    "cnic": "string", // Required | minLen=1 maxLen=20 | unique in DB
    "date_of_birth": "string" // Required | minLen=1 maxLen=15
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"Required"},{"field":"body.name","message":"Required"},{"field":"body.father_name","message":"Required"},{"field":"body.cnic","message":"Required"},{"field":"body.date_of_birth","message":"Required"}]}` |
| Invalid type/format (example: `employee_id` not a string) | 422 | `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"Expected string, received number"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`
  - Side effects: inserts into `employee_info`.
  - Uniqueness conflicts return `409` (message may vary depending on DB constraint).

### PUT /api/employees/:id
- **Access Level**: `HR`
- **Description**: Update employee_info fields by UUID (`employee_info.id`).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Optional | minLen=1 maxLen=10
    "name": "string", // Optional | minLen=1 maxLen=100
    "father_name": "string", // Optional | minLen=1 maxLen=100
    "cnic": "string", // Optional | minLen=1 maxLen=20 | unique in DB
    "date_of_birth": "string" // Optional | minLen=1 maxLen=15
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` is not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Invalid type/format (example: `cnic` not a string) | 422 | `{"error":"Validation failed","issues":[{"field":"body.cnic","message":"Expected string, received number"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`
  - Not found: `404` with `{"error":"Employee not found."}`
  - Employee role cannot update (blocked by permission middleware).

## Employees (Extra Employee Info)

### GET /api/extra-employees
- **Access Level**: `Employee`
- **Description**: Read extra employee info (HR sees all; employee sees only self).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `employees:read`
  - Self-service behavior: employee role reads by `req.user.employee_id` only.

### POST /api/extra-employees
- **Access Level**: `HR`
- **Description**: Create extra employee info row.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Required | minLen=1 maxLen=10
    "contact_1": "string", // Required | minLen=1 maxLen=15
    "contact_2": "string|null", // Optional | maxLen=15
    "emergence_contact_1": "string|null", // Optional | maxLen=15
    "emergence_contact_2": "string|null", // Optional | maxLen=15
    "bank_name": "string|null", // Optional | maxLen=100
    "bank_acc_num": "string|null", // Optional | maxLen=15
    "perment_address": "string|null", // Optional | maxLen=255
    "postal_address": "string|null" // Optional | maxLen=255
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"Required"},{"field":"body.contact_1","message":"Required"}]}` |
| Invalid type/format (example: `contact_1` not a string) | 422 | `{"error":"Validation failed","issues":[{"field":"body.contact_1","message":"Expected string, received number"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`

### PUT /api/extra-employees
- **Access Level**: `HR`
- **Description**: Update extra employee info row (by `employee_id` inside the body).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Optional | minLen=1 maxLen=10
    "contact_1": "string", // Optional | minLen=1 maxLen=15
    "contact_2": "string|null", // Optional | maxLen=15
    "emergence_contact_1": "string|null", // Optional | maxLen=15
    "emergence_contact_2": "string|null", // Optional | maxLen=15
    "bank_name": "string|null", // Optional | maxLen=100
    "bank_acc_num": "string|null", // Optional | maxLen=15
    "perment_address": "string|null", // Optional | maxLen=255
    "postal_address": "string|null" // Optional | maxLen=255
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `employee_id` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"String must contain at most 10 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`

## Job Info

### GET /api/job-info
- **Access Level**: `Employee`
- **Description**: List job info rows (HR sees all; employee sees only self).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `employees:read`
  - Self-service behavior: employee role reads by `req.user.employee_id` only.

### GET /api/job-info/:id
- **Access Level**: `Employee`
- **Description**: Read job info row by UUID (employee self-service enforced).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `employees:read`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Job info not found"}`
  - Employee access other row: `403` with `{"error":"Access denied. You can only access your own data."}`

### POST /api/job-info
- **Access Level**: `HR`
- **Description**: Create job info row for an employee.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Required | minLen=1 maxLen=10
    "department_id": "uuid", // Required
    "designation_id": "uuid", // Required
    "employment_type_id": "uuid", // Required
    "job_status_id": "uuid", // Required
    "work_mode_id": "uuid", // Required
    "work_location_id": "uuid", // Required
    "shift_id": "uuid", // Required
    "date_of_joining": "string", // Required | YYYY-MM-DD
    "date_of_exit": "string|null" // Optional | YYYY-MM-DD
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"Required"},{"field":"body.department_id","message":"Required"},{"field":"body.designation_id","message":"Required"},{"field":"body.employment_type_id","message":"Required"},{"field":"body.job_status_id","message":"Required"},{"field":"body.work_mode_id","message":"Required"},{"field":"body.work_location_id","message":"Required"},{"field":"body.shift_id","message":"Required"},{"field":"body.date_of_joining","message":"Required"}]}` |
| Invalid type/format (example: `department_id` not a UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"body.department_id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`

### PUT /api/job-info/:id
- **Access Level**: `HR`
- **Description**: Update job info row by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Optional | minLen=1 maxLen=10
    "department_id": "uuid", // Optional
    "designation_id": "uuid", // Optional
    "employment_type_id": "uuid", // Optional
    "job_status_id": "uuid", // Optional
    "work_mode_id": "uuid", // Optional
    "work_location_id": "uuid", // Optional
    "shift_id": "uuid", // Optional
    "date_of_joining": "string", // Optional | YYYY-MM-DD
    "date_of_exit": "string|null" // Optional | YYYY-MM-DD
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`
  - Not found: `404` with `{"error":"Job info not found"}`

## Configuration (Departments)

### GET /api/departments
- **Access Level**: `HR`
- **Description**: List departments.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/departments/:id
- **Access Level**: `HR`
- **Description**: Read department by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Department not found"}`

### POST /api/departments
- **Access Level**: `Superadmin`
- **Description**: Create a department.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "department_code": "string", // Required | minLen=1 | unique in DB
    "department_name": "string", // Required | minLen=1
    "parent_department_id": "uuid|null" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.department_code","message":"Required"},{"field":"body.department_name","message":"Required"}]}` |
| Invalid type/format (example: `parent_department_id` not a UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"body.parent_department_id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/departments/:id
- **Access Level**: `Superadmin`
- **Description**: Update a department by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "department_code": "string", // Optional | minLen=1 | unique in DB
    "department_name": "string", // Optional | minLen=1
    "parent_department_id": "uuid|null" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Department not found"}`

## Configuration (Designations)

### GET /api/designations
- **Access Level**: `HR`
- **Description**: List designations.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/designations/department/:departmentId
- **Access Level**: `HR`
- **Description**: List designations by department UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `departmentId`: `uuid` (Required)

### GET /api/designations/:id
- **Access Level**: `HR`
- **Description**: Read designation by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Designation not found"}`

### POST /api/designations
- **Access Level**: `Superadmin`
- **Description**: Create a designation.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "title": "string", // Required | minLen=1 maxLen=50
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.title","message":"Required"}]}` |
| Invalid type/format (example: `is_active` not boolean) | 422 | `{"error":"Validation failed","issues":[{"field":"body.is_active","message":"Expected boolean, received string"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/designations/:id
- **Access Level**: `Superadmin`
- **Description**: Update a designation by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "title": "string", // Optional | minLen=1 maxLen=50
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Invalid type/format (example: `title` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"body.title","message":"String must contain at most 50 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Designation not found"}`

## Configuration (Employment Types)

### GET /api/employment-types
- **Access Level**: `HR`
- **Description**: List employment types.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/employment-types/:id
- **Access Level**: `HR`
- **Description**: Read employment type by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Employment type not found"}`

### POST /api/employment-types
- **Access Level**: `Superadmin`
- **Description**: Create an employment type.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "type_name": "string", // Required | minLen=1 maxLen=50
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.type_name","message":"Required"}]}` |
| Invalid type/format (example: `type_name` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"body.type_name","message":"String must contain at most 50 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/employment-types/:id
- **Access Level**: `Superadmin`
- **Description**: Update an employment type by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "type_name": "string", // Optional | minLen=1 maxLen=50
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Employment type not found"}`

## Configuration (Job Statuses)

### GET /api/job-statuses
- **Access Level**: `HR`
- **Description**: List job statuses.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/job-statuses/:id
- **Access Level**: `HR`
- **Description**: Read job status by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Job status not found"}`

### POST /api/job-statuses
- **Access Level**: `Superadmin`
- **Description**: Create a job status.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "status_name": "string", // Required | minLen=1 maxLen=50
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.status_name","message":"Required"}]}` |
| Invalid type/format (example: `status_name` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"body.status_name","message":"String must contain at most 50 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/job-statuses/:id
- **Access Level**: `Superadmin`
- **Description**: Update a job status by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "status_name": "string", // Optional | minLen=1 maxLen=50
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Job status not found"}`

## Configuration (Work Modes)

### GET /api/work-modes
- **Access Level**: `HR`
- **Description**: List work modes.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/work-modes/:id
- **Access Level**: `HR`
- **Description**: Read work mode by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Work mode not found"}`

### POST /api/work-modes
- **Access Level**: `Superadmin`
- **Description**: Create a work mode.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "mode_name": "string", // Required | minLen=1 maxLen=50
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.mode_name","message":"Required"}]}` |
| Invalid type/format (example: `mode_name` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"body.mode_name","message":"String must contain at most 50 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/work-modes/:id
- **Access Level**: `Superadmin`
- **Description**: Update a work mode by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "mode_name": "string", // Optional | minLen=1 maxLen=50
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Work mode not found"}`

## Configuration (Work Locations)

### GET /api/work-locations
- **Access Level**: `HR`
- **Description**: List work locations.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/work-locations/:id
- **Access Level**: `HR`
- **Description**: Read work location by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Work location not found"}`

### POST /api/work-locations
- **Access Level**: `Superadmin`
- **Description**: Create a work location.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "location_name": "string", // Required | minLen=1 maxLen=100
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.location_name","message":"Required"}]}` |
| Invalid type/format (example: `location_name` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"body.location_name","message":"String must contain at most 100 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/work-locations/:id
- **Access Level**: `Superadmin`
- **Description**: Update a work location by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "location_name": "string", // Optional | minLen=1 maxLen=100
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Work location not found"}`

## Configuration (Shifts)

### GET /api/shifts
- **Access Level**: `HR`
- **Description**: List shifts.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/shifts/:id
- **Access Level**: `HR`
- **Description**: Read shift by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Shift not found"}`

### POST /api/shifts
- **Access Level**: `Superadmin`
- **Description**: Create a shift.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "name": "string", // Required | minLen=1 maxLen=100
    "start_time": "string", // Required | HH:MM or HH:MM:SS
    "end_time": "string", // Required | HH:MM or HH:MM:SS
    "late_after_minutes": "integer", // Optional | min=0 default=15
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.name","message":"Required"},{"field":"body.start_time","message":"Required"},{"field":"body.end_time","message":"Required"}]}` |
| Invalid type/format (example: `start_time` not HH:MM) | 422 | `{"error":"Validation failed","issues":[{"field":"body.start_time","message":"Must be HH:MM or HH:MM:SS"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/shifts/:id
- **Access Level**: `Superadmin`
- **Description**: Update a shift by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "name": "string", // Optional | minLen=1 maxLen=100
    "start_time": "string", // Optional | HH:MM or HH:MM:SS
    "end_time": "string", // Optional | HH:MM or HH:MM:SS
    "late_after_minutes": "integer", // Optional | min=0
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Invalid type/format (example: `end_time` not HH:MM) | 422 | `{"error":"Validation failed","issues":[{"field":"body.end_time","message":"Must be HH:MM or HH:MM:SS"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Shift not found"}`

## Configuration (Leave Types)

### GET /api/leave-types
- **Access Level**: `HR`
- **Description**: List leave types.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/leave-types/:id
- **Access Level**: `HR`
- **Description**: Read leave type by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Leave type not found"}`

### POST /api/leave-types
- **Access Level**: `Superadmin`
- **Description**: Create a leave type.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "name": "string", // Required | minLen=1 maxLen=50
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.name","message":"Required"}]}` |
| Invalid type/format (example: `name` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"body.name","message":"String must contain at most 50 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/leave-types/:id
- **Access Level**: `Superadmin`
- **Description**: Update a leave type by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "name": "string", // Optional | minLen=1 maxLen=50
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Invalid type/format (example: `is_active` not boolean) | 422 | `{"error":"Validation failed","issues":[{"field":"body.is_active","message":"Expected boolean, received string"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Leave type not found"}`

## Configuration (Leave Policies)

### GET /api/leave-policies
- **Access Level**: `HR`
- **Description**: List leave policies.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/leave-policies/year/:year
- **Access Level**: `HR`
- **Description**: List leave policies by year.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `year`: `string` (Required) | regex=`^\\d{4}$`

### GET /api/leave-policies/:id
- **Access Level**: `HR`
- **Description**: Read leave policy by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Leave policy not found"}`

### POST /api/leave-policies
- **Access Level**: `Superadmin`
- **Description**: Create a leave policy row.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "department_id": "uuid", // Required
    "leave_type_id": "uuid", // Required
    "days_allowed": "integer", // Required | min=0
    "year": "integer", // Required | min=2020 max=2100
    "is_active": "boolean" // Optional | default=true
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.department_id","message":"Required"},{"field":"body.leave_type_id","message":"Required"},{"field":"body.days_allowed","message":"Required"},{"field":"body.year","message":"Required"}]}` |
| Invalid type/format (example: `year` out of range) | 422 | `{"error":"Validation failed","issues":[{"field":"body.year","message":"Number must be less than or equal to 2100"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PUT /api/leave-policies/:id
- **Access Level**: `Superadmin`
- **Description**: Update a leave policy row by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "department_id": "uuid", // Optional
    "leave_type_id": "uuid", // Optional
    "days_allowed": "integer", // Optional | min=0
    "year": "integer", // Optional | min=2020 max=2100
    "is_active": "boolean" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`
  - Not found: `404` with `{"error":"Leave policy not found"}`

## Users (Admin)

### GET /api/users
- **Access Level**: `HR`
- **Description**: List users (accounts).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`

### GET /api/users/:id
- **Access Level**: `HR`
- **Description**: Read a user by UUID.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission keys (any): `config:read` or `config:manage`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"User not found"}`

### POST /api/users
- **Access Level**: `Superadmin`
- **Description**: Create a user account for an employee.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "email": "string", // Required | email format
    "password": "string", // Required | minLen=6
    "employee_id": "string", // Required | minLen=1 maxLen=10
    "role_id": "uuid" // Required
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.email","message":"Required"},{"field":"body.password","message":"Required"},{"field":"body.employee_id","message":"Required"},{"field":"body.role_id","message":"Required"}]}` |
| Invalid type/format (example: `email` not an email) | 422 | `{"error":"Validation failed","issues":[{"field":"body.email","message":"Invalid email"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

### PATCH /api/users/:id
- **Access Level**: `Superadmin`
- **Description**: Update a user's role by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "role_id": "uuid" // Required
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.role_id","message":"Required"}]}` |
| Invalid type/format (example: `role_id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"body.role_id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `config:manage`

## Leave Balances

### GET /api/leave-balances
- **Access Level**: `Employee`
- **Description**: List leave balances (HR sees all; employee sees only self).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `leave:read`
  - Query params:
    - `year`: `string` (Optional) - used for employee self-service filtering in service.
  - Pagination: not implemented.

### GET /api/leave-balances/year/:year
- **Access Level**: `HR`
- **Description**: List leave balances for a year (employee blocked to prevent enumeration).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `leave:read`
  - Path params:
    - `year`: `string` (Required) | regex=`^\\d{4}$`
  - Employee blocked response: `403` with `{"error":"Access denied."}`

### GET /api/leave-balances/employee/:employeeId
- **Access Level**: `Employee`
- **Description**: List leave balances for an employee_id (employee self-service enforced).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `leave:read`
  - Path params:
    - `employeeId`: `string` (Required) | minLen=1 maxLen=10
  - Query params:
    - `year`: `string` (Optional)
  - Self-service behavior: employee role ignores `employeeId` and uses own `req.user.employee_id`.

### GET /api/leave-balances/:id
- **Access Level**: `Employee`
- **Description**: Read leave balance row by UUID (employee self-service enforced).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `leave:read`
  - Path params:
    - `id`: `uuid` (Required)
  - Not found: `404` with `{"error":"Leave balance not found"}`
  - Employee access other row: `403` with `{"error":"Access denied. You can only access your own data."}`

### POST /api/leave-balances
- **Access Level**: `HR`
- **Description**: Create a leave balance row (manual/admin creation).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Required | minLen=1 maxLen=10
    "leave_type_id": "uuid", // Required
    "year": "integer", // Required | min=2020 max=2100
    "balance": "integer", // Optional | min=0 default=0
    "used": "integer" // Optional | min=0 default=0
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"Required"},{"field":"body.leave_type_id","message":"Required"},{"field":"body.year","message":"Required"}]}` |
| Invalid type/format (example: `year` not an integer) | 422 | `{"error":"Validation failed","issues":[{"field":"body.year","message":"Expected number, received string"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`

### POST /api/leave-balances/employee/:employeeId/initialize
- **Access Level**: `HR`
- **Description**: Initialize leave balances for an employee for a year.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "year": "integer" // Required | min=2020 max=2100
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.year","message":"Required"}]}` |
| Invalid type/format (example: `employeeId` too long) | 422 | `{"error":"Validation failed","issues":[{"field":"params.employeeId","message":"String must contain at most 10 character(s)"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`

### PUT /api/leave-balances/:id
- **Access Level**: `HR`
- **Description**: Update a leave balance row by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Optional | minLen=1 maxLen=10
    "leave_type_id": "uuid", // Optional
    "year": "integer", // Optional | min=2020 max=2100
    "balance": "integer", // Optional | min=0
    "used": "integer" // Optional | min=0
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`
  - Not found: `404` with `{"error":"Leave balance not found"}`

### PATCH /api/leave-balances/:id/adjust
- **Access Level**: `HR`
- **Description**: Adjust the `used` value for a leave balance row by UUID.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "adjustment": "integer" // Required | can be negative or positive
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.adjustment","message":"Required"}]}` |
| Invalid type/format (example: `adjustment` not integer) | 422 | `{"error":"Validation failed","issues":[{"field":"body.adjustment","message":"Expected number, received string"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `employees:write`

## Attendance

### GET /api/attendance/daily
- **Access Level**: `Employee`
- **Description**: Get daily attendance sheet (HR sees filters; employee sees only self).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `attendance:read`
  - Query params:
    - `date`: `string` (Required) | YYYY-MM-DD
    - `department`: `uuid` (Optional) | HR only (ignored for employee)
    - `location`: `uuid` (Optional) | HR only (ignored for employee)
    - `shift`: `uuid` (Optional) | HR only (ignored for employee)
    - `employee`: `string` (Optional) | minLen=1 maxLen=10 | HR only (forced to self for employee)

### POST /api/attendance/batch
- **Access Level**: `HR`
- **Description**: Batch save attendance rows for a date.
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "date": "string", // Required | YYYY-MM-DD
    "rows": [
      {
        "employee_id": "string", // Required | minLen=1 maxLen=10
        "shift_id": "uuid", // Required
        "check_in": "string|null", // Optional | HH:MM or HH:MM:SS
        "check_out": "string|null", // Optional | HH:MM or HH:MM:SS
        "status": "string", // Required | one of: present, absent, late, half_day, on_leave
        "notes": "string|null" // Optional
      }
    ] // Required | minItems=1
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.date","message":"Required"},{"field":"body.rows","message":"Required"}]}` |
| Invalid type/format (example: `check_in` invalid time) | 422 | `{"error":"Validation failed","issues":[{"field":"body.rows.0.check_in","message":"Must be HH:MM or HH:MM:SS"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `attendance:write`
  - Side effects: upserts attendance rows for the date; `marked_by` set to `req.user.user_id`.

### GET /api/attendance/report
- **Access Level**: `Employee`
- **Description**: Get monthly attendance report summary.
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `attendance:read`
  - Query params:
    - `month`: `string` (Required) | regex=`^(0?[1-9]|1[0-2])$`
    - `year`: `string` (Required) | regex=`^\\d{4}$`
    - `department`: `uuid` (Optional) | HR only (ignored for employee)

### PATCH /api/attendance/:attendanceId/ack
- **Access Level**: `Employee`
- **Description**: Employee acknowledges attendance record (digital signature).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {}
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `attendanceId` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.attendanceId","message":"Invalid uuid"}]}` |
| Invalid type/format (example: payload not empty object) | 422 | `{"error":"Validation failed","issues":[{"field":"body","message":"Unrecognized key(s) in object: 'ack'"}]}` |
| Insufficient role access (HR roles are blocked) | 403 | `{"error":"Access denied. Employees only."}` |
| Insufficient role access (employee acknowledging someone else) | 403 | `{"error":"Access denied. You can only acknowledge your own attendance."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `attendance:read`
  - Idempotency: calling ack on an already-acked record remains safe (service layer ensures).
  - Not found: `404` with `{"error":"Attendance record not found."}`

## Leave Requests

### GET /api/leave-requests
- **Access Level**: `Employee`
- **Description**: List leave requests (HR sees all; employee sees only self).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `leave:read`
  - Query params:
    - `status`: `string` (Optional) | depends on service filter
    - `employee`: `string` (Optional) | HR only (forced to self for employee)
    - `department`: `uuid` (Optional) | HR only (ignored for employee)

### GET /api/leave-requests/balances
- **Access Level**: `Employee`
- **Description**: List leave balances view used in Leave > Balances (self-service enforced).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `leave:read`
  - Query params:
    - `department`: `uuid` (Optional) | HR only (ignored for employee)
    - `location`: `uuid` (Optional) | HR only (ignored for employee)
    - `shift`: `uuid` (Optional) | HR only (ignored for employee)

### GET /api/leave-requests/calendar
- **Access Level**: `Employee`
- **Description**: Calendar view of approved leaves (self-service enforced).
- **Auth Required**: `JWT`
- **Request Payload**: None
- **Notes & Facts**:
  - Permission key: `leave:read`
  - Query params:
    - `department`: `uuid` (Optional) | HR only (ignored for employee)
    - `month`: `string` (Optional) | regex=`^(0?[1-9]|1[0-2])$`
    - `year`: `string` (Optional) | regex=`^\\d{4}$`

### POST /api/leave-requests
- **Access Level**: `Employee`
- **Description**: Create a leave request (employee can only create for self).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "employee_id": "string", // Required | minLen=1 maxLen=10 | overridden to self for employee role
    "leave_type_id": "uuid", // Required
    "start_date": "string", // Required | YYYY-MM-DD
    "end_date": "string", // Required | YYYY-MM-DD
    "reason": "string|null" // Optional
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.employee_id","message":"Required"},{"field":"body.leave_type_id","message":"Required"},{"field":"body.start_date","message":"Required"},{"field":"body.end_date","message":"Required"}]}` |
| Invalid type/format (example: `leave_type_id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"body.leave_type_id","message":"Invalid uuid"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `leave:write`
  - Self-service: if employee tries to submit another employee_id, controller overwrites it to self.

### PATCH /api/leave-requests/:id/approve
- **Access Level**: `HR`
- **Description**: Approve a leave request by UUID (HR manager / superadmin only).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {}
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Invalid type/format (example: payload not empty object) | 422 | `{"error":"Validation failed","issues":[{"field":"body","message":"Unrecognized key(s) in object: 'status'"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `leave:approve`
  - Side effects: updates request status and adjusts leave balances.

### PATCH /api/leave-requests/:id/reject
- **Access Level**: `HR`
- **Description**: Reject a leave request by UUID (HR manager / superadmin only).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {}
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Invalid type/format (example: `id` not UUID) | 422 | `{"error":"Validation failed","issues":[{"field":"params.id","message":"Invalid uuid"}]}` |
| Invalid type/format (example: payload not empty object) | 422 | `{"error":"Validation failed","issues":[{"field":"body","message":"Unrecognized key(s) in object: 'reason'"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `leave:approve`
  - Side effects: updates request status.

### PATCH /api/leave-requests/:id/early-return
- **Access Level**: `HR`
- **Description**: Early-return a leave request by UUID (adjusts balance using `end_by_force`).
- **Auth Required**: `JWT`
- **Request Payload**:
  ```json
  {
    "end_by_force": "string" // Required | YYYY-MM-DD
  }
  ```
- **Validation & Error Mapping**:

| Condition | HTTP Status | Exact Error Response |
|---|---:|---|
| Missing required field(s) | 422 | `{"error":"Validation failed","issues":[{"field":"body.end_by_force","message":"Required"}]}` |
| Invalid type/format (example: `end_by_force` not a date string) | 422 | `{"error":"Validation failed","issues":[{"field":"body.end_by_force","message":"Invalid date"}]}` |
| Insufficient role access | 403 | `{"error":"Insufficient permissions."}` |
| Payload empty/malformed JSON | 400 | `{"error":"Invalid request payload","details":"Expected valid JSON object"}` |
- **Notes & Facts**:
  - Permission key: `leave:approve`
  - Side effects: restores unused days and updates leave request `end_by_force`.
