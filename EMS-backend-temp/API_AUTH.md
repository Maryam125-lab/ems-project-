# Authentication API

**Base Path:** `/api/auth`  
**Total Endpoints:** 4

Authentication endpoints handle user login, session management, and password changes.

---

## POST /auth/login

Authenticate user and receive JWT token and session cookies.

**Authentication:** Not required (public endpoint)  
**Permissions:** None

### Request Body

**Schema:**
```json
{
  "email": "string (valid email format, required)",
  "password": "string (minimum 1 character, required)"
}
```

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `email` | String | Yes | No | Valid email format | User's registered email address |
| `password` | String | Yes | No | Min 1 character | User's plaintext password |

**Example Request (Test Payload):**
```json
{
  "email": "ahmed.khan@company.com",
  "password": "MyPass123!"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "ahmed.khan@company.com",
      "employee_id": "EMP001",
      "must_change_password": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Fields in `data.user`:**
- `id` (UUID): User account ID
- `email` (String): User's email
- `employee_id` (String): Associated employee code
- `must_change_password` (Boolean): Whether password change is forced

**Error Responses:**
- `401 Unauthorized`: Invalid email or password
- `422 Validation Error`: Missing required fields

### Example cURL

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed.khan@company.com",
    "password": "MyPass123!"
  }'
```

---

## POST /auth/logout

Logout user and clear session cookies.

**Authentication:** Required (Bearer token or cookies)  
**Permissions:** None

### Request Body
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": null
}
```

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json"
```

---

## GET /auth/session

Verify current session and retrieve authenticated user information.

**Authentication:** Required (Bearer token or cookies)  
**Permissions:** None

### Request Body
None.

### Query Parameters
None.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "employee_id": "EMP001",
    "role_id": "f1e2d3c4-b5a6-7890-defg-hijklmnopqrs",
    "role_name": "hr_manager",
    "must_change_password": false,
    "email": "ahmed.khan@company.com"
  }
}
```

**Fields in `data`:**
- `user_id` (UUID): User account ID
- `employee_id` (String): Employee code
- `role_id` (UUID): Role assigned to user
- `role_name` (String): Human-readable role name (e.g., `hr_manager`, `super_admin`, `employee`)
- `must_change_password` (Boolean): Password change required flag
- `email` (String): User's email address

**Error Responses:**
- `401 Unauthorized`: Invalid, expired, or missing token

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/auth/session \
  -H "Authorization: Bearer <your_token>"
```

---

## POST /auth/change-password

Change the authenticated user's password. Requires the current password and a new password meeting complexity requirements.

**Authentication:** Required  
**Permissions:** None

### Request Body

**Schema:**
```json
{
  "current_password": "string (minimum 1 character, required)",
  "new_password": "string (minimum 8 characters, must match password policy regex, required)"
}
```

**Password Policy (Regex):**
```
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$
```

Requirements:
- Minimum 8 characters
- At least one lowercase letter (a-z)
- At least one uppercase letter (A-Z)
- At least one digit (0-9)
- At least one special character (non-alphanumeric)

**Field Details:**

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `current_password` | String | Yes | No | Min 1 char | Current password for verification |
| `new_password` | String | Yes | No | 8+ chars, regex pattern | New password meeting all requirements |

**Example Request (Test Payload):**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewStrongPass456!"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Password changed."
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Current password is incorrect
- `422 Validation Error`: New password doesn't meet complexity requirements

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/auth/change-password \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "OldPass123!",
    "new_password": "NewStrongPass456!"
  }'
```

---

## Notes

- The `login` endpoint sets two cookies: `ems_jwt` (HTTP-only, contains JWT) and `ems_csrf` (CSRF token). Browsers send these automatically on subsequent requests.
- You can also use the JWT token directly in the `Authorization: Bearer <token>` header.
- Tokens expire according to `JWT_EXPIRES_IN` environment variable (default: 1 day).
- All auth endpoints use the standard response format: `{ success: boolean, data?: any, error?: { code, message, details? } }`
