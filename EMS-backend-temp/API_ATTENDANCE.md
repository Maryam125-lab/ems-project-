# Attendance API

**Base Path:** `/api/attendance`  
**Total Endpoints:** 7

Attendance endpoints manage daily attendance sheets, submission to head office, unlock requests, and reporting.

---

## GET /attendance

Retrieve the attendance sheet for a specific date (defaults to today). Returns employee attendance records with shift details and acknowledgment status.

**Authentication:** Required (Bearer token or cookies)  
**Permissions:** `attendance:read`

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | Date (YYYY-MM-DD) | Date to retrieve attendance for. Defaults to current date if not provided. |
| `location_id` | UUID | Filter by branch/location ID |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "date": "2025-05-06",
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "location_name": "Head Office",
    "rows": [
      {
        "employee_id": "EMP001",
        "name": "Ahmed Khan",
        "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
        "shift_name": "Morning Shift",
        "check_in": "09:05",
        "check_out": "18:10",
        "status": "present",
        "notes": null,
        "ack": true,
        "ack_by": "HR001",
        "ack_at": "2025-05-06T16:00:00.000Z"
      },
      {
        "employee_id": "EMP002",
        "name": "Fatima Ali",
        "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
        "shift_name": "Morning Shift",
        "check_in": null,
        "check_out": null,
        "status": "absent",
        "notes": "Sick leave approved",
        "ack": null,
        "ack_by": null,
        "ack_at": null
      }
    ]
  }
}
```

**Field Details for `data`:**
- `date` (Date): The attendance date
- `location_id` (UUID): Branch/location ID
- `location_name` (String): Human-readable location name
- `rows` (Array): List of attendance records

**Each row object contains:**
- `employee_id` (String): Employee code
- `name` (String): Employee name
- `shift_id` (UUID): Associated shift ID
- `shift_name` (String): Shift name
- `check_in` (Time or null): Check-in time in `HH:MM` or `HH:MM:SS` format
- `check_out` (Time or null): Check-out time
- `status` (Enum): One of `present`, `absent`, `late`, `half_day`, `on_leave`
- `notes` (String or null): Additional notes (reason for absence, etc.)
- `ack` (Boolean or null): Acknowledgment flag (true = employee has acknowledged)
- `ack_by` (String or null): User ID who acknowledged
- `ack_at` (Timestamp or null): When acknowledgment occurred

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/attendance?date=2025-05-06&location_id=aa0e8400-e29b-41d4-a716-446655440006" \
  -H "Authorization: Bearer <your_token>"
```

---

## PUT /attendance/save

Save or update attendance sheet for a specific date and location. Creates or updates multiple attendance records in a batch.

**Authentication:** Required  
**Permissions:** `attendance:write`

### Request Body

**Schema:**
```json
{
  "date": "string (min 8 characters, required)",
  "location_id": "UUID (required)",
  "rows": [
    {
      "employee_id": "string (min 3, max 10 characters, required)",
      "shift_id": "UUID (required)",
      "check_in": "string (HH:MM or HH:MM:SS format) or null (optional)",
      "check_out": "string (HH:MM or HH:MM:SS format) or null (optional)",
      "status": "enum: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' (required)",
      "notes": "string or null (optional)",
      "ack": "boolean or null (optional)"
    }
  ] (minimum 1 row required)
}
```

**Field Details:**

**Top-level fields (`data`):**
| Field | Type | Required | Nullable | Description |
|-------|------|----------|----------|-------------|
| `date` | String | Yes | No | The attendance date (any date format, must be min 8 chars) |
| `location_id` | UUID | Yes | No | Branch/location where attendance is recorded |
| `rows` | Array | Yes | No | Array of attendance row objects (at least 1 required) |

**Row object fields:**
| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `employee_id` | String | Yes | No | Min 3, max 10 chars | Employee code (e.g., "EMP001") |
| `shift_id` | UUID | Yes | No | Valid UUID | Shift ID for late calculation |
| `check_in` | String | No | Yes | HH:MM or HH:MM:SS | Employee check-in time |
| `check_out` | String | No | Yes | HH:MM or HH:MM:SS | Employee check-out time |
| `status` | Enum | Yes | No | present/absent/late/half_day/on_leave | Attendance status |
| `notes` | String | No | Yes | - | Additional notes (reason for absence, being late, etc.) |
| `ack` | Boolean | No | Yes | - | Acknowledgment flag set to `true` if employee has confirmed |

**Example Request (Test Payload - Complete Daily Sheet):**
```json
{
  "date": "2025-05-06",
  "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
  "rows": [
    {
      "employee_id": "EMP001",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
      "check_in": "09:05",
      "check_out": "18:10",
      "status": "present",
      "notes": null,
      "ack": true
    },
    {
      "employee_id": "EMP002",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
      "check_in": null,
      "check_out": null,
      "status": "absent",
      "notes": "Sick leave approved",
      "ack": false
    },
    {
      "employee_id": "EMP003",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440008",
      "check_in": "10:30",
      "check_out": "19:00",
      "status": "late",
      "notes": "Traffic jam",
      "ack": null
    },
    {
      "employee_id": "EMP004",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
      "check_in": "09:00",
      "check_out": "13:30",
      "status": "half_day",
      "notes": "Personal work - left early",
      "ack": null
    },
    {
      "employee_id": "EMP005",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
      "check_in": null,
      "check_out": null,
      "status": "on_leave",
      "notes": "Annual leave",
      "ack": true
    }
  ]
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "date": "2025-05-06",
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "rows_saved": 5,
    "message": "Attendance sheet saved successfully"
  }
}
```

**Fields in `data`:**
- `date` (Date): The saved date
- `location_id` (UUID): Location ID
- `rows_saved` (Number): Number of attendance rows processed
- `message` (String): Success confirmation message

**Error Responses:**
- `422 Validation Error`: Missing required fields, invalid time format, empty rows array, invalid UUIDs
- `400 Bad Request`: Invalid request structure

**Example cURL:**

```bash
curl -X PUT http://localhost:3001/api/attendance/save \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-05-06",
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "rows": [
      {
        "employee_id": "EMP001",
        "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
        "check_in": "09:05",
        "check_out": "18:10",
        "status": "present",
        "ack": true
      },
      {
        "employee_id": "EMP002",
        "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
        "status": "absent",
        "notes": "Sick leave"
      }
    ]
  }'
```

---

## POST /attendance/submit

Submit the attendance sheet to Head Office. Once submitted, the sheet is locked and cannot be edited without an unlock request. Requires `attendance:submit_ho` permission.

**Authentication:** Required  
**Permissions:** `attendance:submit_ho`

### Request Body

**Schema:**
```json
{
  "date": "string (min 8 characters, required)",
  "location_id": "UUID (required)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Description |
|-------|------|----------|----------|-------------|
| `date` | String | Yes | No | The date of the attendance sheet to submit |
| `location_id` | UUID | Yes | No | Location/branch ID of the sheet |

**Example Request (Test Payload):**
```json
{
  "date": "2025-05-06",
  "location_id": "aa0e8400-e29b-41d4-a716-446655440006"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Attendance sheet submitted to Head Office",
    "submitted_at": "2025-05-06T16:45:00.000Z",
    "submitted_by": "HR001"
  }
}
```

**Fields in `data`:**
- `message` (String): Success message
- `submitted_at` (Timestamp): When the submission occurred
- `submitted_by` (String): User ID who submitted

**Error Responses:**
- `409 Conflict`: Sheet for this date/location already submitted
- `422 Validation Error`: Missing date or location_id
- `404 Not Found`: Sheet not found for the given date/location

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/attendance/submit \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-05-06",
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006"
  }'
```

---

## POST /attendance/unlock-request

Request to unlock a previously submitted attendance sheet for corrections. Unlock requests require Head Office approval. Requires `attendance:write` permission.

**Authentication:** Required  
**Permissions:** `attendance:write`

### Request Body

**Schema:**
```json
{
  "date": "string (min 8 characters, required)",
  "location_id": "UUID (required)",
  "reason": "string (minimum 3 characters, required)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `date` | String | Yes | No | Min 8 chars | Date of the attendance sheet to unlock |
| `location_id` | UUID | Yes | No | Valid UUID | Location/branch ID |
| `reason` | String | Yes | No | Min 3 chars | Justification for why the sheet needs to be unlocked |

**Example Request (Test Payload):**
```json
{
  "date": "2025-05-05",
  "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
  "reason": "Need to correct check-out time for EMP003 - system logged wrong time"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Unlock request submitted successfully",
    "request_id": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
    "status": "pending_approval"
  }
}
```

**Fields in `data`:**
- `message` (String): Confirmation message
- `request_id` (UUID): Unique ID for tracking this unlock request
- `status` (String): Current status, typically `"pending_approval"`

**Error Responses:**
- `422 Validation Error`: Missing required fields or reason too short
- `404 Not Found`: No submitted sheet found for that date/location
- `409 Conflict`: Unlock request already pending for this sheet

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/attendance/unlock-request \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-05-05",
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "reason": "Need to correct check-out time"
  }'
```

---

## POST /attendance/unlock-approve

Approve an unlock request (Head Office action). Once approved, the attendance sheet becomes editable again. Requires `attendance:unlock` permission.

**Authentication:** Required  
**Permissions:** `attendance:unlock`

### Request Body

**Schema:**
```json
{
  "date": "string (min 8 characters, required)",
  "location_id": "UUID (required)",
  "unlock_reason": "string (minimum 3 characters, required)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `date` | String | Yes | No | Min 8 chars | Date of the attendance sheet to unlock |
| `location_id` | UUID | Yes | No | Valid UUID | Location/branch ID |
| `unlock_reason` | String | Yes | No | Min 3 chars | Reason for approving the unlock (for audit trail) |

**Example Request (Test Payload):**
```json
{
  "date": "2025-05-05",
  "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
  "unlock_reason": "Approved for correction. Branch HR can now edit and resubmit."
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Attendance sheet unlocked successfully",
    "unlocked_at": "2025-05-06T09:00:00.000Z",
    "unlocked_by": "HO001",
    "sheet_date": "2025-05-05",
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006"
  }
}
```

**Fields in `data`:**
- `message` (String): Confirmation message
- `unlocked_at` (Timestamp): When the unlock was approved
- `unlocked_by` (String): User ID of the approver (HO user)
- `sheet_date` (Date): Date of the unlocked sheet
- `location_id` (UUID): Location ID

**Error Responses:**
- `422 Validation Error`: Missing required fields
- `404 Not Found`: No unlock request found or sheet doesn't exist
- `409 Conflict`: Sheet already unlocked or already resubmitted

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/attendance/unlock-approve \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-05-05",
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "unlock_reason": "Approved for correction. Please update and resubmit."
  }'
```

---

## PATCH /attendance/:id/ack

Acknowledge an attendance record (employee signature/confirmation). The `id` parameter is the attendance record's database ID. No specific permission required; any authenticated user can acknowledge.

**Authentication:** Required  
**Permissions:** None (any authenticated user)

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Attendance record ID (from `attendance` table) |

### Request Body
None. This is a simple acknowledgment endpoint with no request body.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Attendance record acknowledged",
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "employee_id": "EMP001",
    "date": "2025-05-06",
    "ack": true,
    "ack_at": "2025-05-06T10:30:00.000Z",
    "ack_by": "EMP001"
  }
}
```

**Fields in `data`:**
- `message` (String): Confirmation message
- `id` (UUID): The attendance record ID
- `employee_id` (String): Employee code
- `date` (Date): Attendance date
- `ack` (Boolean): Acknowledgment status (always `true` after this call)
- `ack_at` (Timestamp): When acknowledgment occurred
- `ack_by` (String): User ID who acknowledged (typically the employee themselves)

**Error Responses:**
- `404 Not Found`: Attendance record with given ID doesn't exist

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/attendance/123e4567-e89b-12d3-a456-426614174000/ack \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /attendance/report

Generate a monthly attendance report with aggregated metrics, summaries, and department breakdowns.

**Authentication:** Required  
**Permissions:** `attendance:read`

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `month` | Number (1-12) | Month number. Default: current month if not provided |
| `year` | Number (2020+) | Year. Default: current year if not provided |
| `location_id` | UUID | Optional filter by branch/location |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "report_date": "2025-05-06",
    "month": 5,
    "year": 2025,
    "location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "summary": {
      "total_employees": 50,
      "total_working_days": 22,
      "total_present_days": 1050,
      "total_absent_days": 50,
      "total_late_days": 30,
      "attendance_rate": "91.3%"
    },
    "department_breakdown": [
      {
        "department_id": "550e8400-e29b-41d4-a716-446655440001",
        "department_name": "Engineering",
        "employees": 15,
        "avg_attendance_rate": "93.5%"
      },
      {
        "department_id": "550e8400-e29b-41d4-a716-446655440002",
        "department_name": "Human Resources",
        "employees": 5,
        "avg_attendance_rate": "97.2%"
      },
      {
        "department_id": "550e8400-e29b-41d4-a716-446655440003",
        "department_name": "Sales",
        "employees": 12,
        "avg_attendance_rate": "89.1%"
      }
    ]
  }
}
```

**Fields in `data`:**
- `report_date` (Date): When the report was generated
- `month` (Number): Month number (1-12)
- `year` (Number): Year
- `location_id` (UUID or null): Location filter if provided
- `summary` (Object): Overall statistics
  - `total_employees` (Number): Number of employees in the scope
  - `total_working_days` (Number): Total working days in the month
  - `total_present_days` (Number): Total days marked present across all employees
  - `total_absent_days` (Number): Total days marked absent
  - `total_late_days` (Number): Total days marked late
  - `attendance_rate` (String): Overall attendance percentage as formatted string
- `department_breakdown` (Array): Per-department statistics
  - `department_id` (UUID): Department ID
  - `department_name` (String): Department name
  - `employees` (Number): Number of employees in that department
  - `avg_attendance_rate` (String): Average attendance rate for department

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/attendance/report?month=5&year=2025&location_id=aa0e8400-e29b-41d4-a716-446655440006" \
  -H "Authorization: Bearer <your_token>"
```

---

## Notes

- **Time Format:** Check-in and check-out times must be in `HH:MM` or `HH:MM:SS` format (24-hour time).
- **Status Enum:** The `status` field accepts exactly one of: `present`, `absent`, `late`, `half_day`, `on_leave`.
- ** Submission Flow:** After saving an attendance sheet with `PUT /save`, it must be submitted via `POST /submit` to lock it. Once submitted, edits require an unlock request (`POST /unlock-request`) and approval (`POST /unlock-approve`).
- **Date Handling:** The `date` field accepts any string format internally, but it's recommended to use `YYYY-MM-DD` for consistency.
- **Acknowledgment:** Employees can acknowledge their attendance records via `PATCH /attendance/:id/ack`. This serves as a confirmation/electronic signature.
