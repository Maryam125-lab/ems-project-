# EMS Backend - API Documentation

**Version:** 1.0  
**Last Updated:** 2025-05-06  
**Base URL:** `http://localhost:3001/api`

---

## Overview

This is the comprehensive API documentation for the EMS (Employee Management System) backend. Each module is documented in its own file with complete payload structures, validation rules, and test examples.

---

## Quick Navigation

| Module | File | Description |
|--------|------|-------------|
| **Authentication** | [API_AUTH.md](./API_AUTH.md) | Login, logout, session management, password change |
| **Employee Management** | [API_EMPLOYEES.md](./API_EMPLOYEES.md) | CRUD operations for employees, personal/job/extra info |
| **Attendance** | [API_ATTENDANCE.md](./API_ATTENDANCE.md) | Daily attendance sheets, submission, unlock requests |
| **Leave Requests** | [API_LEAVE.md](./API_LEAVE.md) | Leave application, approval, balances, calendar |
| **Penalties** | [API_PENALTIES.md](./API_PENALTIES.md) | Penalty rules, proposals, approval workflow |
| **Calendar Events** | [API_CALENDAR.md](./API_CALENDAR.md) | Company-wide calendar events |
| **Notifications** | [API_NOTIFICATIONS.md](./API_NOTIFICATIONS.md) | User notifications and alerts |
| **Dashboard** | [API_DASHBOARD.md](./API_DASHBOARD.md) | Metrics, analytics, pending actions |
| **Configuration** | [API_CONFIG.md](./API_CONFIG.md) | Lookup tables and system configuration |
| **Directory** | [API_DIRECTORY.md](./API_DIRECTORY.md) | Employee directory and contact search |

---

## Common Conventions

### Authentication
All endpoints under `/api/*` (except `/api/auth/login`) require authentication via:
- **Bearer Token:** `Authorization: Bearer <jwt_token>`
- **OR Cookies:** `ems_jwt` cookie (automatically sent by browser)

The JWT token is obtained from the `/api/auth/login` endpoint.

### Response Format

All API responses follow a consistent envelope:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [] // Optional, included for validation errors
  }
}
```

### HTTP Status Codes

| Code | Meaning | Typical Use |
|------|---------|-------------|
| `200` | OK | Successful GET/PATCH/PUT/DELETE |
| `201` | Created | Successful POST creating new resource |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate resource or state conflict |
| `422` | Validation Error | Request body fails schema validation |
| `500` | Internal Server Error | Server-side error |

### Data Types & Formats

- **String:** Text values
- **Number:** Integer or float
- **Boolean:** `true` or `false`
- **Date:** ISO format `YYYY-MM-DD` (e.g., `"2025-05-06"`)
- **Time:** `HH:MM` or `HH:MM:SS` (e.g., `"09:30"`, `"09:30:00"`)
- **UUID:** `550e8400-e29b-41d4-a716-446655440000` (standard UUID format)
- **Enum:** Predefined set of string values
- **Nullable:** Field can be explicitly set to `null`
- **Optional:** Field can be omitted entirely from the JSON

### Permissions System

The API uses role-based access control with the following permission strings:

| Permission | Description |
|------------|-------------|
| `employees:read` | View employee data |
| `employees:write` | Create/update employee records |
| `attendance:read` | View attendance sheets |
| `attendance:write` | Save/edit attendance sheets |
| `attendance:submit_ho` | Submit attendance to head office |
| `attendance:unlock` | Approve unlock requests |
| `leave:read` | View leave requests |
| `leave:approve` | Approve or reject leave requests |
| `penalties:read_all` | View all penalties |
| `penalties:read_own` | View own penalties only |
| `penalties:propose` | Propose new penalties |
| `penalties:review` | Review and approve/reject penalties |
| `calendar:write` | Create and update calendar events |
| `notifications:write` | Create notifications |
| `dashboard:read` | View dashboard metrics and analytics |
| `pending_actions:read` | View pending action items |
| `alerts:read` | View urgent alerts |
| `config:read` | View configuration data |
| `config:write` | Modify configuration data |
| `directory:read` | Search employee directory |
| `directory:write` | Create/update directory entries |

---

## Documentation Format

Each endpoint documentation includes:

- **Description:** What the endpoint does
- **Authentication:** Whether authentication is required
- **Permissions:** Specific permission(s) needed
- **Path/Query Parameters:** Details about URL parameters
- **Request Body:** Complete JSON schema structure with all fields, types, validation rules
- **Example Request:** Full, realistic JSON payload that can be used for testing
- **Response Body:** Success response structure with example
- **Error Responses:** Common error codes and their meanings
- **Example cURL:** Ready-to-use curl command

---

## Notes

- **UUIDs:** When you see `UUID` in schemas, provide a valid UUID string (e.g., `"550e8400-e29b-41d4-a716-446655440001"`). These refer to records in lookup tables like departments, designations, etc.
- **Dates:** Always use `YYYY-MM-DD` format unless otherwise specified.
- **Times:** Use `HH:MM` (24-hour format) or `HH:MM:SS`.
- **Optional vs Required:** Pay close attention to which fields are required vs optional. Required fields must be present in the request. Optional fields can be omitted or set to `null`.
- **Partial Updates:** For PATCH endpoints, all fields are typically optional. You only need to include the fields you want to update.
- **Nested Objects:** Some endpoints use nested object structures (e.g., employee creation). The full structure is documented in the schema section.

---

## Getting Started

1. **Obtain an access token** by calling `POST /api/auth/login` with your credentials.
2. **Include the token** in subsequent requests via the `Authorization: Bearer <token>` header.
3. **Check your permissions** - some endpoints require specific roles. If you get `403 Forbidden`, you lack the necessary permission.
4. **Use the test payloads** provided in each module's documentation for quick testing in Postman, Insomnia, or curl.

Happy API exploring!

---

## Support

For issues, questions, or clarification on any endpoint, refer to the module-specific documentation files or contact the development team.
