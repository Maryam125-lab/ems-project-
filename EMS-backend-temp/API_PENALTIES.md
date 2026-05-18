# Penalties API

**Base Paths:**  
- `/api/penalties` - Penalty instances (proposals, approvals)  
- `/api/penalty-rules` - Penalty rule definitions  

**Total Endpoints:** 10

Penalty management includes defining rules (e.g., late fines) and proposing/approving penalties for employees.

---

## Penalty Rules

### GET /penalty-rules

Retrieve all active penalty rules. Available to users with `penalties:propose` permission. Super admins see all rules; others may see filtered set.

**Authentication:** Required  
**Permissions:** `penalties:propose`

### Query Parameters
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Late Arrival Fine",
      "description": "Fine for arriving more than 30 minutes late",
      "amount_pkr": 500,
      "type": "flat",
      "is_active": true,
      "created_at": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "name": "Leave Without Approval",
      "description": "Penalty for taking leave without prior approval",
      "amount_pkr": 2000,
      "type": "flat",
      "is_active": true,
      "created_at": "2024-02-01T14:30:00.000Z"
    },
    {
      "id": "c3d4e5f6-a7b8-901c-def1-234567890123",
      "name": "Attendance Shortfall",
      "description": "Percentage fine for monthly attendance below 80%",
      "amount_pkr": 5,
      "type": "percentage",
      "is_active": true,
      "created_at": "2024-03-10T09:15:00.000Z"
    }
  ]
}
```

**Rule object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique rule ID |
| `name` | String | Rule name (e.g., "Late Arrival Fine") |
| `description` | String or null | Detailed description of when the rule applies |
| `amount_pkr` | Number | Fine amount in PKR. For `type: "flat"` this is a fixed amount; for `type: "percentage"` this is a percentage (e.g., 5 = 5%) |
| `type` | Enum | Either `"flat"` (fixed amount) or `"percentage"` (percentage of base salary) |
| `is_active` | Boolean | Whether this rule is currently active |
| `created_at` | Timestamp | When the rule was created |

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/penalty-rules \
  -H "Authorization: Bearer <your_token>"
```

---

### POST /penalty-rules

Create a new penalty rule. Requires `penalty_rules:write` permission.

**Authentication:** Required  
**Permissions:** `penalty_rules:write`

### Request Body

**Schema:**
```json
{
  "name": "string (minimum 1 character, required)",
  "amount_pkr": "number (non-negative, required)",
  "type": "enum: 'flat' | 'percentage' (required)",
  "is_active": "boolean (optional, defaults to true)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `name` | String | Yes | No | Min 1 char | Rule name |
| `amount_pkr` | Number | Yes | No | >= 0 | Fine amount in PKR |
| `type` | String | Yes | No | Must be `"flat"` or `"percentage"` | How the amount is interpreted |
| `is_active` | Boolean | No | No | - | Whether rule is active (defaults to `true`) |

**Example Request (Test Payload):**
```json
{
  "name": "Late Arrival Fine",
  "amount_pkr": 500,
  "type": "flat",
  "is_active": true
}
```

**For percentage-type rules:**
```json
{
  "name": "Attendance Shortfall Penalty",
  "amount_pkr": 5,
  "type": "percentage",
  "is_active": true
}
```

### Response Body

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Late Arrival Fine",
    "amount_pkr": 500,
    "type": "flat",
    "is_active": true,
    "created_at": "2025-05-06T10:30:00.000Z",
    "created_by": "ADMIN001"
  }
}
```

**Error Responses:**
- `422 Validation Error`: Missing required fields, negative amount, invalid type
- `403 Forbidden`: User lacks `penalty_rules:write` permission

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/penalty-rules \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Late Arrival Fine",
    "amount_pkr": 500,
    "type": "flat"
  }'
```

---

### PATCH /penalty-rules/:id

Update an existing penalty rule. Requires `penalty_rules:write` permission.

**Authentication:** Required  
**Permissions:** `penalty_rules:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Penalty rule ID to update |

### Request Body

All fields are optional (partial update). Provide only the fields you want to change.

**Schema:**
```json
{
  "name": "string (optional)",
  "amount_pkr": "number (non-negative, optional)",
  "type": "enum: 'flat' | 'percentage' (optional)",
  "is_active": "boolean (optional)"
}
```

**Example Request (Test Payload):**
```json
{
  "amount_pkr": 750,
  "is_active": true
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Late Arrival Fine",
    "amount_pkr": 750,
    "type": "flat",
    "is_active": true,
    "updated_at": "2025-05-06T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Rule ID doesn't exist
- `422 Validation Error`: Invalid data
- `403 Forbidden`: Missing permission

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/penalty-rules/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_pkr": 750
  }'
```

---

## Penalties (Instances)

### GET /penalties

Retrieve all penalties (across all employees). Requires `penalties:read_all` permission. Typically used by HR/management to see all penalties in the system.

**Authentication:** Required  
**Permissions:** `penalties:read_all`

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | Enum | Filter by status: `pending`, `approved`, `rejected`, `acknowledged` |
| `employee_id` | String | Filter by specific employee |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "e3f4a5b6-c7d8-9012-ef34-567890123456",
      "employee_id": "EMP002",
      "employee_name": "Fatima Ali",
      "rule_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "rule_name": "Late Arrival Fine",
      "date": "2025-05-05",
      "reason": "Late by 45 minutes",
      "amount_pkr": 500,
      "status": "pending",
      "proposed_by": "HR001",
      "proposed_at": "2025-05-06T08:30:00.000Z",
      "approved_by": null,
      "approved_at": null,
      "acknowledged_by": null,
      "acknowledged_at": null
    },
    {
      "id": "f4a5b6c7-d8e9-0123-f456-789012345678",
      "employee_id": "EMP001",
      "employee_name": "Ahmed Khan",
      "rule_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "rule_name": "Leave Without Approval",
      "date": "2025-04-20",
      "reason": "Took leave without prior approval",
      "amount_pkr": 2000,
      "status": "approved",
      "proposed_by": "HR002",
      "proposed_at": "2025-04-21T09:00:00.000Z",
      "approved_by": "MANAGER001",
      "approved_at": "2025-04-21T10:15:00.000Z",
      "acknowledged_by": "EMP001",
      "acknowledged_at": "2025-04-22T14:00:00.000Z"
    }
  ]
}
```

**Penalty object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique penalty instance ID |
| `employee_id` | String | Employee who received the penalty |
| `employee_name` | String | Employee's full name |
| `rule_id` | UUID | Reference to the penalty rule applied |
| `rule_name` | String | Human-readable rule name |
| `date` | Date | Date when the violation occurred |
| `reason` | String | Specific reason/context for this penalty |
| `amount_pkr` | Number | Calculated fine amount in PKR |
| `status` | Enum | Current status: `pending`, `approved`, `rejected`, `acknowledged` |
| `proposed_by` | String | User ID who proposed the penalty |
| `proposed_at` | Timestamp | When it was proposed |
| `approved_by` | String or null | User ID who approved (if approved) |
| `approved_at` | Timestamp or null | Approval timestamp |
| `acknowledged_by` | String or null | Employee who acknowledged receipt |
| `acknowledged_at` | Timestamp or null | When employee acknowledged |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/penalties?status=pending" \
  -H "Authorization: Bearer <your_token>"
```

---

### GET /penalties/mine

Retrieve penalties for the authenticated employee only. Requires `penalties:read_own` permission. Employees can see their own penalty history.

**Authentication:** Required  
**Permissions:** `penalties:read_own`

### Query Parameters
None.

### Response Body

**Success (200 Ok):**
```json
{
  "success": true,
  "data": [
    {
      "id": "f4a5b6c7-d8e9-0123-f456-789012345678",
      "rule_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "rule_name": "Leave Without Approval",
      "date": "2025-04-20",
      "reason": "Took leave without prior approval",
      "amount_pkr": 2000,
      "status": "approved",
      "proposed_at": "2025-04-21T09:00:00.000Z",
      "approved_at": "2025-04-21T10:15:00.000Z",
      "acknowledged_at": "2025-04-22T14:00:00.000Z"
    }
  ]
}
```

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/penalties/mine \
  -H "Authorization: Bearer <your_token>"
```

---

### POST /penalties

Propose a new penalty for an employee. Requires `penalties:propose` permission. Once proposed, the penalty goes to a reviewer (with `penalties:review`) for approval or rejection.

**Authentication:** Required  
**Permissions:** `penalties:propose`

### Request Body

**Schema:**
```json
{
  "employee_id": "string (min 3, max 10 characters, required)",
  "rule_id": "UUID (required)",
  "date": "string (minimum 8 characters, required)",
  "reason": "string or null (optional)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `employee_id` | String | Yes | No | Min 3, max 10 chars | Employee code of the person receiving the penalty |
| `rule_id` | UUID | Yes | No | Valid UUID | ID of the penalty rule to apply |
| `date` | String | Yes | No | Min 8 chars | Date of the violation (YYYY-MM-DD) |
| `reason` | String | No | Yes | - | Additional context or specific details |

**Example Request (Test Payload):**
```json
{
  "employee_id": "EMP002",
  "rule_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "date": "2025-05-05",
  "reason": "Late by 45 minutes (checked in at 9:25 for 9:00 shift)"
}
```

### Response Body

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "e3f4a5b6-c7d8-9012-ef34-567890123456",
    "employee_id": "EMP002",
    "employee_name": "Fatima Ali",
    "rule_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "rule_name": "Late Arrival Fine",
    "date": "2025-05-05",
    "reason": "Late by 45 minutes (checked in at 9:25 for 9:00 shift)",
    "amount_pkr": 500,
    "status": "pending",
    "proposed_by": "HR001",
    "proposed_at": "2025-05-06T08:30:00.000Z"
  }
}
```

**Fields in `data`:**
- `id` (UUID): New penalty instance ID
- `employee_id` (String): Employee code
- `employee_name` (String): Resolved employee name
- `rule_id` (UUID): Applied rule ID
- `rule_name` (String): Rule name
- `date` (Date): Violation date
- `reason` (String): Provided reason
- `amount_pkr` (Number): Calculated fine amount based on rule type (flat or % of salary)
- `status` (String): Initial status = `"pending"`
- `proposed_by` (String): User ID who proposed
- `proposed_at` (Timestamp): Proposal timestamp

**Error Responses:**
- `422 Validation Error`: Invalid employee_id, rule_id, or date format
- `404 Not Found`: Employee or rule doesn't exist

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/penalties \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "EMP002",
    "rule_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "date": "2025-05-05",
    "reason": "Late by 45 minutes"
  }'
```

---

### PATCH /penalties/:id/approve

Approve a proposed penalty. Requires `penalties:review` permission.

**Authentication:** Required  
**Permissions:** `penalties:review`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Penalty ID to approve |

### Request Body
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "e3f4a5b6-c7d8-9012-ef34-567890123456",
    "status": "approved",
    "approved_by": "MANAGER001",
    "approved_at": "2025-05-06T10:45:00.000Z",
    "message": "Penalty approved"
  }
}
```

**Error Responses:**
- `404 Not Found`: Penalty doesn't exist
- `403 Forbidden`: User lacks review permission
- `409 Conflict`: Already approved/rejected/acknowledged

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/penalties/e3f4a5b6-c7d8-9012-ef34-567890123456/approve \
  -H "Authorization: Bearer <your_token>"
```

---

### PATCH /penalties/:id/reject

Reject a proposed penalty with a reason. Requires `penalties:review` permission.

**Authentication:** Required  
**Permissions:** `penalties:review`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Penalty ID to reject |

### Request Body

**Schema:**
```json
{
  "reason": "string (minimum 1 character, required)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `reason` | String | Yes | No | Min 1 char | Justification for rejection |

**Example Request (Test Payload):**
```json
{
  "reason": "Insufficient evidence. Employee has valid medical certificate."
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "e3f4a5b6-c7d8-9012-ef34-567890123456",
    "status": "rejected",
    "reviewed_by": "MANAGER001",
    "reviewed_at": "2025-05-06T10:50:00.000Z",
    "review_note": "Insufficient evidence. Employee has valid medical certificate.",
    "message": "Penalty rejected"
  }
}
```

**Error Responses:**
- `422 Validation Error`: Missing reason
- `404 Not Found`: Penalty doesn't exist
- `403 Forbidden`: No review permission

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/penalties/e3f4a5b6-c7d8-9012-ef34-567890123456/reject \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Insufficient evidence"
  }'
```

---

### PATCH /penalties/:id/ack

Acknowledge a penalty (employee confirmation of receipt). Once approved, employees can acknowledge that they've seen the penalty. This is a simple acknowledgment action.

**Authentication:** Required  
**Permissions:** None (any authenticated user can ack their own penalties)

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Penalty ID to acknowledge |

### Request Body
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "e3f4a5b6-c7d8-9012-ef34-567890123456",
    "status": "acknowledged",
    "acknowledged_by": "EMP002",
    "acknowledged_at": "2025-05-06T11:00:00.000Z",
    "message": "Penalty acknowledged"
  }
}
```

**Note:** Acknowledgment does not change the `status` field; it's a separate flag indicating the employee has viewed it. The actual status remains `approved`.

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/penalties/e3f4a5b6-c7d8-9012-ef34-567890123456/ack \
  -H "Authorization: Bearer <your_token>"
```

---

## Notes

- **Workflow:** Create rule → Propose penalty (select rule + employee + date) → Review/Approve → Notify employee → Employee acknowledges
- **Amount Calculation:** 
  - `type: "flat"`: `amount_pkr` is the exact fine amount
  - `type: "percentage"`: `amount_pkr` is a percentage applied to employee's base salary (e.g., 5% of salary)
- **Permissions:** 
  - `penalties:propose` allows viewing rules and proposing penalties
  - `penalties:read_all` for viewing all penalties
  - `penalties:read_own` for employees to see only their own
  - `penalties:review` for managers to approve/reject
- **Status Values:** `pending`, `approved`, `rejected`, `acknowledged`
- **Audit Trail:** All actions are tracked with `*_by` and `*_at` fields.
