# Calendar Events API

**Base Path:** `/api/calendar-events`  
**Total Endpoints:** 3

Calendar events are company-wide announcements and events visible to employees based on visibility settings.

---

## GET /calendar-events

Retrieve calendar events within a date range. Events are filtered by visibility based on the authenticated user's role.

**Authentication:** Required  
**Permissions:** None (any authenticated user can view events visible to them)

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | Date (YYYY-MM-DD) | Start date (inclusive) - **required** |
| `to` | Date (YYYY-MM-DD) | End date (inclusive) - **required** |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
      "type": "holiday",
      "date": "2025-05-22",
      "title": "Eid ul Fitr Holiday",
      "visibility": "all",
      "created_at": "2025-01-10T08:00:00.000Z",
      "created_by": "ADMIN001"
    },
    {
      "id": "c2d3e4f5-a6b7-8901-cdef-123456789012",
      "type": "training",
      "date": "2025-05-15",
      "title": "Annual Compliance Training",
      "visibility": "hr",
      "created_at": "2025-05-01T10:30:00.000Z",
      "created_by": "HR001"
    },
    {
      "id": "d3e4f5a6-b7c8-9012-def1-234567890123",
      "type": "meeting",
      "date": "2025-05-20",
      "title": "Department Heads Meeting",
      "visibility": "employee",
      "created_at": "2025-05-05T14:00:00.000Z",
      "created_by": "MANAGER001"
    }
  ]
}
```

**Event object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique event ID |
| `type` | String | Event category (e.g., "holiday", "training", "meeting", "reminder") |
| `date` | Date | Event date (YYYY-MM-DD) |
| `title` | String | Event title/summary |
| `visibility` | Enum | Who can see this: `"all"` (everyone), `"hr"` (HR staff only), `"employee"` (non-HR employees) |
| `created_at` | Timestamp | When event was created |
| `created_by` | String | User ID who created the event |

**Error Responses:**
- `422 Validation Error`: Missing or invalid `from`/`to` query parameters

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/calendar-events?from=2025-05-01&to=2025-05-31" \
  -H "Authorization: Bearer <your_token>"
```

---

## POST /calendar-events

Create a new calendar event. Requires `calendar:write` permission.

**Authentication:** Required  
**Permissions:** `calendar:write`

### Request Body

**Schema:**
```json
{
  "type": "string (minimum 1 character, maximum 50 characters, required)",
  "date": "string (date format YYYY-MM-DD, required)",
  "title": "string (minimum 1 character, maximum 255 characters, required)",
  "visibility": "enum: 'all' | 'hr' | 'employee' (optional, defaults to 'all')"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Max Length | Validation | Description |
|-------|------|----------|----------|------------|------------|-------------|
| `type` | String | Yes | No | 50 | Min 1 char | Event type/category |
| `date` | String | Yes | No | - | Valid date | Event date (YYYY-MM-DD) |
| `title` | String | Yes | No | 255 | Min 1 char | Event title |
| `visibility` | String | No | No | - | Must be one of: `all`, `hr`, `employee` | Who can see this event (default: `all`) |

**Example Request (Test Payload):**
```json
{
  "type": "holiday",
  "date": "2025-06-14",
  "title": "Independence Day Holiday",
  "visibility": "all"
}
```

For an HR-only event:
```json
{
  "type": "training",
  "date": "2025-05-20",
  "title": "Payroll Processing Workshop",
  "visibility": "hr"
}
```

### Response Body

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
    "type": "holiday",
    "date": "2025-06-14",
    "title": "Independence Day Holiday",
    "visibility": "all",
    "created_at": "2025-05-06T10:30:00.000Z",
    "created_by": "ADMIN001"
  }
}
```

**Error Responses:**
- `422 Validation Error`: Missing required fields, invalid date format, type/visibility not from allowed values

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/calendar-events \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "holiday",
    "date": "2025-06-14",
    "title": "Independence Day Holiday",
    "visibility": "all"
  }'
```

---

## PATCH /calendar-events/:id

Update an existing calendar event. Requires `calendar:write` permission. Only the creator or users with appropriate permissions can update.

**Authentication:** Required  
**Permissions:** `calendar:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Calendar event ID to update |

### Request Body

All fields are optional. Provide only the fields you want to change.

**Schema:**
```json
{
  "type": "string (minimum 1 character, maximum 50 characters, optional)",
  "date": "string (date format YYYY-MM-DD, optional)",
  "title": "string (minimum 1 character, maximum 255 characters, optional)",
  "visibility": "enum: 'all' | 'hr' | 'employee' (optional)"
}
```

**At least one field must be provided** - cannot send an empty update.

**Example Request (Test Payload):**
```json
{
  "title": "Annual Compliance Training - Rescheduled",
  "date": "2025-05-22"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "c2d3e4f5-a6b7-8901-cdef-123456789012",
    "type": "training",
    "date": "2025-05-22",
    "title": "Annual Compliance Training - Rescheduled",
    "visibility": "hr",
    "updated_at": "2025-05-06T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Event ID doesn't exist
- `422 Validation Error`: No valid fields provided or validation fails
- `403 Forbidden`: User lacks permission to update this event

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/calendar-events/c2d3e4f5-a6b7-8901-cdef-123456789012 \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Annual Compliance Training - Rescheduled",
    "date": "2025-05-22"
  }'
```

---

## Notes

- **Visibility Logic:**
  - `all`: Everyone (all authenticated users) can see the event
  - `hr`: Only users with HR roles (those with `role_name` accessing HR endpoints) can see
  - `employee`: Non-HR employees can see (HR can also see these)
- **Event Types:** The `type` field is free text but typically values like: `holiday`, `training`, `meeting`, `reminder`, `deadline`, `event`. You can use any meaningful category.
- **Date Range Queries:** The `from` and `to` parameters are both inclusive. If you want events for May 2025, use `from=2025-05-01&to=2025-05-31`.
- **No Deletion:** This API does not support DELETE. To "remove" an event, you would either update its visibility or archive it in the database via admin access.
