# Directory API

**Base Path:** `/api/directory`  
**Total Endpoints:** 3

The employee directory provides searchable contact information for employees across the organization. It's a public-facing contact list with employee details like email, phone, department, and availability status.

---

## GET /directory

Retrieve directory entries (employee contacts) with optional filtering. Available to all authenticated users with `directory:read` permission.

**Authentication:** Required  
**Permissions:** `directory:read`

### Query Parameters

All parameters are optional and can be combined.

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch_id` | UUID | Filter by work location/branch |
| `department_id` | UUID | Filter by department |
| `search` | String | Search by name, email, or employee_id (partial match) |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "g6a7b8c9-d0e1-2345-6789-012345678901",
      "employee_id": "EMP001",
      "name": "Ahmed Khan",
      "email": "ahmed.khan@company.com",
      "phone_internal": "03001234567",
      "phone_mobile": "03331234567",
      "phone_mobile_public": false,
      "role_title": "Senior Developer",
      "department_id": "550e8400-e29b-41d4-a716-446655440001",
      "department_name": "Engineering",
      "branch_id": "aa0e8400-e29b-41d4-a716-446655440006",
      "branch_name": "Head Office",
      "availability": "available",
      "is_active": true
    },
    {
      "id": "h7b8c9d0-e1f2-3456-7890-123456789012",
      "employee_id": "EMP002",
      "name": "Fatima Ali",
      "email": "fatima.ali@company.com",
      "phone_internal": "03009876543",
      "phone_mobile": "03339876543",
      "phone_mobile_public": true,
      "role_title": "HR Manager",
      "department_id": "550e8400-e29b-41d4-a716-446655440002",
      "department_name": "Human Resources",
      "branch_id": "aa0e8400-e29b-41d4-a716-446655440006",
      "branch_name": "Head Office",
      "availability": "busy",
      "is_active": true
    }
  ]
}
```

**Directory entry fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Directory entry record ID |
| `employee_id` | String | Employee code |
| `name` | String | Full name |
| `email` | String or null | Work email address |
| `phone_internal` | String or null | Internal extension or direct line |
| `phone_mobile` | String or null | Mobile number |
| `phone_mobile_public` | Boolean | Whether mobile number is visible to others |
| `role_title` | String or null | Job title/designation |
| `department_id` | UUID | Department reference |
| `department_name` | String | Resolved department name |
| `branch_id` | UUID | Work location/branch reference |
| `branch_name` | String | Resolved location name |
| `availability` | Enum | Availability status: `available`, `busy`, `out_of_office` |
| `is_active` | Boolean | Whether employee is currently active |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/directory?department_id=550e8400-e29b-41d4-a716-446655440001&search=Ahmed" \
  -H "Authorization: Bearer <your_token>"
```

---

## POST /directory

Create or update a directory entry. This endpoint is typically used by admins or HR to manage directory information. Requires `directory:write` permission.

**Authentication:** Required  
**Permissions:** `directory:write`

### Request Body

**Schema:**
```json
{
  "employee_id": "string (min 3, max 10) or null (optional)",
  "name": "string (minimum 1 character, required)",
  "email": "string (email format) or null (optional)",
  "phone_internal": "string or null (optional)",
  "phone_mobile": "string or null (optional)",
  "phone_mobile_public": "boolean (optional)",
  "role_title": "string or null (optional)",
  "department_id": "UUID or null (optional)",
  "branch_id": "UUID or null (optional)",
  "availability": "enum: 'available' | 'busy' | 'out_of_office' (optional)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Max Length | Description |
|-------|------|----------|----------|------------|-------------|
| `employee_id` | String | No | Yes | 10 | Associated employee code. If provided, links to employee record |
| `name` | String | Yes | No | - | Full name (min 1 char) |
| `email` | String | No | Yes | - | Work email (must be valid email if provided) |
| `phone_internal` | String | No | Yes | - | Internal phone number/extension |
| `phone_mobile` | String | No | Yes | - | Mobile number |
| `phone_mobile_public` | Boolean | No | No | - | If true, mobile number is visible to other directory users |
| `role_title` | String | No | Yes | - | Job position/title |
| `department_id` | UUID | No | Yes | - | Department reference |
| `branch_id` | UUID | No | Yes | - | Work location reference |
| `availability` | String | No | Yes | - | One of: `available`, `busy`, `out_of_office` (default system may infer) |

**Example Request (Test Payload - Complete Entry):**
```json
{
  "employee_id": "EMP015",
  "name": "Nisar Ahmed",
  "email": "nisar.ahmed@company.com",
  "phone_internal": "2001",
  "phone_mobile": "03331234567",
  "phone_mobile_public": true,
  "role_title": "Software Engineer",
  "department_id": "550e8400-e29b-41d4-a716-446655440001",
  "branch_id": "aa0e8400-e29b-41d4-a716-446655440006",
  "availability": "available"
}
```

### Response Body

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "g6a7b8c9-d0e1-2345-6789-012345678901",
    "employee_id": "EMP015",
    "name": "Nisar Ahmed",
    "email": "nisar.ahmed@company.com",
    "phone_internal": "2001",
    "phone_mobile": "03331234567",
    "phone_mobile_public": true,
    "role_title": "Software Engineer",
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "branch_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "availability": "available",
    "is_active": true,
    "created_at": "2025-05-06T14:00:00.000Z"
  }
}
```

**Error Responses:**
- `422 Validation Error`: Invalid email, missing required name field
- `404 Not Found`: Specified `employee_id` doesn't exist in employee table
- `409 Conflict`: Entry for this employee_id already exists (use PATCH to update)

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/directory \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP015",
    "name": "Nisar Ahmed",
    "email": "nisar.ahmed@company.com",
    "phone_internal": "2001",
    "phone_mobile": "03331234567",
    "phone_mobile_public": true,
    "role_title": "Software Engineer",
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "branch_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "availability": "available"
  }'
```

---

## PATCH /directory/:id

Update an existing directory entry. Requires `directory:write` permission.

**Authentication:** Required  
**Permissions:** `directory:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Directory entry ID to update |

### Request Body

All fields are optional (partial update). Schema is the same as POST.

**Example Request (Partial Update - Change Availability Only):**
```json
{
  "availability": "busy"
}
```

**Example Request (Update Multiple Fields):**
```json
{
  "phone_mobile": "03339876543",
  "phone_mobile_public": true,
  "role_title": "Senior Software Engineer"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "g6a7b8c9-d0e1-2345-6789-012345678901",
    "employee_id": "EMP015",
    "name": "Nisar Ahmed",
    "email": "nisar.ahmed@company.com",
    "phone_internal": "2001",
    "phone_mobile": "03339876543",
    "phone_mobile_public": true,
    "role_title": "Senior Software Engineer",
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "branch_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "availability": "busy",
    "updated_at": "2025-05-06T14:15:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Directory entry ID doesn't exist
- `422 Validation Error`: Invalid data
- `403 Forbidden`: User lacks write permission

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/directory/g6a7b8c9-d0e1-2345-6789-012345678901 \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "availability": "busy",
    "role_title": "Senior Software Engineer"
  }'
```

---

## Notes

- **Purpose:** The directory is a separate table that denormalizes employee information for quick lookup and public contact listing. It may be auto-populated from employee records but can be manually updated via this API.
- **Visibility Control:** Use `phone_mobile_public` to control whether the mobile number is shown in directory responses to other users.
- **Availability Status:** The `availability` field is manually set or could be auto-updated based on presence/attendance. Values:
  - `available`: Free to talk/interrupt
  - `busy`: In meeting or focused work
  - `out_of_office`: Not in office (leave, remote, etc.)
- **Linking to Employees:** Providing `employee_id` links the directory entry to an actual employee record. This enables automatic updates from employee master data.
- **Soft Delete:** There is no DELETE endpoint. To remove someone from directory, set `is_active: false` via PATCH (if implemented) or delete via database directly.
- **Search:** The `search` query parameter performs a case-insensitive partial match on `name`, `email`, and `employee_id` fields.
