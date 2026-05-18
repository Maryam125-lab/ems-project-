# Dashboard API

**Base Path:** `/api/dashboard`  
**Total Endpoints:** 4

Dashboard endpoints provide metrics, analytics, pending actions, and urgent alerts for HR and employees.

---

## GET /dashboard/metrics

Retrieve HR-level metrics and analytics. This endpoint provides high-level statistics about the organization including employee counts, leave trends, attendance summaries, etc. Requires `dashboard:read` permission.

**Authentication:** Required  
**Permissions:** `dashboard:read`

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `range` | Enum | Time range for trend data: `"6m"` (6 months) or `"12m"` (12 months). Default: `"6m"` |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "generated_at": "2025-05-06T12:00:00.000Z",
    "range": "6m",
    "total_employees": 150,
    "active_employees": 142,
    "new_hires_this_month": 8,
    "attendance_rate_avg": "92.5%",
    "leave_balance_used_avg": "45%",
    "pending_leave_requests": 12,
    "unresolved_penalties": 3,
    "upcoming_holidays": 2,
    "employee_growth": [      // Monthly headcount trend
      { "month": "2025-01", "count": 145 },
      { "month": "2025-02", "count": 147 },
      { "month": "2025-03", "count": 148 },
      { "month": "2025-04", "count": 150 },
      { "month": "2025-05", "count": 150 },
      { "month": "2025-06", "count": 152 }
    ],
    "leave_trends": [
      {
        "month": "2025-01",
        "approved": 35,
        "rejected": 5,
        "pending": 3
      },
      {
        "month": "2025-02",
        "approved": 42,
        "rejected": 3,
        "pending": 4
      }
    ],
    "attendance_summary": [
      {
        "month": "2025-01",
        "present_pct": "93%",
        "absent_pct": "4%",
        "late_pct": "3%"
      }
    ],
    "department_breakdown": [
      {
        "department": "Engineering",
        "headcount": 45,
        "avg_attendance": "94.2%"
      },
      {
        "department": "HR",
        "headcount": 12,
        "avg_attendance": "96.1%"
      },
      {
        "department": "Sales",
        "headcount": 28,
        "avg_attendance": "91.5%"
      }
    ]
  }
}
```

**Top-level fields:**

| Field | Type | Description |
|-------|------|-------------|
| `generated_at` | Timestamp | When the metrics were calculated |
| `range` | String | Time range used ("6m" or "12m") |
| `total_employees` | Number | Total employee count in system |
| `active_employees` | Number | Currently active employees |
| `new_hires_this_month` | Number | Employees who joined this month |
| `attendance_rate_avg` | String | Overall average attendance percentage |
| `leave_balance_used_avg` | String | Average leave balance consumed (percentage) |
| `pending_leave_requests` | Number | Number of leave requests awaiting approval |
| `unresolved_penalties` | Number | Penalties pending review/acknowledgment |
| `upcoming_holidays` | Number | Number of upcoming company holidays in calendar |
| `employee_growth` | Array | Monthly headcount trend (for charting) |
| `leave_trends` | Array | Monthly leave request status trends |
| `attendance_summary` | Array | Monthly attendance breakdown trends |
| `department_breakdown` | Array | Statistics per department |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/dashboard/metrics?range=12m" \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /dashboard/me

Retrieve personalized dashboard metrics for the authenticated employee. Shows employee-specific data like their own leave balance, recent attendance, upcoming leaves, etc. No special permission required beyond authentication.

**Authentication:** Required  
**Permissions:** None

### Query Parameters
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "employee_id": "EMP002",
    "employee_name": "Fatima Ali",
    "department": "Human Resources",
    "upcoming_leave": {
      "start_date": "2025-05-20",
      "end_date": "2025-05-25",
      "type": "Annual Leave",
      "status": "approved"
    },
    "leave_balances": [
      {
        "type": "Annual Leave",
        "total": 20,
        "used": 5,
        "balance": 15
      },
      {
        "type": "Sick Leave",
        "total": 10,
        "used": 2,
        "balance": 8
      }
    ],
    "recent_attendance": [
      {
        "date": "2025-05-05",
        "status": "present",
        "check_in": "09:00",
        "check_out": "18:00"
      },
      {
        "date": "2025-05-04",
        "status": "present",
        "check_in": "08:55",
        "check_out": "17:45"
      }
    ],
    "pending_actions": 0,
    "unread_notifications": 3
  }
}
```

**Fields in `data`:**

| Field | Type | Description |
|-------|------|-------------|
| `employee_id` | String | Employee code |
| `employee_name` | String | Full name |
| `department` | String | Department name |
| `upcoming_leave` | Object or null | Next approved leave, if any (with start_date, end_date, type, status) |
| `leave_balances` | Array | Balance for each leave type |
| `recent_attendance` | Array | Last 7-10 days of attendance records |
| `pending_actions` | Number | Count of actions requiring employee attention |
| `unread_notifications` | Number | Number of unread notifications |

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/dashboard/me \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /dashboard/pending-actions

Retrieve a list of pending actions that require attention from the user or their department. Requires `pending_actions:read` permission. This is typically used by HR and managers to see tasks that need follow-up.

**Authentication:** Required  
**Permissions:** `pending_actions:read`

### Query Parameters
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "type": "leave_request",
      "count": 5,
      "description": "Leave requests awaiting approval",
      "action_url": "/leave-requests?status=pending",
      "priority": "high"
    },
    {
      "type": "penalty_review",
      "count": 3,
      "description": "Penalties pending review",
      "action_url": "/penalties?status=pending",
      "priority": "medium"
    },
    {
      "type": "unlock_request",
      "count": 2,
      "description": "Attendance unlock requests awaiting approval",
      "action_url": "/attendance?status=unlock_pending",
      "priority": "medium"
    },
    {
      "type": "employee_onboarding",
      "count": 4,
      "description": "New employee setups incomplete",
      "action_url": "/employees?status=new",
      "priority": "low"
    }
  ]
}
```

**Action object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | String | Category of pending action (used for icons/routing) |
| `count` | Number | Number of items requiring action |
| `description` | String | Human-readable description |
| `action_url` | String | Relative URL to navigate to take action |
| `priority` | Enum | `"high"`, `"medium"`, or `"low"` - for UI emphasis |

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/dashboard/pending-actions \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /dashboard/urgent-alerts

Retrieve urgent alerts and warnings that need immediate attention. Requires `alerts:read` permission. Examples include: upcoming contract expirations, medical checkup due dates, probation period endings, etc.

**Authentication:** Required  
**Permissions:** `alerts:read`

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `days` | Number (1-365) | Lookahead window in days. Default: 30 days |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "type": "contract_expiry",
      "employee_id": "EMP003",
      "employee_name": "Bilal Ahmed",
      "title": "Contract Ending Soon",
      "description": "Employment contract expires in 15 days (2025-05-21)",
      "action_required": "Renew contract or initiate separation process",
      "due_date": "2025-05-21",
      "severity": "high"
    },
    {
      "type": "medical_exam",
      "employee_id": "EMP007",
      "employee_name": "Sana Malik",
      "title": "Medical Exam Due",
      "description": "Annual medical examination scheduled to be due in 7 days",
      "action_required": "Schedule medical appointment",
      "due_date": "2025-05-13",
      "severity": "medium"
    },
    {
      "type": "probation_end",
      "employee_id": "EMP012",
      "employee_name": "Hassan Raza",
      "title": "Probation Period Ending",
      "description": "Probation ends in 21 days. Performance review needed.",
      "action_required": "Conduct probation review and confirm employment",
      "due_date": "2025-05-27",
      "severity": "medium"
    },
    {
      "type": "passport_expiry",
      "employee_id": "EMP005",
      "employee_name": "Zara Ali",
      "title": "Passport Expiring",
      "description": "Passport expires in 45 days",
      "action_required": "Renew passport",
      "due_date": "2025-06-20",
      "severity": "low"
    }
  ]
}
```

**Alert object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | String | Alert category: `contract_expiry`, `medical_exam`, `probation_end`, `passport_expiry`, `visa_expiry`, etc. |
| `employee_id` | String | Employee code |
| `employee_name` | String | Employee full name |
| `title` | String | Short alert title |
| `description` | String | Detailed explanation with timeline |
| `action_required` | String | Recommended action to take |
| `due_date` | Date | When action is due |
| `severity` | Enum | `"high"`, `"medium"`, or `"low"` - indicates urgency |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/dashboard/urgent-alerts?days=60" \
  -H "Authorization: Bearer <your_token>"
```

---

## Notes

- **Metrics Scope:** `/dashboard/metrics` is for HR/administrators to see organization-wide stats. Regular employees use `/dashboard/me` for their personal overview.
- **Caching:** These endpoints may involve complex queries. Consider caching data for 5-10 minutes to improve performance.
- **Pending Actions:** The `/dashboard/pending-actions` endpoint aggregates tasks from various modules (leave, penalties, attendance) into a single to-do list.
- **Alert Generation:** Urgent alerts are typically generated by scheduled background jobs that scan employee records for upcoming expiry dates (contracts, medical exams, passports, visas, probation periods).
- **Permissions:** 
  - `dashboard:read` for metrics
  - `pending_actions:read` for pending actions  
  - `alerts:read` for urgent alerts
- **Date Handling:** All dates are in `YYYY-MM-DD` format. The `days` parameter in urgent alerts calculates from today's date.
