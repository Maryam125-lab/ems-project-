# Leave Requests API

**Base Path:** `/api/leave-requests`  
**Total Endpoints:** 9

Leave management endpoints handle leave applications, approvals, balances, and calendar views.

---

## GET /leave-requests

Retrieve all leave requests with optional filtering. Requires `leave:read` permission. This endpoint is typically used by HR/managers to see all requests.

**Authentication:** Required  
**Permissions:** `leave:read`

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | Enum | Filter by status: `pending`, `approved`, or `rejected` |
| `employee_id` | String | Filter by employee code (e.g., "EMP001") |
| `department_id` | UUID | Filter by department ID |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "c1d2e3f4-a5b6-7890-cdef-012345678901",
      "employee_id": "EMP002",
      "employee_name": "Fatima Ali",
      "leave_type_id": "dd0e8400-e29b-41d4-a716-446655440010",
      "leave_type_name": "Annual Leave",
      "start_date": "2025-05-20",
      "end_date": "2025-05-25",
      "total_days": 5,
      "reason": "Family vacation",
      "status": "pending",
      "submitted_at": "2025-05-06T14:30:00.000Z",
      "submitted_by": "EMP002",
      "reviewed_by": null,
      "reviewed_at": null,
      "review_note": null
    },
    {
      "id": "d2e3f4a5-b6c7-8901-def0-123456789012",
      "employee_id": "EMP001",
      "employee_name": "Ahmed Khan",
      "leave_type_id": "ee0e8400-e29b-41d4-a716-446655440011",
      "leave_type_name": "Sick Leave",
      "start_date": "2025-05-10",
      "end_date": "2025-05-10",
      "total_days": 1,
      "reason": "Medical appointment",
      "status": "approved",
      "submitted_at": "2025-05-05T09:15:00.000Z",
      "submitted_by": "EMP001",
      "reviewed_by": "HR001",
      "reviewed_at": "2025-05-05T11:00:00.000Z",
      "review_note": "Approved. Get well soon."
    }
  ]
}
```

**Field Details for each request object:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique leave request ID |
| `employee_id` | String | Employee code |
| `employee_name` | String | Employee's full name |
| `leave_type_id` | UUID | Lookup ID for leave type |
| `leave_type_name` | String | Human-readable leave type |
| `start_date` | Date | First day of leave (YYYY-MM-DD) |
| `end_date` | Date | Last day of leave (YYYY-MM-DD) |
| `total_days` | Number | Total number of days requested (inclusive) |
| `reason` | String or null | Explanation provided by employee |
| `status` | Enum | Current status: `pending`, `approved`, or `rejected` |
| `submitted_at` | Timestamp | When the request was submitted |
| `submitted_by` | String | User ID who submitted (employee or HR on behalf) |
| `reviewed_by` | String or null | User ID who reviewed/approved/rejected |
| `reviewed_at` | Timestamp or null | When the decision was made |
| `review_note` | String or null | Optional note from reviewer |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/leave-requests?status=pending&department_id=550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /leave-requests/mine

Retrieve the authenticated employee's own leave requests. No special permission required; employees can only see their own records.

**Authentication:** Required  
**Permissions:** None (user can only access their own data)

### Query Parameters
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "c1d2e3f4-a5b6-7890-cdef-012345678901",
      "employee_id": "EMP002",
      "leave_type_id": "dd0e8400-e29b-41d4-a716-446655440010",
      "leave_type_name": "Annual Leave",
      "start_date": "2025-05-20",
      "end_date": "2025-05-25",
      "total_days": 5,
      "reason": "Family vacation",
      "status": "pending",
      "submitted_at": "2025-05-06T14:30:00.000Z",
      "reviewed_by": null,
      "reviewed_at": null,
      "review_note": null
    }
  ]
}
```

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/leave-requests/mine \
  -H "Authorization: Bearer <your_token>"
```

---

## POST /leave-requests

Submit a new leave request. The employee is automatically inferred from the authenticated user's token. Requires `leave:write` capability.

**Authentication:** Required  
**Permissions:** None (any employee can submit for themselves)

### Request Body

**Schema:**
```json
{
  "leave_type_id": "UUID (required)",
  "start_date": "string (date format, required)",
  "end_date": "string (date format, required)",
  "reason": "string or null (optional)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `leave_type_id` | UUID | Yes | No | Valid UUID | ID of the leave type (e.g., annual, sick) |
| `start_date` | String | Yes | No | Valid date (YYYY-MM-DD) | First day of leave |
| `end_date` | String | Yes | No | Valid date (YYYY-MM-DD) | Last day of leave (must be >= start_date) |
| `reason` | String | No | Yes | - | Optional explanation for the leave |

**Note:** The `employee_id` is automatically taken from the authenticated user's session and should NOT be provided in the request body.

**Example Request (Test Payload):**
```json
{
  "leave_type_id": "dd0e8400-e29b-41d4-a716-446655440010",
  "start_date": "2025-05-20",
  "end_date": "2025-05-25",
  "reason": "Family vacation to the mountains"
}
```

### Response Body

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "c1d2e3f4-a5b6-7890-cdef-012345678901",
    "employee_id": "EMP002",
    "leave_type_id": "dd0e8400-e29b-41d4-a716-446655440010",
    "leave_type_name": "Annual Leave",
    "start_date": "2025-05-20",
    "end_date": "2025-05-25",
    "total_days": 5,
    "reason": "Family vacation to the mountains",
    "status": "pending",
    "submitted_at": "2025-05-06T14:30:00.000Z",
    "submitted_by": "EMP002"
  }
}
```

**Fields in `data`:**
- `id` (UUID): Unique leave request ID
- `employee_id` (String): Employee code (from auth context)
- `leave_type_id` (UUID): Leave type selected
- `leave_type_name` (String): Resolved leave type name
- `start_date` (Date): Start of leave period
- `end_date` (Date): End of leave period
- `total_days` (Number): Calculated number of days (inclusive)
- `reason` (String): Provided reason (may be null if omitted)
- `status` (String): Initial status is always `"pending"`
- `submitted_at` (Timestamp): Submission timestamp
- `submitted_by` (String): User ID who submitted

**Error Responses:**
- `422 Validation Error`: Invalid dates, end_date before start_date, missing leave_type_id
- `409 Conflict`: Leave dates conflict with already approved leave (capacity exceeded)
- `400 Bad Request`: Insufficient leave balance

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/leave-requests \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type_id": "dd0e8400-e29b-41d4-a716-446655440010",
    "start_date": "2025-05-20",
    "end_date": "2025-05-25",
    "reason": "Family vacation to the mountains"
  }'
```

---

## PATCH /leave-requests/:id/approve

Approve a leave request. Only users with `leave:approve` permission can approve. This automatically updates the employee's leave balance.

**Authentication:** Required  
**Permissions:** `leave:approve`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Leave request ID to approve |

### Request Body
None. This is a simple approval action.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "c1d2e3f4-a5b6-7890-cdef-012345678901",
    "status": "approved",
    "reviewed_by": "HR001",
    "reviewed_at": "2025-05-06T15:00:00.000Z",
    "review_note": null,
    "message": "Leave request approved successfully"
  }
}
```

**Fields in `data`:**
- `id` (UUID): Leave request ID
- `status` (String): Updated to `"approved"`
- `reviewed_by` (String): User ID who approved
- `reviewed_at` (Timestamp): Approval timestamp
- `review_note` (String or null): Optional note (not included unless provided)
- `message` (String): Success confirmation

**Error Responses:**
- `404 Not Found`: Leave request doesn't exist
- `403 Forbidden`: User lacks approval permission
- `409 Conflict`: Request is already approved/rejected

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/leave-requests/c1d2e3f4-a5b6-7890-cdef-012345678901/approve \
  -H "Authorization: Bearer <your_token>"
```

---

## PATCH /leave-requests/:id/reject

Reject a leave request with a required reason. Requires `leave:approve` permission.

**Authentication:** Required  
**Permissions:** `leave:approve`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Leave request ID to reject |

### Request Body

**Schema:**
```json
{
  "reason": "string (minimum 2 characters, required)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `reason` | String | Yes | No | Min 2 chars | Justification for rejection (required) |

**Example Request (Test Payload):**
```json
{
  "reason": "Critical project deadline. Cannot afford absence during this period."
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "c1d2e3f4-a5b6-7890-cdef-012345678901",
    "status": "rejected",
    "reviewed_by": "HR001",
    "reviewed_at": "2025-05-06T15:05:00.000Z",
    "review_note": "Critical project deadline. Cannot afford absence during this period.",
    "message": "Leave request rejected"
  }
}
```

**Fields in `data`:**
- `id` (UUID): Leave request ID
- `status` (String): Updated to `"rejected"`
- `reviewed_by` (String): User ID who rejected
- `reviewed_at` (Timestamp): Rejection timestamp
- `review_note` (String): The rejection reason provided in the request body
- `message` (String): Success confirmation

**Error Responses:**
- `422 Validation Error`: Missing or too short reason
- `404 Not Found`: Leave request doesn't exist
- `403 Forbidden`: User lacks approval permission

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/leave-requests/c1d2e3f4-a5b6-7890-cdef-012345678901/reject \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Critical project deadline. Cannot afford absence during this period."
  }'
```

---

## PATCH /leave-requests/:id/early-return

Mark a leave request as ended early (employee returns before the planned end date). Requires `leave:approve` permission. This adjusts the leave balance to credit the unused days.

**Authentication:** Required  
**Permissions:** `leave:approve`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Leave request ID to mark as early-returned |

### Request Body

**Schema:**
```json
{
  "end_by_force": "string (date format, required)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `end_by_force` | String | Yes | No | Valid date (YYYY-MM-DD) | The actual return date (must be between start_date and original end_date) |

**Example Request (Test Payload):**
```json
{
  "end_by_force": "2025-05-22"
}
```

**Note:** If original leave was May 20-25 (5 days) and employee returns on May 22, the system will recalculate and credit back 3 unused days to the employee's leave balance.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "c1d2e3f4-a5b6-7890-cdef-012345678901",
    "status": "ended_early",
    "original_end_date": "2025-05-25",
    "actual_end_date": "2025-05-22",
    "days_credited": 3,
    "balance_adjusted": true,
    "message": "Leave ended early. 3 day(s) credited back to leave balance."
  }
}
```

**Fields in `data`:**
- `id` (UUID): Leave request ID
- `status` (String): Updated to `"ended_early"`
- `original_end_date` (Date): Originally planned end date
- `actual_end_date` (Date): The new actual end date from request
- `days_credited` (Number): Number of unused days added back to balance
- `balance_adjusted` (Boolean): Whether leave balance was adjusted
- `message` (String): Summary of the adjustment

**Error Responses:**
- `422 Validation Error`: `end_by_force` not between start and end dates
- `404 Not Found`: Leave request doesn't exist
- `403 Forbidden`: User lacks approval permission

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/leave-requests/c1d2e3f4-a5b6-7890-cdef-012345678901/early-return \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "end_by_force": "2025-05-22"
  }'
```

---

## GET /leave-requests/balances

Retrieve leave balances for all employees (aggregated view). Requires `leave:read` permission. Supports filtering by department, location, shift, or specific employee.

**Authentication:** Required  
**Permissions:** `leave:read`

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `department_id` | UUID | Filter by department |
| `location_id` | UUID | Filter by work location |
| `shift_id` | UUID | Filter by shift |
| `employee` | String | Filter by specific employee code |
| `year` | Number | Year for which to show balances (default: current year) |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "employee_id": "EMP001",
      "employee_name": "Ahmed Khan",
      "department_name": "Engineering",
      "leave_type": "Annual Leave",
      "total_allowed": 20,
      "used": 5,
      "balance": 15,
      "year": 2025
    },
    {
      "employee_id": "EMP002",
      "employee_name": "Fatima Ali",
      "department_name": "Human Resources",
      "leave_type": "Annual Leave",
      "total_allowed": 20,
      "used": 0,
      "balance": 20,
      "year": 2025
    },
    {
      "employee_id": "EMP001",
      "employee_name": "Ahmed Khan",
      "leave_type": "Sick Leave",
      "total_allowed": 10,
      "used": 2,
      "balance": 8,
      "year": 2025
    }
  ]
}
```

**Field Details for each balance object:**

| Field | Type | Description |
|-------|------|-------------|
| `employee_id` | String | Employee code |
| `employee_name` | String | Full name |
| `department_name` | String | Department name |
| `leave_type` | String | Leave type name |
| `total_allowed` | Number | Total days allocated for the year |
| `used` | Number | Days already used |
| `balance` | Number | Remaining days (total_allowed - used) |
| `year` | Number | Calendar year |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/leave-requests/balances?year=2025&department_id=550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /leave-requests/balances/mine

Retrieve the authenticated employee's own leave balances for all leave types. No permission required beyond authentication.

**Authentication:** Required  
**Permissions:** None

### Query Parameters
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "leave_type_id": "dd0e8400-e29b-41d4-a716-446655440010",
      "leave_type_name": "Annual Leave",
      "total_allowed": 20,
      "used": 5,
      "balance": 15,
      "year": 2025
    },
    {
      "leave_type_id": "ee0e8400-e29b-41d4-a716-446655440011",
      "leave_type_name": "Sick Leave",
      "total_allowed": 10,
      "used": 2,
      "balance": 8,
      "year": 2025
    },
    {
      "leave_type_id": "ff0e8400-e29b-41d4-a716-446655440012",
      "leave_type_name": "Casual Leave",
      "total_allowed": 10,
      "used": 3,
      "balance": 7,
      "year": 2025
    }
  ]
}
```

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/leave-requests/balances/mine \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /leave-requests/calendar

Retrieve a calendar view of leave dates across employees for a given month. Useful for checking department/branch capacity and avoiding conflicts.

**Authentication:** Required  
**Permissions:** `leave:read`

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `month` | Number (1-12) | Month number. Default: current month |
| `year` | Number | Year. Default: current year |
| `department_id` | UUID | Filter by specific department |
| `branch_id` | UUID | Filter by specific branch/location |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "month": 5,
    "year": 2025,
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "department_name": "Engineering",
    "calendar": {
      "2025-05-01": [
        {
          "employee_id": "EMP002",
          "employee_name": "Fatima Ali",
          "leave_type": "Annual Leave",
          "status": "approved"
        }
      ],
      "2025-05-05": [
        {
          "employee_id": "EMP001",
          "employee_name": "Ahmed Khan",
          "leave_type": "Sick Leave",
          "status": "approved"
        },
        {
          "employee_id": "EMP003",
          "employee_name": "Bilal Ahmed",
          "leave_type": "Casual Leave",
          "status": "pending"
        }
      ],
      "2025-05-10": [
        {
          "employee_id": "EMP004",
          "employee_name": "Sana Malik",
          "leave_type": "Annual Leave",
          "status": "approved"
        }
      ]
    },
    "summary": {
      "total_leave_days": 25,
      "unique_employees_on_leave": 8,
      "max_leave_day": "2025-05-05",
      "max_leave_count": 2
    }
  }
}
```

**Structure:**
- `calendar` is an object where each key is a date (`YYYY-MM-DD`)
- Each date contains an array of employees on leave that day
- Each employee object includes employee details, leave type, and approval status

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/leave-requests/calendar?month=5&year=2025&department_id=550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <your_token>"
```

---

## Notes

- **Capacity Check:** When submitting a leave request, the system checks if department capacity would be exceeded. If so, the request returns `409 Conflict` with details about which dates are over capacity.
- **Date Range:** `start_date` and `end_date` are inclusive. A request from May 20 to May 25 counts as 5 days (20, 21, 22, 23, 24).
- **Balance Validation:** The system validates that sufficient leave balance exists before allowing submission. If balance is insufficient, returns `400 Bad Request`.
- **Status Flow:** `pending` → `approved` or `rejected`. Early returns change status to `ended_early`.
- **Auto-Deduction:** Upon approval, the approved days are automatically deducted from the employee's leave balance for that leave type and year.
- **Re-Credit:** If a leave is rejected after being approved (rare), or ended early, days are credited back to the balance.
