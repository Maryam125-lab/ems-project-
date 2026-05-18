# Notifications API

**Base Path:** `/api/notifications`  
**Total Endpoints:** 3

Notifications are system-generated alerts and messages for users. They can be global (role-based) or individual.

---

## GET /notifications

Retrieve notifications for the authenticated user. Returns notifications targeted at the user specifically or to their role.

**Authentication:** Required  
**Permissions:** None (any authenticated user can fetch their own notifications)

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | Enum | Must be `"me"` (only supported value) |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "d3e4f5a6-b7c8-9012-def1-234567890123",
      "type": "leave_approved",
      "message": "Your leave request for Annual Leave (May 20-25) has been approved",
      "is_read": false,
      "created_at": "2025-05-06T09:15:00.000Z",
      "metadata": {
        "leave_request_id": "c1d2e3f4-a5b6-7890-cdef-012345678901"
      }
    },
    {
      "id": "e4f5a6b7-c8d9-0123-ef23-456789012345",
      "type": "penalty_assigned",
      "message": "A penalty has been assigned to you: Late Arrival Fine",
      "is_read": true,
      "read_at": "2025-05-06T10:30:00.000Z",
      "created_at": "2025-05-06T08:45:00.000Z",
      "metadata": {
        "penalty_id": "f4a5b6c7-d8e9-0123-f456-789012345678"
      }
    },
    {
      "id": "f5a6b7c8-d9e0-1234-f234-567890123456",
      "type": "system_announcement",
      "message": "Maintenance scheduled for May 10, 2025 from 2 AM to 4 AM",
      "is_read": false,
      "created_at": "2025-05-05T16:00:00.000Z",
      "metadata": null
    }
  ]
}
```

**Notification object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique notification ID |
| `type` | String | Notification category (e.g., `leave_approved`, `penalty_assigned`, `system_announcement`, `attendance_submitted`) |
| `message` | String | Human-readable notification text |
| `is_read` | Boolean | Whether user has marked this as read (`true`) or unread (`false`) |
| `read_at` | Timestamp or null | When the notification was marked as read |
| `created_at` | Timestamp | When the notification was generated |
| `metadata` | Object or null | Additional context-specific data (e.g., related record IDs) |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/notifications?scope=me" \
  -H "Authorization: Bearer <your_token>"
```

---

## PATCH /notifications/:id/read

Mark a specific notification as read. Any authenticated user can mark their own notifications as read.

**Authentication:** Required  
**Permissions:** None

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Notification ID to mark as read |

### Request Body
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "d3e4f5a6-b7c8-9012-def1-234567890123",
    "is_read": true,
    "read_at": "2025-05-06T11:00:00.000Z",
    "message": "Notification marked as read"
  }
}
```

**Error Responses:**
- `404 Not Found`: Notification ID doesn't exist or doesn't belong to user

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/notifications/d3e4f5a6-b7c8-9012-def1-234567890123/read \
  -H "Authorization: Bearer <your_token>"
```

---

## POST /notifications

Create a new notification (system-generated or admin-created). Used internally by the system or by admins to send alerts to users or roles. Requires `notifications:write` permission.

**Authentication:** Required  
**Permissions:** `notifications:write`

### Request Body

**Schema:**
```json
{
  "user_id": "UUID or null (optional, nullable)",
  "role": "string (optional, nullable)",
  "type": "string (minimum 1 character, maximum 50 characters, required)",
  "message": "string (minimum 1 character, required)"
}
```

**Validation:** Exactly one of `user_id` or `role` must be provided (they are mutually exclusive). If both are provided, `user_id` takes precedence.

**Field Details:**

| Field | Type | Required | Nullable | Max Length | Description |
|-------|------|----------|----------|------------|-------------|
| `user_id` | UUID | No | Yes | - | Target specific user. If provided, notification goes only to this user |
| `role` | String | No | Yes | 100 | Target all users with this role (e.g., "hr_manager", "super_admin") |
| `type` | String | Yes | No | 50 | Notification category/type |
| `message` | String | Yes | No | - | Notification text to display |

**Example Request (Test Payload - User-Specific):**
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "leave_approved",
  "message": "Your leave request has been approved. Enjoy your time off!"
}
```

Example Request (Role-Based):
```json
{
  "role": "hr_manager",
  "type": "system_announcement",
  "message": "Monthly HR report is due by May 25th. Please submit through the dashboard."
}
```

### Response Body

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "f5a6b7c8-d9e0-1234-f234-567890123456",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "role": null,
    "type": "leave_approved",
    "message": "Your leave request has been approved. Enjoy your time off!",
    "created_at": "2025-05-06T12:00:00.000Z"
  }
}
```

**Fields in `data`:**
- `id` (UUID): New notification ID
- `user_id` (UUID or null): Target user ID if specified
- `role` (String or null): Target role if specified
- `type` (String): Notification type
- `message` (String): Notification message
- `created_at` (Timestamp): Creation timestamp

**Error Responses:**
- `422 Validation Error`: Neither `user_id` nor `role` provided, or both are null
- `404 Not Found`: Specified `user_id` doesn't exist

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "type": "system_announcement",
    "message": "Your password will expire in 7 days. Please change it."
  }'
```

---

## Notes

- **Targeting:** Notifications can be targeted to a specific user (`user_id`) or broadcast to all users with a specific `role`. The system uses this to send leave approvals, penalty assignments, etc.
- **Unread Count:** Frontend apps typically query this endpoint and filter by `is_read: false` to show notification badges/counts.
- **Scope Parameter:** Currently only `scope=me` is supported. This is a required query parameter for the GET endpoint.
- **Automatic Notifications:** The system automatically creates notifications when:
  - Leave request is approved/rejected
  - Penalty is assigned and when approved
  - Attendance sheet is submitted/unlocked
  - System-wide announcements from admins
- **Mark as Read:** The `PATCH /notifications/:id/read` endpoint simply flips `is_read` to `true` and records `read_at`. Users can also bulk mark as read via frontend (multiple parallel calls).
- **Deletion:** Notifications are typically not deleted but kept for audit purposes. Old notifications may be archived by system admin.
