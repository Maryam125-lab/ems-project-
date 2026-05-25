import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';
import { generateTempPassword, hashPassword } from '../auth/auth.service.js';
import { logAudit } from '../../utils/audit-logger.js';


function nextEmployeeCodeFromMax(maxEmployeeId) {
  const current = Number((maxEmployeeId || 'EMP000').replace('EMP', '')) || 0;
  const next = current + 1;
  return `EMP${String(next).padStart(3, '0')}`;
}

export async function createEmployee(data, createdByUserId) {
  console.log('[DEBUG] createEmployee data:', JSON.stringify(data, null, 2));
  const { personalInfo, jobInfo, salaryInfo, accountInfo, emergencyContacts, bankInfo, medicalInfo } = data;

  const duplicateCnic = await pool.query(
    `SELECT 1 FROM public.employee_info WHERE cnic = $1 LIMIT 1`,
    [personalInfo.cnic]
  );
  if (duplicateCnic.rowCount > 0) throw new AppError(409, 'DUPLICATE_CNIC', 'CNIC already exists.');

  const duplicateEmail = await pool.query(
    `SELECT 1 FROM public.users WHERE email = $1 LIMIT 1`,
    [accountInfo.email]
  );
  if (duplicateEmail.rowCount > 0) throw new AppError(409, 'DUPLICATE_EMAIL', 'Email already exists.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const maxEmployeeResult = await client.query(
      `SELECT employee_id FROM public.employee_info WHERE employee_id ~ '^EMP[0-9]+$' ORDER BY CAST(SUBSTRING(employee_id FROM 4) AS INTEGER) DESC LIMIT 1`
    );
    const employeeId = nextEmployeeCodeFromMax(maxEmployeeResult.rows[0]?.employee_id);

    const employeeInsert = await client.query(
      `INSERT INTO public.employee_info (employee_id, name, father_name, cnic, date_of_birth)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, employee_id, name, father_name, cnic, date_of_birth`,
      [employeeId, personalInfo.name, personalInfo.father_name, personalInfo.cnic, personalInfo.date_of_birth]
    );

    await client.query(
      `INSERT INTO public.job_info (employee_id, department_id, designation_id, employment_type_id, job_status_id, work_mode_id, work_location_id, shift_id, date_of_joining, date_of_exit, probation_end_date, contract_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [employeeId, jobInfo.department_id, jobInfo.designation_id, jobInfo.employment_type_id, jobInfo.job_status_id, jobInfo.work_mode_id, jobInfo.work_location_id, jobInfo.shift_id, jobInfo.date_of_joining, jobInfo.date_of_exit || null, jobInfo.probation_end_date || null, jobInfo.contract_end_date || null]
    );

    if (emergencyContacts) {
      await client.query(
        `INSERT INTO public.emergency_contacts (employee_id, contact_1, contact_2, perment_address, postal_address, e_contact_1_relation, e_contact_1_full_name, e_contact_1_phone, e_contact_1_phone_country_code, e_contact_1_email, e_contact_2_relation, e_contact_2_full_name, e_contact_2_phone, e_contact_2_phone_country_code, e_contact_2_email, primary_contact)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [employeeId, emergencyContacts.contact_1 || accountInfo.phone, emergencyContacts.contact_2 || null, emergencyContacts.perment_address || null, emergencyContacts.postal_address || null, emergencyContacts.e_contact_1_relation, emergencyContacts.e_contact_1_full_name, emergencyContacts.e_contact_1_phone, emergencyContacts.e_contact_1_phone_country_code || '+92', emergencyContacts.e_contact_1_email || null, emergencyContacts.e_contact_2_relation || null, emergencyContacts.e_contact_2_full_name || null, emergencyContacts.e_contact_2_phone || null, emergencyContacts.e_contact_2_phone_country_code || '+92', emergencyContacts.e_contact_2_email || null, emergencyContacts.primary_contact || 1]
      );
    }

    if (bankInfo && bankInfo.bank_name && bankInfo.iban && bankInfo.account_title) {
      await client.query(
        `INSERT INTO public.employee_bank_accounts (employee_id, bank_name, branch_name, branch_code, iban, account_title, account_number, account_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [employeeId, bankInfo.bank_name, bankInfo.branch_name || null, bankInfo.branch_code || null, bankInfo.iban, bankInfo.account_title, bankInfo.account_number || null, bankInfo.account_type || null]
      );
    }

    if (medicalInfo && (medicalInfo.blood_group || medicalInfo.gender)) {
      await client.query(
        `INSERT INTO public.employee_medical (employee_id, blood_group, date_of_birth, gender, height_cm, weight_kg, has_disability, disability_type, disability_description, has_chronic_condition, chronic_condition_notes, has_known_allergies, allergy_notes, emergency_medication, fitness_status, last_medical_exam_date, next_medical_exam_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [employeeId, medicalInfo.blood_group || null, medicalInfo.date_of_birth || null, medicalInfo.gender || null, medicalInfo.height_cm || null, medicalInfo.weight_kg || null, medicalInfo.has_disability || false, medicalInfo.disability_type || null, medicalInfo.disability_description || null, medicalInfo.has_chronic_condition || false, medicalInfo.chronic_condition_notes || null, medicalInfo.has_known_allergies || false, medicalInfo.allergy_notes || null, medicalInfo.emergency_medication || null, medicalInfo.fitness_status || null, medicalInfo.last_medical_exam_date || null, medicalInfo.next_medical_exam_date || null]
      );
    }

    const password = accountInfo.password || generateTempPassword();
    const hashedPassword = await hashPassword(password);

    let roleId = accountInfo.role_id;
    if (!roleId) {
      const empRole = await client.query("SELECT id FROM public.roles WHERE role_name = 'employee' LIMIT 1");
      roleId = empRole.rows[0]?.id;
    }

    await client.query(
      `INSERT INTO public.users (employee_id, email, password, role_id, must_change_password) VALUES ($1, $2, $3, $4, false)`,
      [employeeId, accountInfo.email, hashedPassword, roleId]
    );

    await client.query(
      `INSERT INTO public.directory_entries (employee_id, name, email, phone_mobile, department_id, branch_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [employeeId, personalInfo.name, accountInfo.email, accountInfo.phone || null, jobInfo.department_id, jobInfo.work_location_id, createdByUserId]
    );

    if (salaryInfo && salaryInfo.base_salary) {
      await client.query(
        `INSERT INTO public.employee_salary (id, employee_id, basic_salary, currency, effective_from, is_current, is_active, revision_type, created_by) VALUES (gen_random_uuid(), $1, $2, 'PKR', CURRENT_DATE, true, true, 'Initial', $3)`,
        [employeeId, salaryInfo.base_salary, createdByUserId]
      );
    }

    await client.query('COMMIT');

    const empUUID = employeeInsert.rows[0]?.id;
    logAudit({ userId: createdByUserId, action: 'INSERT', tableName: 'employee_info', recordId: empUUID, reason: `Onboarded new employee ${personalInfo.name} (${employeeId})` });

    return { employee: employeeInsert.rows[0], tempPassword: password };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getEmployees({ search, department_id, is_active, page = 1, limit = 10000 }) {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 10000, 1), 10000);
  const offset = (normalizedPage - 1) * normalizedLimit;

  const whereParts = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    whereParts.push(`(ei.employee_id ILIKE $${params.length} OR ei.name ILIKE $${params.length})`);
  }
  if (department_id) { params.push(department_id); whereParts.push(`ji.department_id = $${params.length}`); }
  if (typeof is_active === 'boolean') { params.push(is_active); whereParts.push(`COALESCE(u.is_active, true) = $${params.length}`); }

  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

  const dataResult = await pool.query(`
    SELECT ei.employee_id, ei.name, ji.designation_id, ji.department_id,
      dsg.title AS designation_title, dep.department_name,
      js.status_name AS status, ji.date_of_joining
    FROM public.employee_info ei
    JOIN public.job_info ji ON ji.employee_id = ei.employee_id
    LEFT JOIN public.departments dep ON dep.id = ji.department_id
    LEFT JOIN public.designations dsg ON dsg.id = ji.designation_id
    LEFT JOIN public.job_statuses js ON js.id = ji.job_status_id
    LEFT JOIN public.users u ON u.employee_id = ei.employee_id
    ${whereSql}
    ORDER BY ei.name ASC, ei.employee_id ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, normalizedLimit, offset]);

  const countResult = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM public.employee_info ei
    JOIN public.job_info ji ON ji.employee_id = ei.employee_id
    LEFT JOIN public.users u ON u.employee_id = ei.employee_id
    ${whereSql}
  `, params);

  return {
    data: dataResult.rows,
    meta: { total: countResult.rows[0]?.total || 0, page: normalizedPage, limit: normalizedLimit, pages: Math.max(Math.ceil((countResult.rows[0]?.total || 0) / normalizedLimit), 1) }
  };
}

export async function getEmployeeById(employeeId) {
  const result = await pool.query(`
    SELECT
      ei.*,
      ji.department_id, ji.designation_id, ji.employment_type_id, ji.job_status_id,
      ji.work_mode_id, ji.work_location_id, ji.shift_id, ji.date_of_joining,
      ji.date_of_exit, ji.probation_end_date, ji.contract_end_date,
      dep.department_name, dep.department_code,
      dsg.title AS designation_title,
      et.type_name AS employment_type_name,
      js.status_name AS job_status_name,
      wm.mode_name AS work_mode_name,
      wl.location_name AS work_location_name,
      s.name AS shift_name, s.start_time AS shift_start_time, s.end_time AS shift_end_time, s.late_after_minutes,
      ec.contact_1, ec.contact_2, ec.perment_address, ec.postal_address,
      ec.e_contact_1_relation, ec.e_contact_1_full_name, ec.e_contact_1_phone, ec.e_contact_1_phone_country_code, ec.e_contact_1_email,
      ec.e_contact_2_relation, ec.e_contact_2_full_name, ec.e_contact_2_phone, ec.e_contact_2_phone_country_code, ec.e_contact_2_email,
      ec.primary_contact,
      eba.bank_name, eba.branch_name, eba.branch_code, eba.iban, eba.account_title, eba.account_number, eba.account_type, eba.is_verified,
      em.blood_group, em.date_of_birth AS medical_dob, em.gender,
      em.height_cm, em.weight_kg, em.has_disability, em.disability_type, em.disability_description,
      em.has_chronic_condition, em.chronic_condition_notes, em.has_known_allergies, em.allergy_notes,
      em.emergency_medication, em.fitness_status, em.last_medical_exam_date, em.next_medical_exam_date,
      u.email AS user_email,
      de.phone_mobile AS phone_mobile,
      es.basic_salary AS basic_salary
    FROM public.employee_info ei
    LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
    LEFT JOIN public.departments dep ON dep.id = ji.department_id
    LEFT JOIN public.designations dsg ON dsg.id = ji.designation_id
    LEFT JOIN public.employment_types et ON et.id = ji.employment_type_id
    LEFT JOIN public.job_statuses js ON js.id = ji.job_status_id
    LEFT JOIN public.work_modes wm ON wm.id = ji.work_mode_id
    LEFT JOIN public.work_locations wl ON wl.id = ji.work_location_id
    LEFT JOIN public.shifts s ON s.id = ji.shift_id
    LEFT JOIN public.emergency_contacts ec ON ec.employee_id = ei.employee_id
    LEFT JOIN public.employee_bank_accounts eba ON eba.employee_id = ei.employee_id
    LEFT JOIN public.employee_medical em ON em.employee_id = ei.employee_id
    LEFT JOIN public.users u ON u.employee_id = ei.employee_id
    LEFT JOIN public.directory_entries de ON de.employee_id = ei.employee_id
    LEFT JOIN public.employee_salary es ON es.employee_id = ei.employee_id AND es.is_current = true
    WHERE ei.employee_id = $1
    LIMIT 1
  `, [employeeId]);

  if (result.rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Employee not found.');

  const row = result.rows[0];
  const employee = { ...row };

  employee.email              = row.user_email || '';
  employee.phone              = row.phone_mobile || row.contact_1 || '';
  employee.dob                = row.date_of_birth || '';
  employee.joining_date       = row.date_of_joining || '';
  employee.location_name      = row.work_location_name || '';
  employee.gender             = row.gender || '';
  employee.blood_group        = row.blood_group || '';
  employee.bank_name          = row.bank_name || '';
  employee.bank_account_title = row.account_title || '';
  employee.bank_account_no    = row.account_number || row.iban || '';
  employee.basic_salary       = Number(row.basic_salary) || 0;
  employee.marital_status     = row.marital_status || '';
  employee.address            = row.perment_address || row.postal_address || '';
  employee.manager_name       = '';
  employee.manager_id         = '';

  return employee;
}

export async function updatePersonalInfo(employeeId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE public.employee_info SET
        name           = COALESCE($2, name),
        cnic           = COALESCE($3, cnic),
        date_of_birth  = COALESCE($4, date_of_birth),
        marital_status = COALESCE($5, marital_status),
        updated_at     = now()
      WHERE employee_id = $1
    `, [employeeId, data.name || null, data.cnic || null, data.dob || null, data.marital_status || null]);

    await client.query(`
      INSERT INTO public.employee_medical (employee_id, gender, blood_group)
      VALUES ($1, $2, $3)
      ON CONFLICT (employee_id) DO UPDATE SET
        gender      = COALESCE(EXCLUDED.gender, employee_medical.gender),
        blood_group = COALESCE(EXCLUDED.blood_group, employee_medical.blood_group),
        updated_at  = now()
    `, [employeeId, data.gender || null, data.blood_group || null]);

    const existingContact = await client.query(
      `SELECT 1 FROM public.emergency_contacts WHERE employee_id = $1 LIMIT 1`,
      [employeeId]
    );

    if (existingContact.rowCount > 0) {
      await client.query(`
        UPDATE public.emergency_contacts SET
          contact_1       = COALESCE($2, contact_1),
          perment_address = COALESCE($3, perment_address),
          updated_at      = now()
        WHERE employee_id = $1
      `, [employeeId, data.phone || null, data.address || null]);
    } else {
      await client.query(`
        INSERT INTO public.emergency_contacts (employee_id, contact_1, perment_address, e_contact_1_relation, e_contact_1_full_name, e_contact_1_phone)
        VALUES ($1, $2, $3, 'other', 'Unknown', $2)
      `, [employeeId, data.phone || '00000000000', data.address || '', 'other', 'Unknown', data.phone || '00000000000']);
    }

    await client.query(`
      UPDATE public.directory_entries SET
        email        = COALESCE($2, email),
        phone_mobile = COALESCE($3, phone_mobile),
        updated_at   = now()
      WHERE employee_id = $1
    `, [employeeId, data.email || null, data.phone || null]);

    if (data.bank_name || data.bank_account_title || data.bank_account_no) {
      const existingBank = await client.query(
        `SELECT 1 FROM public.employee_bank_accounts WHERE employee_id = $1 LIMIT 1`,
        [employeeId]
      );
      if (existingBank.rowCount > 0) {
        await client.query(`
          UPDATE public.employee_bank_accounts SET
            bank_name      = COALESCE($2, bank_name),
            account_title  = COALESCE($3, account_title),
            account_number = COALESCE($4, account_number),
            iban           = COALESCE($5, iban),
            updated_at     = now()
          WHERE employee_id = $1
        `, [employeeId, data.bank_name || null, data.bank_account_title || null, data.bank_account_no || null, data.bank_account_no || null]);
      } else {
        await client.query(`
          INSERT INTO public.employee_bank_accounts (employee_id, bank_name, account_title, account_number, iban)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          employeeId,
          data.bank_name || 'Unknown Bank',
          data.bank_account_title || 'Unknown Title',
          data.bank_account_no || '',
          data.bank_account_no || 'PK0000000000000000000000'
        ]);
      }
    }

    await client.query('COMMIT');
    return await getEmployeeById(employeeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateJobInfo(employeeId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT * FROM public.job_info WHERE employee_id = $1 LIMIT 1`,
      [employeeId]
    );

    if (currentResult.rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Employee job info not found.');

    const current = currentResult.rows[0];
    const departmentChanged = data.department_id && data.department_id !== current.department_id;
    const designationChanged = data.designation_id && data.designation_id !== current.designation_id;

    if (departmentChanged || designationChanged) {
      await client.query(`
        INSERT INTO public.employee_job_history (employee_id, department_id, designation_id, manager_emp_id, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
      `, [employeeId, current.department_id, current.designation_id, data.manager_emp_id || null, current.date_of_joining]);
    }

    const allowedFields = ['department_id', 'designation_id', 'employment_type_id', 'job_status_id', 'work_mode_id', 'work_location_id', 'shift_id', 'date_of_joining', 'date_of_exit', 'probation_end_date', 'contract_end_date'];

    const fieldMap = {
      location_id: 'work_location_id',
    };

    const updates = [];
    const params = [];

    for (const [frontendField, dbField] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(data, frontendField) && data[frontendField]) {
        params.push(data[frontendField]);
        updates.push(`${dbField} = $${params.length}`);
      }
    }

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(data, field) && data[field]) {
        params.push(data[field]);
        updates.push(`${field} = $${params.length}`);
      }
    }

    if (updates.length > 0) {
      params.push(employeeId);
      await client.query(`
        UPDATE public.job_info SET ${updates.join(', ')}, updated_at = now()
        WHERE employee_id = $${params.length}
      `, params);
    }

    await client.query('COMMIT');
    return await getEmployeeById(employeeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEmergencyContacts(employeeId, data) {
  const result = await pool.query(`
    INSERT INTO public.emergency_contacts (employee_id, contact_1, contact_2, perment_address, postal_address, e_contact_1_relation, e_contact_1_full_name, e_contact_1_phone, e_contact_1_phone_country_code, e_contact_1_email, e_contact_2_relation, e_contact_2_full_name, e_contact_2_phone, e_contact_2_phone_country_code, e_contact_2_email, primary_contact)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (employee_id) DO UPDATE SET
      contact_1 = COALESCE(EXCLUDED.contact_1, emergency_contacts.contact_1),
      contact_2 = COALESCE(EXCLUDED.contact_2, emergency_contacts.contact_2),
      perment_address = COALESCE(EXCLUDED.perment_address, emergency_contacts.perment_address),
      postal_address = COALESCE(EXCLUDED.postal_address, emergency_contacts.postal_address),
      e_contact_1_relation = COALESCE(EXCLUDED.e_contact_1_relation, emergency_contacts.e_contact_1_relation),
      e_contact_1_full_name = COALESCE(EXCLUDED.e_contact_1_full_name, emergency_contacts.e_contact_1_full_name),
      e_contact_1_phone = COALESCE(EXCLUDED.e_contact_1_phone, emergency_contacts.e_contact_1_phone),
      e_contact_1_phone_country_code = COALESCE(EXCLUDED.e_contact_1_phone_country_code, emergency_contacts.e_contact_1_phone_country_code),
      e_contact_1_email = COALESCE(EXCLUDED.e_contact_1_email, emergency_contacts.e_contact_1_email),
      e_contact_2_relation = COALESCE(EXCLUDED.e_contact_2_relation, emergency_contacts.e_contact_2_relation),
      e_contact_2_full_name = COALESCE(EXCLUDED.e_contact_2_full_name, emergency_contacts.e_contact_2_full_name),
      e_contact_2_phone = COALESCE(EXCLUDED.e_contact_2_phone, emergency_contacts.e_contact_2_phone),
      e_contact_2_phone_country_code = COALESCE(EXCLUDED.e_contact_2_phone_country_code, emergency_contacts.e_contact_2_phone_country_code),
      e_contact_2_email = COALESCE(EXCLUDED.e_contact_2_email, emergency_contacts.e_contact_2_email),
      primary_contact = COALESCE(EXCLUDED.primary_contact, emergency_contacts.primary_contact),
      updated_at = now()
    RETURNING *
  `, [employeeId, data.contact_1 || null, data.contact_2 || null, data.perment_address || null, data.postal_address || null, data.e_contact_1_relation || null, data.e_contact_1_full_name || null, data.e_contact_1_phone || null, data.e_contact_1_phone_country_code || null, data.e_contact_1_email || null, data.e_contact_2_relation || null, data.e_contact_2_full_name || null, data.e_contact_2_phone || null, data.e_contact_2_phone_country_code || null, data.e_contact_2_email || null, data.primary_contact || null]);

  return result.rows[0];
}

export async function updateBankInfo(employeeId, data) {
  const result = await pool.query(`
    INSERT INTO public.employee_bank_accounts (employee_id, bank_name, branch_name, branch_code, iban, account_title, account_number, account_type)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (employee_id) DO UPDATE SET
      bank_name = COALESCE(EXCLUDED.bank_name, employee_bank_accounts.bank_name),
      branch_name = COALESCE(EXCLUDED.branch_name, employee_bank_accounts.branch_name),
      branch_code = COALESCE(EXCLUDED.branch_code, employee_bank_accounts.branch_code),
      iban = COALESCE(EXCLUDED.iban, employee_bank_accounts.iban),
      account_title = COALESCE(EXCLUDED.account_title, employee_bank_accounts.account_title),
      account_number = COALESCE(EXCLUDED.account_number, employee_bank_accounts.account_number),
      account_type = COALESCE(EXCLUDED.account_type, employee_bank_accounts.account_type),
      updated_at = now()
    RETURNING *
  `, [employeeId, data.bank_name || null, data.branch_name || null, data.branch_code || null, data.iban || null, data.account_title || null, data.account_number || null, data.account_type || null]);

  return result.rows[0];
}

export async function updateMedicalInfo(employeeId, data) {
  const result = await pool.query(`
    INSERT INTO public.employee_medical (employee_id, blood_group, date_of_birth, gender, height_cm, weight_kg, has_disability, disability_type, disability_description, has_chronic_condition, chronic_condition_notes, has_known_allergies, allergy_notes, emergency_medication, fitness_status, last_medical_exam_date, next_medical_exam_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (employee_id) DO UPDATE SET
      blood_group = COALESCE(EXCLUDED.blood_group, employee_medical.blood_group),
      date_of_birth = COALESCE(EXCLUDED.date_of_birth, employee_medical.date_of_birth),
      gender = COALESCE(EXCLUDED.gender, employee_medical.gender),
      height_cm = COALESCE(EXCLUDED.height_cm, employee_medical.height_cm),
      weight_kg = COALESCE(EXCLUDED.weight_kg, employee_medical.weight_kg),
      has_disability = COALESCE(EXCLUDED.has_disability, employee_medical.has_disability),
      disability_type = COALESCE(EXCLUDED.disability_type, employee_medical.disability_type),
      disability_description = COALESCE(EXCLUDED.disability_description, employee_medical.disability_description),
      has_chronic_condition = COALESCE(EXCLUDED.has_chronic_condition, employee_medical.has_chronic_condition),
      chronic_condition_notes = COALESCE(EXCLUDED.chronic_condition_notes, employee_medical.chronic_condition_notes),
      has_known_allergies = COALESCE(EXCLUDED.has_known_allergies, employee_medical.has_known_allergies),
      allergy_notes = COALESCE(EXCLUDED.allergy_notes, employee_medical.allergy_notes),
      emergency_medication = COALESCE(EXCLUDED.emergency_medication, employee_medical.emergency_medication),
      fitness_status = COALESCE(EXCLUDED.fitness_status, employee_medical.fitness_status),
      last_medical_exam_date = COALESCE(EXCLUDED.last_medical_exam_date, employee_medical.last_medical_exam_date),
      next_medical_exam_date = COALESCE(EXCLUDED.next_medical_exam_date, employee_medical.next_medical_exam_date),
      updated_at = now()
    RETURNING *
  `, [employeeId, data.blood_group || null, data.date_of_birth || null, data.gender || null, data.height_cm || null, data.weight_kg || null, data.has_disability ?? null, data.disability_type || null, data.disability_description || null, data.has_chronic_condition ?? null, data.chronic_condition_notes || null, data.has_known_allergies ?? null, data.allergy_notes || null, data.emergency_medication || null, data.fitness_status || null, data.last_medical_exam_date || null, data.next_medical_exam_date || null]);

  return result.rows[0];
}

export async function resendCredentials(employeeId) {
  const userResult = await pool.query(`
    SELECT u.id, ec.contact_1
    FROM public.users u
    LEFT JOIN public.emergency_contacts ec ON ec.employee_id = u.employee_id
    WHERE u.employee_id = $1 LIMIT 1
  `, [employeeId]);

  if (userResult.rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'User account not found for employee.');

  const tempPassword = generateTempPassword();
  const hashedPassword = await hashPassword(tempPassword);

  await pool.query(`
    UPDATE public.users SET password = $2, must_change_password = true, password_changed_at = NULL, updated_at = now()
    WHERE employee_id = $1
  `, [employeeId, hashedPassword]);

  return { tempPassword, whatsappPhone: userResult.rows[0]?.contact_1 || null };
}