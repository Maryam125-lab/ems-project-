# Configuration API

**Base Path:** `/api/config`  
**Total Endpoints:** 3

Configuration endpoints manage lookup tables and system configuration entities like departments, designations, shifts, leave types, etc. These are dynamic configuration values that the system uses as reference data.

---

## Overview

The Configuration API is a **generic** endpoint that operates on different entity types via the `:entity` path parameter. The request/response schemas vary depending on which entity you're working with.

### Supported Entities

| Entity Name | Description | Key Fields |
|-------------|-------------|------------|
| `departments` | Company departments | `department_code`, `department_name`, `parent_department_id` |
| `designations` | Job titles/positions | `title`, `is_active` |
| `employment-types` | Employment types (FT, PT, Contract) | `type_name`, `is_active` |
| `job-statuses` | Employment status (active, on_leave, terminated) | `status_name`, `is_active` |
| `work-modes` | Work mode (onsite, remote, hybrid) | `mode_name`, `is_active` |
| `work-locations` | Branch/location info | `location_name`, `is_active` |
| `shifts` | Work shift definitions | `name`, `start_time`, `end_time`, `late_after_minutes`, `is_active` |
| `leave-types` | Types of leave (annual, sick, casual) | `name`, `is_active` |
| `leave-policies` | Leave allocation policies per department/type/year | `department_id`, `leave_type_id`, `days_allowed`, `year`, `is_active` |
| `leave-capacity` | Department capacity limits for concurrent leaves | `department_id`, `max_percent`, `is_active` |
| `penalty-rules` | Penalty rule definitions | `name`, `amount_pkr`, `type`, `is_active` |

**Note:** The `:entity` path parameter must be one of the values listed above (plural form).

---

## GET /config/:entity

Retrieve all records for a given configuration entity. Requires `config:read` permission.

**Authentication:** Required  
**Permissions:** `config:read`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entity` | String | Entity type from the supported list (e.g., `departments`, `designations`, `shifts`) |

### Query Parameters
Varies by entity - typically none.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    // Array of records for the requested entity
  ]
}
```

**Examples by entity:**

**GET /config/departments:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "department_code": "ENG",
      "department_name": "Engineering",
      "parent_department_id": null,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "department_code": "HR",
      "department_name": "Human Resources",
      "parent_department_id": null,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**GET /config/shifts:**
```json
{
  "success": true,
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440007",
      "name": "Morning Shift",
      "start_time": "09:00",
      "end_time": "18:00",
      "late_after_minutes": 15,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440008",
      "name": "Afternoon Shift",
      "start_time": "14:00",
      "end_time": "22:00",
      "late_after_minutes": 15,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**GET /config/leave-policies:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440009",
      "department_id": "550e8400-e29b-41d4-a716-446655440001",
      "department_name": "Engineering",
      "leave_type_id": "dd0e8400-e29b-41d4-a716-446655440010",
      "leave_type_name": "Annual Leave",
      "days_allowed": 20,
      "year": 2025,
      "is_active": true,
      "created_at": "2024-12-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found`: Entity name is not recognized/supported

---

## POST /config/:entity

Create a new record for the specified entity. Requires `config:write` permission.

**Authentication:** Required  
**Permissions:** `config:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entity` | String | Entity type (same list as above) |

### Request Body

The schema varies by entity. See the table below for required fields per entity.

**General Pattern:**
```json
{
  // Entity-specific fields
}
```

**Schemas by Entity:**

**departments:**
```json
{
  "department_code": "string (min 1, required)",
  "department_name": "string (min 1, required)",
  "parent_department_id": "UUID or null (optional)"
}
```

**designations:**
```json
{
  "title": "string (min 1, max 50, required)",
  "is_active": "boolean (optional, default: true)"
}
```

**employment-types:**
```json
{
  "type_name": "string (min 1, max 50, required)",
  "is_active": "boolean (optional, default: true)"
```

**job-statuses:**
```json
{
  "status_name": "string (min 1, max 50, required)",
  "is_active": "boolean (optional, default: true)"
}
```

**work-modes:**
```json
{
  "mode_name": "string (min 1, max 50, required)",
  "is_active": "boolean (optional, default: true)"
}
```

**work-locations:**
```json
{
  "location_name": "string (min 1, max 100, required)",
  "is_active": "boolean (optional, default: true)"
}
```

**shifts:**
```json
{
  "name": "string (min 1, required)",
  "start_time": "string (HH:MM format, required)",
  "end_time": "string (HH:MM format, required)",
  "late_after_minutes": "integer >= 0 (optional, default: 15)",
  "is_active": "boolean (optional, default: true)"
}
```

**leave-types:**
```json
{
  "name": "string (min 1, max 50, required)",
  "is_active": "boolean (optional, default: true)"
}
```

**leave-policies:**
```json
{
  "department_id": "UUID (required)",
  "leave_type_id": "UUID (required)",
  "days_allowed": "integer >= 0 (required)",
  "year": "integer (min 2000, required)",
  "is_active": "boolean (optional, default: true)"
}
```

**leave-capacity:**
```json
{
  "department_id": "UUID (required)",
  "max_percent": "integer (1-100, required)",
  "is_active": "boolean (optional, default: true)"
}
```

**penalty-rules:**
```json
{
  "name": "string (min 1, required)",
  "amount_pkr": "number >= 0 (required)",
  "type": "enum: 'flat' | 'percentage' (required)",
  "is_active": "boolean (optional, default: true)"
}
```

**Example Request (Creating a Department):**
```json
{
  "department_code": "FIN",
  "department_name": "Finance",
  "parent_department_id": null
}
```

**Example Request (Creating a Shift):**
```json
{
  "name": "Evening Shift",
  "start_time": "14:00",
  "end_time": "22:00",
  "late_after_minutes": 15
}
```

### Response Body

**Success (201 Created):**
Returns the newly created record with its assigned `id` and timestamps.

```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "department_code": "FIN",
    "department_name": "Finance",
    "parent_department_id": null,
    "is_active": true,
    "created_at": "2025-05-06T12:30:00.000Z"
  }
}
```

**Error Responses:**
- `422 Validation Error`: Validation fails (missing required fields, invalid format)
- `404 Not Found`: Entity type not recognized
- `409 Conflict`: Duplicate code/name (e.g., department_code already exists)

---

## PATCH /config/:entity/:id

Update an existing configuration record. Requires `config:write` permission.

**Authentication:** Required  
**Permissions:** `config:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entity` | String | Entity type |
| `id` | UUID | Record ID to update |

### Request Body

All fields are optional (partial update). Provide only the fields you want to change. Schema is the same as for POST but all fields optional.

**Example Request (Update Department Name):**
```json
{
  "department_name": "Finance & Accounts"
}
```

**Example Request (Update Shift Times):**
```json
{
  "start_time": "13:30",
  "end_time": "21:30"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "department_code": "FIN",
    "department_name": "Finance & Accounts",
    "parent_department_id": null,
    "is_active": true,
    "updated_at": "2025-05-06T13:00:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Record ID doesn't exist or entity type invalid
- `422 Validation Error`: Invalid data provided
- `409 Conflict`: Duplicate value on unique constraint

---

## Notes

- **Entity Validation:** The `:entity` path parameter must exactly match one of the supported entity names (plural). Case-sensitive.
- **Dynamic Schemas:** The backend uses a schema map (`entitySchemaMap` in config.controller.js) to validate requests based on entity type.
- **Soft Deletes:** There is no DELETE endpoint. To deactivate a record, set `is_active: false` via PATCH.
- **Lookup References:** Other parts of the API reference these configuration records by their UUIDs (e.g., `department_id`, `designation_id`, `shift_id`). Ensure you use valid UUIDs when creating employees or job info.
- **Parent-Child Relationships:** Departments support hierarchical structure via `parent_department_id` (self-referencing foreign key).
- **Leave Policies:** These define how many leave days each department/type combination gets per year. They are referenced when calculating leave balances during approval.
