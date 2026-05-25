import { z } from 'zod';

const phoneSchema = z.string().min(7).max(20);

const personalInfoSchema = z.object({
  name: z.string().min(2).max(100),
  father_name: z.string().min(2).max(100),
  cnic: z.string().min(5).max(20),
  date_of_birth: z.string().min(4).max(15),
});

const jobInfoSchema = z.object({
  department_id: z.string().uuid(),
  designation_id: z.string().uuid(),
  employment_type_id: z.string().uuid(),
  job_status_id: z.string().uuid(),
  work_mode_id: z.string().uuid(),
  work_location_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  date_of_joining: z.string().min(8),
  date_of_exit: z.string().min(8).optional().nullable(),
  probation_end_date: z.string().min(8).optional().nullable(),
  contract_end_date: z.string().min(8).optional().nullable(),
});

const salaryInfoSchema = z
  .object({
    base_salary: z.number().nonnegative().optional(),
  })
  .optional();

const accountInfoSchema = z.object({
  email: z.string().email(),
  phone: phoneSchema,
  role_id: z.string().uuid().optional().nullable(),
  password: z.string().min(6).optional().nullable(),
});

const emergencyContactsSchema = z.object({
  contact_1: phoneSchema,
  contact_2: phoneSchema.optional().nullable(),
  perment_address: z.string().max(300).optional().nullable(),
  postal_address: z.string().max(300).optional().nullable(),
  e_contact_1_relation: z.enum(['father', 'mother', 'brother', 'sister', 'wife', 'husband', 'son', 'daughter', 'friend', 'neighbor', 'other']),
  e_contact_1_full_name: z.string().min(2).max(150),
  e_contact_1_phone: phoneSchema,
  e_contact_1_phone_country_code: z.string().max(5).default('+92'),
  e_contact_1_email: z.string().email().optional().nullable(),
  e_contact_2_relation: z.enum(['father', 'mother', 'brother', 'sister', 'wife', 'husband', 'son', 'daughter', 'friend', 'neighbor', 'other']).optional().nullable(),
  e_contact_2_full_name: z.string().max(150).optional().nullable(),
  e_contact_2_phone: phoneSchema.optional().nullable(),
  e_contact_2_phone_country_code: z.string().max(5).default('+92').optional().nullable(),
  e_contact_2_email: z.string().email().optional().nullable(),
  primary_contact: z.number().int().min(1).max(2).default(1),
});

const bankInfoSchema = z.object({
  bank_name: z.string().min(2).max(150),
  branch_name: z.string().max(150).optional().nullable(),
  branch_code: z.string().max(20).optional().nullable(),
  iban: z.string().min(10).max(34),
  account_title: z.string().min(2).max(200),
  account_number: z.string().max(30).optional().nullable(),
  account_type: z.enum(['current', 'savings', 'salary']).optional().nullable(),
});

const medicalInfoSchema = z.object({
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  height_cm: z.number().int().positive().optional().nullable(),
  weight_kg: z.number().int().positive().optional().nullable(),
  has_disability: z.boolean().default(false),
  disability_type: z.string().max(100).optional().nullable(),
  disability_description: z.string().optional().nullable(),
  has_chronic_condition: z.boolean().default(false),
  chronic_condition_notes: z.string().optional().nullable(),
  has_known_allergies: z.boolean().default(false),
  allergy_notes: z.string().optional().nullable(),
  emergency_medication: z.string().optional().nullable(),
  fitness_status: z.string().max(30).optional().nullable(),
  last_medical_exam_date: z.string().optional().nullable(),
  next_medical_exam_date: z.string().optional().nullable(),
});

export const createEmployeeSchema = z.object({
  personalInfo: personalInfoSchema,
  jobInfo: jobInfoSchema,
  salaryInfo: salaryInfoSchema,
  accountInfo: accountInfoSchema,
  emergencyContacts: emergencyContactsSchema.optional(),
  bankInfo: bankInfoSchema.optional(),
  medicalInfo: medicalInfoSchema.optional(),
});

export const updatePersonalInfoSchema = personalInfoSchema.partial().extend({
  dob: z.string().min(4).max(15).optional().nullable(),
  marital_status: z.string().max(50).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional().nullable(),
  phone: z.string().min(7).max(20).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  email: z.string().email().optional().nullable(),
  bank_name: z.string().min(2).max(150).optional().nullable(),
  bank_account_title: z.string().min(2).max(200).optional().nullable(),
  bank_account_no: z.string().min(10).max(34).optional().nullable(),
});

export const updateJobInfoSchema = jobInfoSchema.partial().extend({
  manager_emp_id: z.string().max(10).optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
});

export const updateEmergencyContactsSchema = emergencyContactsSchema.partial();
export const updateBankInfoSchema = bankInfoSchema.partial();
export const updateMedicalInfoSchema = medicalInfoSchema.partial();

export const updateExtraInfoSchema = z.object({
  emergencyContacts: updateEmergencyContactsSchema.optional(),
  bankInfo: updateBankInfoSchema.optional(),
  medicalInfo: updateMedicalInfoSchema.optional(),
});


