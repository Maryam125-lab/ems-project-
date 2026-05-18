# Employee Management API

**Base Path:** `/api/employees`  
**Total Endpoints:** 6

Employee management endpoints handle the complete employee lifecycle: onboarding, profile updates, personal/job/emergency/bank/medical information, and credential management.

---

## Common Employee Response Structure

When retrieving an employee record (GET by ID), the response includes several nested sections. Here's the complete structure:

### Full Employee Profile Response Object

```json
{
  "employee_id": "EMP001",
  "personalInfo": {
    "name": "Ahmed Khan",
    "father_name": "Mohammed Khan",
    "cnic": "42101-1234567-1",
    "date_of_birth": "1990-05-15"
  },
  "jobInfo": {
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "designation_id": "660e8400-e29b-41d4-a716-446655440002",
    "employment_type_id": "770e8400-e29b-41d4-a716-446655440003",
    "job_status_id": "880e8400-e29b-41d4-a716-446655440004",
    "work_mode_id": "990e8400-e29b-41d4-a716-446655440005",
    "work_location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
    "date_of_joining": "2023-01-15",
    "date_of_exit": null,
    "probation_end_date": "2023-07-15",
    "contract_end_date": null,
    "manager_emp_id": "EMP005"
  },
  "salaryInfo": {
    "base_salary": 85000
  },
  "accountInfo": {
    "email": "ahmed.khan@company.com",
    "phone": "03001234567",
    "role_id": "cc0e8400-e29b-41d4-a716-446655440008"
  },
  "emergencyContacts": {
    "contact_1": "03009876543",
    "contact_2": "03111234567",
    "perment_address": "House #123, Street 5, Islamabad",
    "postal_address": "PO Box 12345, Islamabad",
    "e_contact_1_relation": "spouse",
    "e_contact_1_full_name": "Fatima Khan",
    "e_contact_1_phone": "03009876543",
    "e_contact_1_phone_country_code": "+92",
    "e_contact_1_email": "fatima@email.com",
    "e_contact_2_relation": null,
    "e_contact_2_full_name": null,
    "e_contact_2_phone": null,
    "e_contact_2_phone_country_code": "+92",
    "e_contact_2_email": null,
    "primary_contact": 1
  },
  "bankInfo": {
    "bank_name": "Habib Bank Limited",
    "branch_name": "Blue Area Branch",
    "branch_code": "0042",
    "iban": "PK36HABL0000123456789012",
    "account_title": "Ahmed Khan",
    "account_number": "1234567890",
    "account_type": "salary"
  },
  "medicalInfo": {
    "blood_group": "B+",
    "date_of_birth": "1990-05-15",
    "gender": "male",
    "height_cm": 175,
    "weight_kg": 72,
    "has_disability": false,
    "disability_type": null,
    "disability_description": null,
    "has_chronic_condition": false,
    "chronic_condition_notes": null,
    "has_known_allergies": true,
    "allergy_notes": "Dust allergy, mild asthma",
    "emergency_medication": "Inhaler - as needed",
    "fitness_status": "fit",
    "last_medical_exam_date": "2024-12-01",
    "next_medical_exam_date": "2025-12-01"
  },
  "created_at": "2025-05-06T10:30:00.000Z",
  "updated_at": "2025-05-06T10:30:00.000Z"
}
```

---

## GET /employees

Retrieve a list of employees with optional filtering and pagination. Only users with `employees:read` permission can access this endpoint.

**Authentication:** Required  
**Permissions:** `employees:read`

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | String | Search in `employee_id`, `name`, or `email` (partial match, case-insensitive) |
| `department_id` | UUID | Filter by department |
| `is_active` | Boolean | Filter by active status: `true` or `false` |
| `page` | Number | Page number for pagination (default: 1) |
| `limit` | Number | Number of items per page (default: 10, max: 100) |

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "employee_id": "EMP001",
        "name": "Ahmed Khan",
        "email": "ahmed.khan@company.com",
        "department_id": "550e8400-e29b-41d4-a716-446655440001",
        "department_name": "Engineering",
        "designation_id": "660e8400-e29b-41d4-a716-446655440002",
        "designation_name": "Senior Developer",
        "phone": "03001234567",
        "is_active": true,
        "date_of_joining": "2023-01-15"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 150,
      "total_pages": 15
    }
  }
}
```

**List item fields (abbreviated view):**

| Field | Type | Description |
|-------|------|-------------|
| `employee_id` | String | Employee code |
| `name` | String | Full name |
| `email` | String | Work email |
| `department_id` | UUID | Department reference |
| `department_name` | String | Resolved department name |
| `designation_id` | UUID | Designation/position reference |
| `designation_name` | String | Job title |
| `phone` | String | Contact phone |
| `is_active` | Boolean | Employment status |
| `date_of_joining` | Date | Hire date |

**Example cURL:**

```bash
curl -X GET "http://localhost:3001/api/employees?page=1&limit=20&department_id=550e8400-e29b-41d4-a716-446655440001&is_active=true" \
  -H "Authorization: Bearer <your_token>"
```

---

## GET /employees/:employeeId

Retrieve complete profile of a specific employee, including all nested sections (personalInfo, jobInfo, accountInfo, emergencyContacts, bankInfo, medicalInfo). Requires `employees:read` permission.

**Authentication:** Required  
**Permissions:** `employees:read`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `employeeId` | String (employee_id) OR UUID | Employee identifier. Can be the employee code (e.g., "EMP001") or the internal database UUID |

### Response Body

**Success (200 OK):**

Full response structure is shown at the top of this document under "Full Employee Profile Response Object". It includes all nested sections:

- `personalInfo` (name, father_name, cnic, date_of_birth)
- `jobInfo` (department_id, designation_id, employment_type_id, job_status_id, work_mode_id, work_location_id, shift_id, date_of_joining, date_of_exit, probation_end_date, contract_end_date, manager_emp_id)
- `salaryInfo` (base_salary)
- `accountInfo` (email, phone, role_id)
- `emergencyContacts` (contact numbers, addresses, emergency contact details)
- `bankInfo` (bank details for salary)
- `medicalInfo` (health information)
- `created_at`, `updated_at`

**Error Responses:**
- `404 Not Found`: Employee doesn't exist

**Example cURL:**

```bash
curl -X GET http://localhost:3001/api/employees/EMP001 \
  -H "Authorization: Bearer <your_token>"
```

---

## POST /employees

Create a new employee with complete onboarding data. This is the most complex endpoint with a deeply nested request body containing 7 major sections. Requires `employees:write` permission.

**Authentication:** Required  
**Permissions:** `employees:write`

### Request Body - Complete Schema

**Full Nested Structure:**

```json
{
  "personalInfo": {
    "name": "string (min 2, max 100 chars, required)",
    "father_name": "string (min 2, max 100 chars, required)",
    "cnic": "string (min 5, max 20 chars, required)",
    "date_of_birth": "string (min 4, max 15 chars, required)"
  },
  "jobInfo": {
    "department_id": "UUID (required)",
    "designation_id": "UUID (required)",
    "employment_type_id": "UUID (required)",
    "job_status_id": "UUID (required)",
    "work_mode_id": "UUID (required)",
    "work_location_id": "UUID (required)",
    "shift_id": "UUID (required)",
    "date_of_joining": "string (min 8 chars, required)",
    "date_of_exit": "string or null (optional)",
    "probation_end_date": "string or null (optional)",
    "contract_end_date": "string or null (optional)"
  },
  "salaryInfo": {
    "base_salary": "number (>= 0, optional)"
  },
  "accountInfo": {
    "email": "string (valid email format, required)",
    "phone": "string (min 7, max 20 chars, required)",
    "role_id": "UUID or null (optional)"
  },
  "emergencyContacts": {
    "contact_1": "string (min 7, max 20 chars, required)",
    "contact_2": "string (min 7, max 20 chars) or null (optional)",
    "perment_address": "string (max 300 chars) or null (optional)",
    "postal_address": "string (max 300 chars) or null (optional)",
    "e_contact_1_relation": "enum: 'father' | 'mother' | 'brother' | 'sister' | 'wife' | 'husband' | 'son' | 'daughter' | 'friend' | 'neighbor' | 'other' (required)",
    "e_contact_1_full_name": "string (min 2, max 150 chars, required)",
    "e_contact_1_phone": "string (min 7, max 20 chars, required)",
    "e_contact_1_phone_country_code": "string (max 5 chars, default: '+92') (optional)",
    "e_contact_1_email": "string (valid email) or null (optional)",
    "e_contact_2_relation": "enum (same options) or null (optional)",
    "e_contact_2_full_name": "string (max 150 chars) or null (optional)",
    "e_contact_2_phone": "string (min 7, max 20 chars) or null (optional)",
    "e_contact_2_phone_country_code": "string (max 5 chars, default: '+92') or null (optional)",
    "e_contact_2_email": "string (valid email) or null (optional)",
    "primary_contact": "integer (1 or 2, default: 1) (optional)"
  },
  "bankInfo": {
    "bank_name": "string (min 2, max 150 chars, required)",
    "branch_name": "string (max 150 chars) or null (optional)",
    "branch_code": "string (max 20 chars) or null (optional)",
    "iban": "string (min 10, max 34 chars, required)",
    "account_title": "string (min 2, max 200 chars, required)",
    "account_number": "string (max 30 chars) or null (optional)",
    "account_type": "enum: 'current' | 'savings' | 'salary' or null (optional)"
  },
  "medicalInfo": {
    "blood_group": "enum: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown' or null (optional)",
    "date_of_birth": "string or null (optional)",
    "gender": "enum: 'male' | 'female' | 'other' or null (optional)",
    "height_cm": "integer (> 0) or null (optional)",
    "weight_kg": "integer (> 0) or null (optional)",
    "has_disability": "boolean (default: false) (optional)",
    "disability_type": "string (max 100 chars) or null (optional)",
    "disability_description": "string or null (optional)",
    "has_chronic_condition": "boolean (default: false) (optional)",
    "chronic_condition_notes": "string or null (optional)",
    "has_known_allergies": "boolean (default: false) (optional)",
    "allergy_notes": "string or null (optional)",
    "emergency_medication": "string or null (optional)",
    "fitness_status": "string (max 30 chars) or null (optional)",
    "last_medical_exam_date": "string or null (optional)",
    "next_medical_exam_date": "string or null (optional)"
  }
}
```

### Field-by-Field Breakdown

#### personalInfo (required)

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `name` | String | Yes | No | Min 2, max 100 | Full name of employee |
| `father_name` | String | Yes | No | Min 2, max 100 | Father's full name |
| `cnic` | String | Yes | No | Min 5, max 20 | National ID card number |
| `date_of_birth` | String | Yes | No | Min 4, max 15 | Date of birth (format flexible, prefer YYYY-MM-DD) |

#### jobInfo (required)

All ID fields must be valid UUIDs from configuration tables.

| Field | Type | Required | Nullable | Description |
|-------|------|----------|----------|-------------|
| `department_id` | UUID | Yes | No | Reference to `config/departments` |
| `designation_id` | UUID | Yes | No | Reference to `config/designations` |
| `employment_type_id` | UUID | Yes | No | Reference to `config/employment-types` |
| `job_status_id` | UUID | Yes | No | Reference to `config/job-statuses` |
| `work_mode_id` | UUID | Yes | No | Reference to `config/work-modes` |
| `work_location_id` | UUID | Yes | No | Reference to `config/work-locations` |
| `shift_id` | UUID | Yes | No | Reference to `config/shifts` |
| `date_of_joining` | String | Yes | No | First day of employment (YYYY-MM-DD) |
| `date_of_exit` | String | No | Yes | Termination/resignation date if applicable |
| `probation_end_date` | String | No | Yes | End of probation period |
| `contract_end_date` | String | No | Yes | End of contract (for contract employees) |

#### salaryInfo (optional entire object)

If provided, contains:

| Field | Type | Required | Nullable | Description |
|-------|------|----------|----------|-------------|
| `base_salary` | Number | No | No | Monthly base salary (must be >= 0) |

**Note:** The entire `salaryInfo` object is optional. If omitted, salary is not set during onboarding.

#### accountInfo (required)

| Field | Type | Required | Nullable | Validation | Description |
|-------|------|----------|----------|------------|-------------|
| `email` | String | Yes | No | Valid email | Work email (must be unique) |
| `phone` | String | Yes | No | Min 7, max 20 | Primary contact phone number |
| `role_id` | UUID | No | Yes | Valid UUID or null | Reference to `config/roles` (permissions) |

#### emergencyContacts (optional entire object)

| Field | Type | Required | Nullable | Max Length | Description |
|-------|------|----------|----------|------------|-------------|
| `contact_1` | String | Yes | No | 20 | Primary emergency phone |
| `contact_2` | String | No | Yes | 20 | Secondary emergency phone |
| `perment_address` | String | No | Yes | 300 | Permanent residential address |
| `postal_address` | String | No | Yes | 300 | Mailing/postal address |
| `e_contact_1_relation` | Enum | Yes | No | - | Relation of emergency contact 1 (see enum values below) |
| `e_contact_1_full_name` | String | Yes | No | 150 | Name of emergency contact 1 |
| `e_contact_1_phone` | String | Yes | No | 20 | Phone of emergency contact 1 |
| `e_contact_1_phone_country_code` | String | No | Yes | 5 | Country code, default "+92" |
| `e_contact_1_email` | String | No | Yes | - | Email of emergency contact 1 |
| `e_contact_2_relation` | Enum | No | Yes | - | Relation of emergency contact 2 (same enum) |
| `e_contact_2_full_name` | String | No | Yes | 150 | Name of emergency contact 2 |
| `e_contact_2_phone` | String | No | Yes | 20 | Phone of emergency contact 2 |
| `e_contact_2_phone_country_code` | String | No | Yes | 5 | Country code, default "+92" |
| `e_contact_2_email` | String | No | Yes | - | Email of emergency contact 2 |
| `primary_contact` | Integer | No | Yes | - | Which contact is primary: 1 or 2 (default 1) |

**Enum values for `e_contact_*_relation`:**  
`"father"`, `"mother"`, `"brother"`, `"sister"`, `"wife"`, `"husband"`, `"son"`, `"daughter"`, `"friend"`, `"neighbor"`, `"other"`

#### bankInfo (optional entire object)

| Field | Type | Required | Nullable | Max Length | Description |
|-------|------|----------|----------|------------|-------------|
| `bank_name` | String | Yes | No | 150 | Name of bank (e.g., "Habib Bank Limited") |
| `branch_name` | String | No | Yes | 150 | Branch name |
| `branch_code` | String | No | Yes | 20 | Branch code (e.g., "0042") |
| `iban` | String | Yes | No | 34 | International Bank Account Number |
| `account_title` | String | Yes | No | 200 | Account holder name (as per bank) |
| `account_number` | String | No | Yes | 30 | Bank account number |
| `account_type` | Enum | No | Yes | - | `"current"`, `"savings"`, or `"salary"` |

#### medicalInfo (optional entire object)

| Field | Type | Required | Nullable | Max Length | Description |
|-------|------|----------|----------|------------|-------------|
| `blood_group` | Enum | No | Yes | - | `"A+"`, `"A-"`, `"B+"`, `"B-"`, `"AB+"`, `"AB-"`, `"O+"`, `"O-"`, `"unknown"` |
| `date_of_birth` | String | No | Yes | - | Date of birth (duplicate of personalInfo, for medical records) |
| `gender` | Enum | No | Yes | - | `"male"`, `"female"`, `"other"` |
| `height_cm` | Integer | No | Yes | - | Height in centimeters (must be > 0) |
| `weight_kg` | Integer | No | Yes | - | Weight in kilograms (must be > 0) |
| `has_disability` | Boolean | No | Yes | - | Whether employee has any disability (default: false) |
| `disability_type` | String | No | Yes | 100 | Type/category of disability if applicable |
| `disability_description` | String | No | Yes | - | Detailed description of disability |
| `has_chronic_condition` | Boolean | No | Yes | - | Whether employee has any chronic medical condition (default: false) |
| `chronic_condition_notes` | String | No | Yes | - | Details about chronic condition |
| `has_known_allergies` | Boolean | No | Yes | - | Whether employee has known allergies (default: false) |
| `allergy_notes` | String | No | Yes | - | Description of allergies |
| `emergency_medication` | String | No | Yes | - | Medication to be used in emergencies |
| `fitness_status` | String | No | Yes | 30 | General fitness assessment (e.g., "fit", "needs improvement") |
| `last_medical_exam_date` | String | No | Yes | - | Date of last medical examination (YYYY-MM-DD) |
| `next_medical_exam_date` | String | No | Yes | - | Date of next scheduled medical examination |

---

### Example Request (Complete Test Payload - All Sections)

This is a comprehensive, realistic payload that can be used for full employee onboarding:

```json
{
  "personalInfo": {
    "name": "Fatima Ali",
    "father_name": "Mohammed Ali",
    "cnic": "42101-9876543-1",
    "date_of_birth": "1992-08-22"
  },
  "jobInfo": {
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "designation_id": "660e8400-e29b-41d4-a716-446655440002",
    "employment_type_id": "770e8400-e29b-41d4-a716-446655440003",
    "job_status_id": "880e8400-e29b-41d4-a716-446655440004",
    "work_mode_id": "990e8400-e29b-41d4-a716-446655440005",
    "work_location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
    "date_of_joining": "2025-01-10",
    "date_of_exit": null,
    "probation_end_date": "2025-07-10",
    "contract_end_date": null
  },
  "salaryInfo": {
    "base_salary": 75000
  },
  "accountInfo": {
    "email": "fatima.ali@company.com",
    "phone": "03331234567",
    "role_id": "cc0e8400-e29b-41d4-a716-446655440008"
  },
  "emergencyContacts": {
    "contact_1": "03001234567",
    "contact_2": "03111234567",
    "perment_address": "House #456, Street 10, Lahore",
    "postal_address": "PO Box 7890, Lahore",
    "e_contact_1_relation": "husband",
    "e_contact_1_full_name": "Waheed Ahmed",
    "e_contact_1_phone": "03001234567",
    "e_contact_1_phone_country_code": "+92",
    "e_contact_1_email": "waheed@email.com",
    "e_contact_2_relation": "father",
    "e_contact_2_full_name": "Sultan Ali",
    "e_contact_2_phone": "03211234567",
    "e_contact_2_phone_country_code": "+92",
    "e_contact_2_email": null,
    "primary_contact": 1
  },
  "bankInfo": {
    "bank_name": "National Bank of Pakistan",
    "branch_name": "Main Branch",
    "branch_code": "0234",
    "iban": "PK36NBPL0000987654321098",
    "account_title": "Fatima Ali",
    "account_number": "9876543210",
    "account_type": "salary"
  },
  "medicalInfo": {
    "blood_group": "O+",
    "date_of_birth": "1992-08-22",
    "gender": "female",
    "height_cm": 165,
    "weight_kg": 58,
    "has_disability": false,
    "disability_type": null,
    "disability_description": null,
    "has_chronic_condition": false,
    "chronic_condition_notes": null,
    "has_known_allergies": false,
    "allergy_notes": null,
    "emergency_medication": null,
    "fitness_status": "fit",
    "last_medical_exam_date": null,
    "next_medical_exam_date": null
  }
}
```

**Minimal payload (only required fields):**
```json
{
  "personalInfo": {
    "name": "Test User",
    "father_name": "Father Name",
    "cnic": "42101-1111111-1",
    "date_of_birth": "1990-01-01"
  },
  "jobInfo": {
    "department_id": "550e8400-e29b-41d4-a716-446655440001",
    "designation_id": "660e8400-e29b-41d4-a716-446655440002",
    "employment_type_id": "770e8400-e29b-41d4-a716-446655440003",
    "job_status_id": "880e8400-e29b-41d4-a716-446655440004",
    "work_mode_id": "990e8400-e29b-41d4-a716-446655440005",
    "work_location_id": "aa0e8400-e29b-41d4-a716-446655440006",
    "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
    "date_of_joining": "2025-01-10"
  },
  "accountInfo": {
    "email": "test.user@company.com",
    "phone": "03001234567"
  }
}
```

### Response Body

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "employee_id": "EMP002",
    "personalInfo": {
      "name": "Fatima Ali",
      "father_name": "Mohammed Ali",
      "cnic": "42101-9876543-1",
      "date_of_birth": "1992-08-22"
    },
    "jobInfo": {
      "department_id": "550e8400-e29b-41d4-a716-446655440001",
      "designation_id": "660e8400-e29b-41d4-a716-446655440002",
      "employment_type_id": "770e8400-e29b-41d4-a716-446655440003",
      "job_status_id": "880e8400-e29b-41d4-a716-446655440004",
      "work_mode_id": "990e8400-e29b-41d4-a716-446655440005",
      "work_location_id": "aa0e8400-e29b-41d4-a716-446655440006",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
      "date_of_joining": "2025-01-10",
      "date_of_exit": null,
      "probation_end_date": "2025-07-10",
      "contract_end_date": null
    },
    "salaryInfo": {
      "base_salary": 75000
    },
    "accountInfo": {
      "email": "fatima.ali@company.com",
      "phone": "03331234567",
      "role_id": "cc0e8400-e29b-41d4-a716-446655440008"
    },
    "emergencyContacts": {
      "contact_1": "03001234567",
      "contact_2": "03111234567",
      "perment_address": "House #456, Street 10, Lahore",
      "postal_address": "PO Box 7890, Lahore",
      "e_contact_1_relation": "husband",
      "e_contact_1_full_name": "Waheed Ahmed",
      "e_contact_1_phone": "03001234567",
      "e_contact_1_phone_country_code": "+92",
      "e_contact_1_email": "waheed@email.com",
      "e_contact_2_relation": "father",
      "e_contact_2_full_name": "Sultan Ali",
      "e_contact_2_phone": "03211234567",
      "e_contact_2_phone_country_code": "+92",
      "e_contact_2_email": null,
      "primary_contact": 1
    },
    "bankInfo": {
      "bank_name": "National Bank of Pakistan",
      "branch_name": "Main Branch",
      "branch_code": "0234",
      "iban": "PK36NBPL0000987654321098",
      "account_title": "Fatima Ali",
      "account_number": "9876543210",
      "account_type": "salary"
    },
    "medicalInfo": {
      "blood_group": "O+",
      "date_of_birth": "1992-08-22",
      "gender": "female",
      "height_cm": 165,
      "weight_kg": 58,
      "has_disability": false,
      "disability_type": null,
      "disability_description": null,
      "has_chronic_condition": false,
      "chronic_condition_notes": null,
      "has_known_allergies": false,
      "allergy_notes": null,
      "emergency_medication": null,
      "fitness_status": "fit",
      "last_medical_exam_date": null,
      "next_medical_exam_date": null
    },
    "created_at": "2025-05-06T14:30:00.000Z",
    "updated_at": "2025-05-06T14:30:00.000Z"
  }
}
```

**Error Responses:**
- `422 Validation Error`: Any validation failure (missing required fields, invalid email, UUIDs not valid format, etc.)
- `409 Conflict`: Duplicate `employee_id` or duplicate `email` (unique constraint violation)

**Example cURL (Complete):**

```bash
curl -X POST http://localhost:3001/api/employees \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "personalInfo": {
      "name": "Fatima Ali",
      "father_name": "Mohammed Ali",
      "cnic": "42101-9876543-1",
      "date_of_birth": "1992-08-22"
    },
    "jobInfo": {
      "department_id": "550e8400-e29b-41d4-a716-446655440001",
      "designation_id": "660e8400-e29b-41d4-a716-446655440002",
      "employment_type_id": "770e8400-e29b-41d4-a716-446655440003",
      "job_status_id": "880e8400-e29b-41d4-a716-446655440004",
      "work_mode_id": "990e8400-e29b-41d4-a716-446655440005",
      "work_location_id": "aa0e8400-e29b-41d4-a716-446655440006",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440007",
      "date_of_joining": "2025-01-10"
    },
    "accountInfo": {
      "email": "fatima.ali@company.com",
      "phone": "03331234567",
      "role_id": "cc0e8400-e29b-41d4-a716-446655440008"
    },
    "emergencyContacts": {
      "contact_1": "03001234567",
      "e_contact_1_relation": "husband",
      "e_contact_1_full_name": "Waheed Ahmed",
      "e_contact_1_phone": "03001234567"
    },
    "bankInfo": {
      "bank_name": "National Bank of Pakistan",
      "iban": "PK36NBPL0000987654321098",
      "account_title": "Fatima Ali"
    }
  }'
```

---

## PATCH /employees/:employeeId/personal

Update personal information (nested under `personalInfo`). All fields in `personalInfo` are optional - you can update any combination. Requires `employees:write` permission.

**Authentication:** Required  
**Permissions:** `employees:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `employeeId` | String (employee_id) or UUID | Employee to update |

### Request Body

**Schema (all fields optional):**
```json
{
  "name": "string (min 2, max 100 chars, optional)",
  "father_name": "string (min 2, max 100 chars, optional)",
  "cnic": "string (min 5, max 20 chars, optional)",
  "date_of_birth": "string (min 4, max 15 chars, optional)"
}
```

**Example Request:**
```json
{
  "name": "Fatima Ali Updated",
  "cnic": "42101-9876543-2"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "employee_id": "EMP002",
    "name": "Fatima Ali Updated",
    "father_name": "Mohammed Ali",
    "cnic": "42101-9876543-2",
    "date_of_birth": "1992-08-22",
    "updated_at": "2025-05-06T15:00:00.000Z"
  }
}
```

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/employees/EMP002/personal \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Fatima Ali Updated",
    "cnic": "42101-9876543-2"
  }'
```

---

## PATCH /employees/:employeeId/job

Update job-related information (nested under `jobInfo`). All standard `jobInfo` fields are optional, plus `manager_emp_id` which is an extension. Requires `employees:write` permission.

**Authentication:** Required  
**Permissions:** `employees:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `employeeId` | String (employee_id) or UUID | Employee to update |

### Request Body

**Schema (all fields optional):**
```json
{
  "department_id": "UUID or null (optional)",
  "designation_id": "UUID or null (optional)",
  "employment_type_id": "UUID or null (optional)",
  "job_status_id": "UUID or null (optional)",
  "work_mode_id": "UUID or null (optional)",
  "work_location_id": "UUID or null (optional)",
  "shift_id": "UUID or null (optional)",
  "date_of_joining": "string or null (optional)",
  "date_of_exit": "string or null (optional)",
  "probation_end_date": "string or null (optional)",
  "contract_end_date": "string or null (optional)",
  "manager_emp_id": "string (max 10 chars) or null (optional)"
}
```

**Example Request:**
```json
{
  "department_id": "550e8400-e29b-41d4-a716-446655440002",
  "designation_id": "660e8400-e29b-41d4-a716-446655440003",
  "shift_id": "bb0e8400-e29b-41d4-a716-446655440008",
  "manager_emp_id": "EMP001"
}
```

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "employee_id": "EMP002",
    "jobInfo": {
      "department_id": "550e8400-e29b-41d4-a716-446655440002",
      "designation_id": "660e8400-e29b-41d4-a716-446655440003",
      "employment_type_id": "770e8400-e29b-41d4-a716-446655440003",
      "job_status_id": "880e8400-e29b-41d4-a716-446655440004",
      "work_mode_id": "990e8400-e29b-41d4-a716-446655440005",
      "work_location_id": "aa0e8400-e29b-41d4-a716-446655440006",
      "shift_id": "bb0e8400-e29b-41d4-a716-446655440008",
      "date_of_joining": "2025-01-10",
      "date_of_exit": null,
      "probation_end_date": "2025-07-10",
      "contract_end_date": null,
      "manager_emp_id": "EMP001"
    },
    "updated_at": "2025-05-06T15:15:00.000Z"
  }
}
```

**Example cURL:**

```bash
curl -X PATCH http://localhost:3001/api/employees/EMP002/job \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "department_id": "550e8400-e29b-41d4-a716-446655440002",
    "designation_id": "660e8400-e29b-41d4-a716-446655440003",
    "manager_emp_id": "EMP001"
  }'
```

---

## PATCH /employees/:employeeId/extra

Update extra information sections: `emergencyContacts`, `bankInfo`, and `medicalInfo`. These are three independent nested objects. You can update any single section, or any combination of them in one request. Requires `employees:write` permission.

**Authentication:** Required  
**Permissions:** `employees:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `employeeId` | String (employee_id) or UUID | Employee to update |

### Request Body

**Schema (all three sections optional, but at least one must be provided):**

```json
{
  "emergencyContacts": {
    "contact_1": "string (min 7, max 20) or null (optional)",
    "contact_2": "string (min 7, max 20) or null (optional)",
    "perment_address": "string (max 300) or null (optional)",
    "postal_address": "string (max 300) or null (optional)",
    "e_contact_1_relation": "enum or null (optional)",
    "e_contact_1_full_name": "string (min 2, max 150) or null (optional)",
    "e_contact_1_phone": "string (min 7, max 20) or null (optional)",
    "e_contact_1_phone_country_code": "string (max 5) or null (optional)",
    "e_contact_1_email": "string (valid email) or null (optional)",
    "e_contact_2_relation": "enum or null (optional)",
    "e_contact_2_full_name": "string (max 150) or null (optional)",
    "e_contact_2_phone": "string (min 7, max 20) or null (optional)",
    "e_contact_2_phone_country_code": "string (max 5) or null (optional)",
    "e_contact_2_email": "string (valid email) or null (optional)",
    "primary_contact": "integer (1 or 2) or null (optional)"
  } | null,
  "bankInfo": {
    "bank_name": "string (min 2, max 150) or null (optional)",
    "branch_name": "string (max 150) or null (optional)",
    "branch_code": "string (max 20) or null (optional)",
    "iban": "string (min 10, max 34) or null (optional)",
    "account_title": "string (min 2, max 200) or null (optional)",
    "account_number": "string (max 30) or null (optional)",
    "account_type": "enum: 'current' | 'savings' | 'salary' or null (optional)"
  } | null,
  "medicalInfo": {
    "blood_group": "enum or null (optional)",
    "date_of_birth": "string or null (optional)",
    "gender": "enum: 'male' | 'female' | 'other' or null (optional)",
    "height_cm": "integer (> 0) or null (optional)",
    "weight_kg": "integer (> 0) or null (optional)",
    "has_disability": "boolean or null (optional)",
    "disability_type": "string (max 100) or null (optional)",
    "disability_description": "string or null (optional)",
    "has_chronic_condition": "boolean or null (optional)",
    "chronic_condition_notes": "string or null (optional)",
    "has_known_allergies": "boolean or null (optional)",
    "allergy_notes": "string or null (optional)",
    "emergency_medication": "string or null (optional)",
    "fitness_status": "string (max 30) or null (optional)",
    "last_medical_exam_date": "string or null (optional)",
    "next_medical_exam_date": "string or null (optional)"
  } | null
}
```

**Important:** At least one of the three top-level keys (`emergencyContacts`, `bankInfo`, `medicalInfo`) must be provided in the request. If all are `null` or omitted, the request will return `400 Bad Request`.

**Example Request (Update Medical Info Only):**
```json
{
  "medicalInfo": {
    "blood_group": "A+",
    "gender": "male",
    "height_cm": 178,
    "weight_kg": 75,
    "has_disability": false,
    "has_known_allergies": true,
    "allergy_notes": "Peanut allergy",
    "fitness_status": "fit",
    "last_medical_exam_date": "2024-11-15",
    "next_medical_exam_date": "2025-11-15"
  }
}
```

**Example Request (Update Emergency + Bank Info Together):**
```json
{
  "emergencyContacts": {
    "contact_1": "03339876543",
    "e_contact_1_relation": "father",
    "e_contact_1_full_name": "Sultan Ali",
    "e_contact_1_phone": "03339876543",
    "e_contact_1_email": "sultan@email.com"
  },
  "bankInfo": {
    "bank_name": "Habib Bank Limited",
    "iban": "PK36HABL0000123456789012",
    "account_title": "Fatima Ali",
    "account_type": "current"
  }
}
```

### Response Body

**Success (200 OK):**
Returns an object with the updated section(s) only.

```json
{
  "success": true,
  "data": {
    "emergencyContacts": {
      "contact_1": "03339876543",
      "e_contact_1_relation": "father",
      "e_contact_1_full_name": "Sultan Ali",
      "e_contact_1_phone": "03339876543",
      "e_contact_1_email": "sultan@email.com",
      "updated_at": "2025-05-06T15:30:00.000Z"
    },
    "bankInfo": {
      "bank_name": "Habib Bank Limited",
      "iban": "PK36HABL0000123456789012",
      "account_title": "Fatima Ali",
      "account_type": "current",
      "updated_at": "2025-05-06T15:30:00.000Z"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: No update sections provided (all three are null/missing)
- `422 Validation Error`: Invalid data within any provided section

**Example cURL (Medical Info Update):**

```bash
curl -X PATCH http://localhost:3001/api/employees/EMP002/extra \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "medicalInfo": {
      "blood_group": "A+",
      "gender": "male",
      "height_cm": 178,
      "weight_kg": 75,
      "has_known_allergies": true,
      "allergy_notes": "Peanut allergy"
    }
  }'
```

---

## POST /employees/:employeeId/resend-credentials

Resend login credentials (email with temporary password) to an employee. Typically used when an employee forgets their password or hasn't received their initial onboarding email. Requires `employees:write` permission.

**Authentication:** Required  
**Permissions:** `employees:write`

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `employeeId` | String (employee_id) or UUID | Employee to resend credentials for |

### Request Body
None. Empty body or no body.

### Response Body

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Credentials sent to employee's email address",
    "employee_id": "EMP002",
    "email": "fatima.ali@company.com",
    "sent_at": "2025-05-06T16:00:00.000Z"
  }
}
```

**Fields in `data`:**
- `message` (String): Confirmation that credentials were sent
- `employee_id` (String): Employee code
- `email` (String): Email address the credentials were sent to
- `sent_at` (Timestamp): When the email was dispatched

**Error Responses:**
- `404 Not Found`: Employee doesn't exist
- `404 Not Found`: Employee has no associated user account yet (would need admin to create one)
- `500 Internal Server Error`: Email service failure

**Note:** The actual temporary password is sent via email, not returned in the API response for security reasons.

**Example cURL:**

```bash
curl -X POST http://localhost:3001/api/employees/EMP002/resend-credentials \
  -H "Authorization: Bearer <your_token>"
```

---

## Notes

- **employee_id:** When creating an employee, the system automatically generates an employee code (e.g., "EMP002") if not explicitly provided. The `employee_id` field is part of the `personalInfo`? Actually from employee controller, we see the service generates it. The API doesn't require you to send employee_id in the create payload - it's generated by the system.
- **Validation:** All UUID fields must reference existing records in configuration tables. If you provide an invalid UUID (not existing in DB), the create/update may fail with a foreign key constraint error or return `404` depending on implementation.
- **Email Uniqueness:** The `accountInfo.email` must be unique across all users. Attempting to create an employee with an already-used email returns `409 Conflict`.
- **Partial Updates:** For PATCH endpoints, the entire `personalInfo` / `jobInfo` object is validated as a whole, but all fields within are optional. You can send just `{ "name": "New Name" }` for personal update.
- **Separate Sections:** The `extra` update (`/extra`) is unique because it bundles three independent sections. This allows you to update emergency contacts, bank info, and/or medical info in a single request without affecting other sections.
- **User Account Creation:** The `POST /employees` endpoint may automatically create a corresponding user account (for system login) with a randomly generated initial password. That's what `resend-credentials` uses to send or resend those credentials.
- **Soft Deletes:** Employee deletion is typically handled via setting an `is_active` flag, not hard delete. The `date_of_exit` field in `jobInfo` records termination date.
- **Manager Hierarchy:** The `manager_emp_id` field in `jobInfo` references another employee's `employee_id` to establish reporting structure.
- **Salary Confidentiality:** `salaryInfo` data is sensitive and may be restricted to specific roles (HR, managers). Even though it's part of the employee create/update schema, not all users with `employees:write` may have access to view salary fields in responses.
- **Response Data:** GET responses include denormalized fields like `department_name`, `designation_name` for easier display. These are joined from lookup tables.

---

## Quick Reference: Required Configuration IDs

Before creating an employee, ensure these configuration records exist (all are UUIDs):

- **Department:** `POST /config/departments`
- **Designation:** `POST /config/designations`
- **Employment Type:** `POST /config/employment-types`
- **Job Status:** `POST /config/job-statuses`
- **Work Mode:** `POST /config/work-modes`
- **Work Location:** `POST /config/work-locations`
- **Shift:** `POST /config/shifts`
- **Role (optional):** `POST /config/roles` (if setting `accountInfo.role_id`)

Fetch their IDs via `GET /config/:entity` and use those UUIDs in the `jobInfo` section.
