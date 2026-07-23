using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers.Api;

[ApiController]
[Authorize]
[Route("api/employees")]
public sealed class EmployeesApiController : ControllerBase
{
    private readonly Db _db;

    public EmployeesApiController(Db db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, [FromQuery(Name = "department_id")] Guid? departmentId, [FromQuery(Name = "is_active")] bool? isActive, [FromQuery] int page = 1, [FromQuery] int limit = 10000, CancellationToken cancellationToken = default)
    {
        var normalizedPage = Math.Max(page, 1);
        var normalizedLimit = Math.Min(Math.Max(limit, 1), 10000);
        var offset = (normalizedPage - 1) * normalizedLimit;
        var where = new List<string>();
        var args = new DynamicParameters();
        args.Add("Limit", normalizedLimit);
        args.Add("Offset", offset);
        if (!string.IsNullOrWhiteSpace(search))
        {
            where.Add("(ei.employee_id ILIKE @Search OR ei.name ILIKE @Search)");
            args.Add("Search", $"%{search.Trim()}%");
        }
        if (departmentId is not null)
        {
            where.Add("ji.department_id = @DepartmentId");
            args.Add("DepartmentId", departmentId);
        }
        _ = isActive;
        var whereSql = where.Count == 0 ? "" : $"WHERE {string.Join(" AND ", where)}";

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureReportingManagerColumnAsync(connection);
        var rows = await connection.QueryAsync($"""
            SELECT
              ei.id,
              ei.employee_id,
              ei.name,
              ei.cnic,
              u.email,
              ji.designation_id,
              ji.department_id,
              dsg.title AS designation_title,
              dep.department_name,
              js.status_name AS status,
              ji.manager_emp_id,
              mgr.name AS manager_name,
              ji.date_of_joining
            FROM public.employee_info ei
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            LEFT JOIN public.employee_info mgr ON mgr.employee_id = ji.manager_emp_id
            LEFT JOIN public.departments dep ON dep.id = ji.department_id
            LEFT JOIN public.designations dsg ON dsg.id = ji.designation_id
            LEFT JOIN public.job_statuses js ON js.id = ji.job_status_id
            LEFT JOIN public.users u ON u.employee_id = ei.employee_id
            {whereSql}
            ORDER BY
              CASE WHEN ei.employee_id ~ '^EMP[0-9]+$' THEN 0 ELSE 1 END,
              CASE WHEN ei.employee_id ~ '^EMP[0-9]+$' THEN CAST(SUBSTRING(ei.employee_id FROM 4) AS INTEGER) ELSE 0 END DESC,
              ei.employee_id DESC
            LIMIT @Limit OFFSET @Offset
            """, args);
        var total = await connection.QuerySingleAsync<int>($"""
            SELECT COUNT(*)::int
            FROM public.employee_info ei
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            LEFT JOIN public.users u ON u.employee_id = ei.employee_id
            {whereSql}
            """, args);

        return Ok(ApiResponse<object>.Ok(new
        {
            data = rows,
            meta = new { total, page = normalizedPage, limit = normalizedLimit, pages = Math.Max((int)Math.Ceiling((double)total / normalizedLimit), 1) }
        }));
    }

    [HttpGet("{employeeId}")]
    public async Task<IActionResult> Get(string employeeId, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureReportingManagerColumnAsync(connection);
        await EnsureEmployeeProfileColumnsAsync(connection);
        var row = await connection.QuerySingleOrDefaultAsync("""
            SELECT
              ei.*,
              ji.department_id,
              ji.designation_id,
              ji.employment_type_id,
              ji.job_status_id,
              ji.work_mode_id,
              ji.work_location_id,
              ji.shift_id,
              ji.manager_emp_id,
              ji.date_of_joining,
              ji.date_of_exit,
              ji.probation_end_date,
              ji.contract_end_date,
              dep.department_name,
              dep.department_code,
              dsg.title AS designation_title,
              et.type_name AS employment_type_name,
              js.status_name AS job_status_name,
              wm.mode_name AS work_mode_name,
              wl.location_name AS work_location_name,
              s.name AS shift_name,
              mgr.name AS manager_name,
              ec.contact_1, ec.contact_2, ec.perment_address, ec.postal_address,
              ec.e_contact_1_relation, ec.e_contact_1_full_name, ec.e_contact_1_phone, ec.e_contact_1_phone_country_code, ec.e_contact_1_email,
              ec.e_contact_2_relation, ec.e_contact_2_full_name, ec.e_contact_2_phone, ec.e_contact_2_phone_country_code, ec.e_contact_2_email,
              ec.primary_contact,
              eba.bank_name, eba.branch_name, eba.branch_code, eba.iban, eba.account_title, eba.account_number, eba.account_type, eba.is_verified,
              em.blood_group, em.date_of_birth AS medical_dob, em.gender, em.height_cm, em.weight_kg,
              u.email AS user_email,
              de.phone_mobile AS phone_mobile,
              es.basic_salary, es.payroll_cycle, es.tax_status, es.allowance_notes, es.probation_salary, es.effective_from AS salary_effective_from,
              eas.portal_access, eas.access_role, eas.send_welcome_email,
              COALESCE(docs.documents, '[]'::json) AS documents
            FROM public.employee_info ei
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            LEFT JOIN public.departments dep ON dep.id = ji.department_id
            LEFT JOIN public.designations dsg ON dsg.id = ji.designation_id
            LEFT JOIN public.employment_types et ON et.id = ji.employment_type_id
            LEFT JOIN public.job_statuses js ON js.id = ji.job_status_id
            LEFT JOIN public.work_modes wm ON wm.id = ji.work_mode_id
            LEFT JOIN public.work_locations wl ON wl.id = ji.work_location_id
            LEFT JOIN public.shifts s ON s.id = ji.shift_id
            LEFT JOIN public.employee_info mgr ON mgr.employee_id = ji.manager_emp_id
            LEFT JOIN public.emergency_contacts ec ON ec.employee_id = ei.employee_id
            LEFT JOIN public.employee_bank_accounts eba ON eba.employee_id = ei.employee_id
            LEFT JOIN public.employee_medical em ON em.employee_id = ei.employee_id
            LEFT JOIN public.users u ON u.employee_id = ei.employee_id
            LEFT JOIN public.directory_entries de ON de.employee_id = ei.employee_id
            LEFT JOIN public.employee_salary es ON es.employee_id = ei.employee_id AND es.is_current = true
            LEFT JOIN public.employee_access_settings eas ON eas.employee_id = ei.employee_id
            LEFT JOIN LATERAL (
              SELECT json_agg(json_build_object('id', ed.id, 'document_type', ed.document_type, 'file_name', ed.file_name, 'file_status', ed.file_status, 'notes', ed.notes, 'created_at', ed.created_at) ORDER BY ed.created_at DESC) AS documents
              FROM public.employee_documents ed
              WHERE ed.employee_id = ei.employee_id
            ) docs ON true
            WHERE ei.employee_id = @EmployeeId OR ei.id::text = @EmployeeId
            LIMIT 1
            """, new { EmployeeId = employeeId });
        if (row is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Employee not found."));
        return Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        var personal = Section(body, "personalInfo");
        var job = Section(body, "jobInfo");
        var salary = Section(body, "salaryInfo");
        var account = Section(body, "accountInfo");
        var emergency = Section(body, "emergencyContacts");
        var bank = Section(body, "bankInfo");
        var medical = Section(body, "medicalInfo");
        var docs = Section(body, "documentInfo");
        var access = Section(body, "accessInfo");

        var name = Text(personal, "name");
        var cnic = Text(personal, "cnic");
        var email = Text(account, "email");
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(cnic) || string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Name, CNIC, and email are required."));
        }
        if (!IsLettersAndSpaces(name))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Employee name must contain letters and spaces only."));
        }
        if (!IsDigits(cnic, 13))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "CNIC must be exactly 13 digits."));
        }
        var phone = Text(account, "phone");
        if (!string.IsNullOrWhiteSpace(phone) && !IsDigits(phone, 11))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Phone number must be exactly 11 digits."));
        }
        var bankName = Text(bank, "bank_name");
        var bankAccountTitle = Text(bank, "account_title");
        var bankAccountNumber = Text(bank, "account_number");
        if (string.IsNullOrWhiteSpace(bankName) || string.IsNullOrWhiteSpace(bankAccountTitle) || string.IsNullOrWhiteSpace(bankAccountNumber))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Bank name, account title, and IBAN are required."));
        }
        if (!IsLettersAndSpaces(bankName) || !IsLettersAndSpaces(bankAccountTitle))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Bank name and account title must contain letters and spaces only."));
        }
        if (!IsAlphaNumeric(bankAccountNumber, 16, 34))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "IBAN must be 16 to 34 letters/numbers."));
        }

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureReportingManagerColumnAsync(connection);
        await EnsureEmployeeProfileColumnsAsync(connection);
        var duplicate = await connection.QuerySingleAsync<int>("SELECT COUNT(*)::int FROM public.employee_info WHERE cnic = @Cnic", new { Cnic = cnic });
        if (duplicate > 0) return Conflict(ApiResponse<object>.Fail("DUPLICATE_CNIC", "CNIC already exists."));
        duplicate = await connection.QuerySingleAsync<int>("SELECT COUNT(*)::int FROM public.users WHERE email = @Email", new { Email = email });
        if (duplicate > 0) return Conflict(ApiResponse<object>.Fail("DUPLICATE_EMAIL", "Email already exists."));

        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var maxEmployeeId = await connection.QuerySingleOrDefaultAsync<string>("SELECT employee_id FROM public.employee_info WHERE employee_id ~ '^EMP[0-9]+$' ORDER BY CAST(SUBSTRING(employee_id FROM 4) AS INTEGER) DESC LIMIT 1", transaction: tx);
            var employeeId = NextEmployeeCode(maxEmployeeId);
            var employee = await connection.QuerySingleAsync("""
                INSERT INTO public.employee_info (employee_id, name, father_name, cnic, date_of_birth, marital_status)
                VALUES (@EmployeeId, @Name, @FatherName, @Cnic, @DateOfBirth, @MaritalStatus)
                RETURNING id, employee_id, name, father_name, cnic, date_of_birth, marital_status
                """, new
            {
                EmployeeId = employeeId,
                Name = name,
                FatherName = Text(personal, "father_name"),
                Cnic = cnic,
                DateOfBirth = Text(personal, "date_of_birth"),
                MaritalStatus = Text(personal, "marital_status")
            }, tx);

            await connection.ExecuteAsync("""
                INSERT INTO public.job_info (employee_id, department_id, designation_id, employment_type_id, job_status_id, work_mode_id, work_location_id, shift_id, manager_emp_id, date_of_joining, date_of_exit, probation_end_date, contract_end_date)
                VALUES (@EmployeeId, @DepartmentId, @DesignationId, @EmploymentTypeId, @JobStatusId, @WorkModeId, @WorkLocationId, @ShiftId, @ManagerEmpId, CAST(@DateOfJoining AS date), CAST(@DateOfExit AS date), CAST(@ProbationEndDate AS date), CAST(@ContractEndDate AS date))
                """, new
            {
                EmployeeId = employeeId,
                DepartmentId = GuidValue(job, "department_id"),
                DesignationId = GuidValue(job, "designation_id"),
                EmploymentTypeId = GuidValue(job, "employment_type_id"),
                JobStatusId = GuidValue(job, "job_status_id"),
                WorkModeId = GuidValue(job, "work_mode_id"),
                WorkLocationId = GuidValue(job, "work_location_id"),
                ShiftId = GuidValue(job, "shift_id"),
                ManagerEmpId = Text(job, "manager_emp_id"),
                DateOfJoining = Text(job, "date_of_joining"),
                DateOfExit = Text(job, "date_of_exit"),
                ProbationEndDate = Text(job, "probation_end_date"),
                ContractEndDate = Text(job, "contract_end_date")
            }, tx);

            await UpsertEmergency(connection, tx, employeeId, emergency, Text(account, "phone"), email);
            await UpsertBank(connection, tx, employeeId, bank);
            await UpsertMedical(connection, tx, employeeId, medical, Text(personal, "date_of_birth"));
            await InsertSalary(connection, tx, employeeId, salary, current.UserId);
            await InsertDocuments(connection, tx, employeeId, docs, current.UserId);

            var password = Text(account, "password") ?? "Admin@1234";
            var roleId = GuidValue(account, "role_id") ?? await connection.QuerySingleOrDefaultAsync<Guid?>("SELECT id FROM public.roles WHERE role_name = 'employee' LIMIT 1", transaction: tx);
            var portalAccessEnabled = Text(access, "portal_access") != "disabled";
            await connection.ExecuteAsync("""
                INSERT INTO public.users (employee_id, email, password, role_id, must_change_password)
                VALUES (@EmployeeId, @Email, @Password, @RoleId, false)
                """, new { EmployeeId = employeeId, Email = email, Password = BCrypt.Net.BCrypt.HashPassword(password, 12), RoleId = roleId }, tx);

            await connection.ExecuteAsync("""
                INSERT INTO public.directory_entries (employee_id, name, email, phone_mobile, department_id, branch_id, created_by)
                VALUES (@EmployeeId, @Name, @Email, @Phone, @DepartmentId, @BranchId, @UserId)
                ON CONFLICT DO NOTHING
                """, new { EmployeeId = employeeId, Name = name, Email = email, Phone = Text(account, "phone"), DepartmentId = GuidValue(job, "department_id"), BranchId = GuidValue(job, "work_location_id"), current.UserId }, tx);

            await connection.ExecuteAsync("""
                INSERT INTO public.employee_access_settings (employee_id, portal_access, access_role, send_welcome_email, created_by)
                VALUES (@EmployeeId, @PortalAccess, @AccessRole, @SendWelcomeEmail, @UserId)
                """, new
            {
                EmployeeId = employeeId,
                PortalAccess = portalAccessEnabled,
                AccessRole = Text(access, "access_role") ?? "employee",
                SendWelcomeEmail = Text(access, "send_welcome_email") != "no",
                current.UserId
            }, tx);

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(new { employee, tempPassword = password }));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("{employeeId}/personal")]
    public async Task<IActionResult> UpdatePersonal(string employeeId, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureReportingManagerColumnAsync(connection);
        await EnsureEmployeeProfileColumnsAsync(connection);
        var cnic = Text(body, "cnic");
        var phone = Text(body, "phone");
        if (!string.IsNullOrWhiteSpace(cnic) && !IsDigits(cnic, 13))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "CNIC must be exactly 13 digits."));
        }
        if (!string.IsNullOrWhiteSpace(phone) && !IsDigits(phone, 11))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Phone number must be exactly 11 digits."));
        }

        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.employee_info
            SET name = COALESCE(@Name, name),
                father_name = COALESCE(@FatherName, father_name),
                cnic = COALESCE(@Cnic, cnic),
                date_of_birth = COALESCE(@DateOfBirth, date_of_birth),
                marital_status = COALESCE(@MaritalStatus, marital_status)
            WHERE employee_id = @EmployeeId
            RETURNING *
            """, new
        {
            EmployeeId = employeeId,
            Name = Text(body, "name"),
            FatherName = Text(body, "father_name"),
            Cnic = cnic,
            DateOfBirth = Text(body, "date_of_birth") ?? Text(body, "dob"),
            MaritalStatus = Text(body, "marital_status")
        });
        if (row is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Employee not found."));

        await connection.ExecuteAsync("""
            UPDATE public.users
            SET email = COALESCE(@Email, email)
            WHERE employee_id = @EmployeeId
            """, new { EmployeeId = employeeId, Email = Text(body, "email") });

        await connection.ExecuteAsync("""
            UPDATE public.directory_entries
            SET email = COALESCE(@Email, email),
                phone_mobile = COALESCE(@Phone, phone_mobile)
            WHERE employee_id = @EmployeeId
            """, new { EmployeeId = employeeId, Email = Text(body, "email"), Phone = phone });

        return Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPatch("{employeeId}/job")]
    public async Task<IActionResult> UpdateJob(string employeeId, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureReportingManagerColumnAsync(connection);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.job_info
            SET department_id = COALESCE(@DepartmentId, department_id),
                designation_id = COALESCE(@DesignationId, designation_id),
                employment_type_id = COALESCE(@EmploymentTypeId, employment_type_id),
                job_status_id = COALESCE(@JobStatusId, job_status_id),
                work_mode_id = COALESCE(@WorkModeId, work_mode_id),
                work_location_id = COALESCE(@WorkLocationId, work_location_id),
                shift_id = COALESCE(@ShiftId, shift_id),
                manager_emp_id = COALESCE(@ManagerEmpId, manager_emp_id),
                date_of_joining = COALESCE(CAST(@DateOfJoining AS date), date_of_joining),
                date_of_exit = COALESCE(CAST(@DateOfExit AS date), date_of_exit),
                probation_end_date = COALESCE(CAST(@ProbationEndDate AS date), probation_end_date),
                contract_end_date = COALESCE(CAST(@ContractEndDate AS date), contract_end_date)
            WHERE employee_id = @EmployeeId
            RETURNING *
            """, new
        {
            EmployeeId = employeeId,
            DepartmentId = GuidValue(body, "department_id"),
            DesignationId = GuidValue(body, "designation_id"),
            EmploymentTypeId = GuidValue(body, "employment_type_id"),
            JobStatusId = GuidValue(body, "job_status_id"),
            WorkModeId = GuidValue(body, "work_mode_id"),
            WorkLocationId = GuidValue(body, "work_location_id"),
            ShiftId = GuidValue(body, "shift_id"),
            ManagerEmpId = Text(body, "manager_emp_id"),
            DateOfJoining = Text(body, "date_of_joining"),
            DateOfExit = Text(body, "date_of_exit"),
            ProbationEndDate = Text(body, "probation_end_date"),
            ContractEndDate = Text(body, "contract_end_date")
        });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Employee job record not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpGet("reporting-managers")]
    public async Task<IActionResult> ReportingManagers(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureReportingManagerColumnAsync(connection);
        var managers = await connection.QueryAsync("""
            SELECT
              mgr.employee_id AS manager_emp_id,
              mgr.name AS manager_name,
              dep.department_name,
              COUNT(ei.employee_id)::int AS direct_reports
            FROM public.job_info ji
            JOIN public.employee_info ei ON ei.employee_id = ji.employee_id
            JOIN public.employee_info mgr ON mgr.employee_id = ji.manager_emp_id
            LEFT JOIN public.job_info mji ON mji.employee_id = mgr.employee_id
            LEFT JOIN public.departments dep ON dep.id = mji.department_id
            WHERE ji.manager_emp_id IS NOT NULL AND ji.manager_emp_id <> ''
            GROUP BY mgr.employee_id, mgr.name, dep.department_name
            ORDER BY mgr.name ASC
            """);
        var assignments = await connection.QueryAsync("""
            SELECT
              ei.employee_id,
              ei.name AS employee_name,
              dep.department_name,
              ji.manager_emp_id,
              mgr.name AS manager_name
            FROM public.employee_info ei
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            LEFT JOIN public.employee_info mgr ON mgr.employee_id = ji.manager_emp_id
            LEFT JOIN public.departments dep ON dep.id = ji.department_id
            ORDER BY ei.name ASC
            """);

        return Ok(ApiResponse<object>.Ok(new { managers, assignments }));
    }

    [HttpPatch("{employeeId}/manager")]
    public async Task<IActionResult> UpdateManager(string employeeId, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var managerEmpId = Text(body, "manager_emp_id");
        if (string.IsNullOrWhiteSpace(managerEmpId))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Reporting manager is required."));
        }
        if (string.Equals(employeeId, managerEmpId, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "An employee cannot report to themselves."));
        }

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureReportingManagerColumnAsync(connection);
        var exists = await connection.QuerySingleAsync<int>("SELECT COUNT(*)::int FROM public.employee_info WHERE employee_id = @EmployeeId", new { EmployeeId = employeeId });
        if (exists == 0) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Employee not found."));

        exists = await connection.QuerySingleAsync<int>("SELECT COUNT(*)::int FROM public.employee_info WHERE employee_id = @ManagerEmpId", new { ManagerEmpId = managerEmpId });
        if (exists == 0) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Reporting manager not found."));

        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.job_info
            SET manager_emp_id = @ManagerEmpId
            WHERE employee_id = @EmployeeId
            RETURNING employee_id, manager_emp_id
            """, new { EmployeeId = employeeId, ManagerEmpId = managerEmpId });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Employee job record not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPatch("{employeeId}/extra")]
    public async Task<IActionResult> UpdateExtra(string employeeId, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            await UpsertEmergency(connection, tx, employeeId, Section(body, "emergencyContacts"), null, null);
            await UpsertBank(connection, tx, employeeId, Section(body, "bankInfo"));
            await UpsertMedical(connection, tx, employeeId, Section(body, "medicalInfo"), null);
            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { updated = true }));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPost("{employeeId}/resend-credentials")]
    public IActionResult ResendCredentials(string employeeId)
        => Ok(ApiResponse<object>.Ok(new { employee_id = employeeId, message = "Credentials action recorded. Email delivery can be connected later." }));

    private static async Task UpsertEmergency(System.Data.IDbConnection connection, System.Data.IDbTransaction tx, string employeeId, JsonElement? emergency, string? fallbackPhone, string? fallbackEmail)
    {
        if (emergency is null) return;
        await connection.ExecuteAsync("""
            INSERT INTO public.emergency_contacts (employee_id, contact_1, contact_2, perment_address, postal_address, e_contact_1_relation, e_contact_1_full_name, e_contact_1_phone, e_contact_1_phone_country_code, e_contact_1_email, e_contact_2_relation, e_contact_2_full_name, e_contact_2_phone, e_contact_2_phone_country_code, e_contact_2_email, primary_contact)
            VALUES (@EmployeeId, @Contact1, @Contact2, @PermanentAddress, @PostalAddress, CAST(@Relation1 AS emergency_relation), @Name1, @Phone1, @Code1, @Email1, CAST(@Relation2 AS emergency_relation), @Name2, @Phone2, @Code2, @Email2, @PrimaryContact)
            ON CONFLICT (employee_id) DO UPDATE SET
              contact_1 = EXCLUDED.contact_1,
              contact_2 = EXCLUDED.contact_2,
              perment_address = EXCLUDED.perment_address,
              postal_address = EXCLUDED.postal_address,
              e_contact_1_relation = EXCLUDED.e_contact_1_relation,
              e_contact_1_full_name = EXCLUDED.e_contact_1_full_name,
              e_contact_1_phone = EXCLUDED.e_contact_1_phone,
              e_contact_1_phone_country_code = EXCLUDED.e_contact_1_phone_country_code,
              e_contact_1_email = EXCLUDED.e_contact_1_email
            """, new
        {
            EmployeeId = employeeId,
            Contact1 = Text(emergency, "contact_1") ?? fallbackPhone,
            Contact2 = Text(emergency, "contact_2"),
            PermanentAddress = Text(emergency, "perment_address"),
            PostalAddress = Text(emergency, "postal_address"),
            Relation1 = Text(emergency, "e_contact_1_relation") ?? "other",
            Name1 = Text(emergency, "e_contact_1_full_name") ?? "Emergency Contact",
            Phone1 = Text(emergency, "e_contact_1_phone") ?? fallbackPhone,
            Code1 = Text(emergency, "e_contact_1_phone_country_code") ?? "+92",
            Email1 = Text(emergency, "e_contact_1_email") ?? fallbackEmail,
            Relation2 = Text(emergency, "e_contact_2_relation"),
            Name2 = Text(emergency, "e_contact_2_full_name"),
            Phone2 = Text(emergency, "e_contact_2_phone"),
            Code2 = Text(emergency, "e_contact_2_phone_country_code"),
            Email2 = Text(emergency, "e_contact_2_email"),
            PrimaryContact = IntValue(emergency, "primary_contact") ?? 1
        }, tx);
    }

    private static async Task UpsertBank(System.Data.IDbConnection connection, System.Data.IDbTransaction tx, string employeeId, JsonElement? bank)
    {
        if (bank is null || string.IsNullOrWhiteSpace(Text(bank, "bank_name"))) return;
        await connection.ExecuteAsync("""
            INSERT INTO public.employee_bank_accounts (employee_id, bank_name, branch_name, branch_code, iban, account_title, account_number, account_type)
            VALUES (@EmployeeId, @BankName, @BranchName, @BranchCode, @Iban, @AccountTitle, @AccountNumber, CAST(@AccountType AS bank_account_type))
            ON CONFLICT (employee_id) DO UPDATE SET
              bank_name = EXCLUDED.bank_name,
              branch_name = EXCLUDED.branch_name,
              branch_code = EXCLUDED.branch_code,
              iban = EXCLUDED.iban,
              account_title = EXCLUDED.account_title,
              account_number = EXCLUDED.account_number,
              account_type = EXCLUDED.account_type
            """, new
        {
            EmployeeId = employeeId,
            BankName = Text(bank, "bank_name"),
            BranchName = Text(bank, "branch_name"),
            BranchCode = Text(bank, "branch_code"),
            Iban = Text(bank, "iban") ?? Text(bank, "account_number"),
            AccountTitle = Text(bank, "account_title"),
            AccountNumber = Text(bank, "account_number"),
            AccountType = Text(bank, "account_type")
        }, tx);
    }

    private static async Task UpsertMedical(System.Data.IDbConnection connection, System.Data.IDbTransaction tx, string employeeId, JsonElement? medical, string? dob)
    {
        if (medical is null) return;
        await connection.ExecuteAsync("""
            INSERT INTO public.employee_medical (employee_id, blood_group, date_of_birth, gender)
            VALUES (@EmployeeId, CAST(@BloodGroup AS blood_group_type), CAST(@DateOfBirth AS date), CAST(@Gender AS gender_type))
            ON CONFLICT (employee_id) DO UPDATE SET
              blood_group = EXCLUDED.blood_group,
              date_of_birth = EXCLUDED.date_of_birth,
              gender = EXCLUDED.gender
            """, new { EmployeeId = employeeId, BloodGroup = Text(medical, "blood_group"), DateOfBirth = Text(medical, "date_of_birth") ?? dob, Gender = Text(medical, "gender") }, tx);
    }

    private static async Task InsertSalary(System.Data.IDbConnection connection, System.Data.IDbTransaction tx, string employeeId, JsonElement? salary, Guid userId)
    {
        if (salary is null) return;
        await connection.ExecuteAsync("""
            INSERT INTO public.employee_salary (id, employee_id, basic_salary, currency, effective_from, is_current, is_active, revision_type, payroll_cycle, tax_status, allowance_notes, probation_salary, created_by)
            VALUES (gen_random_uuid(), @EmployeeId, @BasicSalary, 'PKR', COALESCE(@EffectiveFrom::date, CURRENT_DATE), true, true, 'Initial', @PayrollCycle, @TaxStatus, @AllowanceNotes, @ProbationSalary, @UserId)
            """, new
        {
            EmployeeId = employeeId,
            BasicSalary = DecimalValue(salary, "base_salary") ?? 0,
            EffectiveFrom = Text(salary, "salary_effective_from"),
            PayrollCycle = Text(salary, "payroll_cycle"),
            TaxStatus = Text(salary, "tax_status"),
            AllowanceNotes = Text(salary, "allowance_notes"),
            ProbationSalary = DecimalValue(salary, "probation_salary"),
            UserId = userId
        }, tx);
    }

    private static async Task InsertDocuments(System.Data.IDbConnection connection, System.Data.IDbTransaction tx, string employeeId, JsonElement? docs, Guid userId)
    {
        if (docs is null) return;
        foreach (var (type, key) in new[] { ("cnic", "cnic_document"), ("resume", "resume_document"), ("offer_letter", "offer_letter_document") })
        {
            var file = Text(docs, key);
            if (string.IsNullOrWhiteSpace(file)) continue;
            await connection.ExecuteAsync("INSERT INTO public.employee_documents (employee_id, document_type, file_name, file_status, created_by) VALUES (@EmployeeId, @Type, @File, 'received', @UserId)", new { EmployeeId = employeeId, Type = type, File = file, UserId = userId }, tx);
        }
    }

    private static string NextEmployeeCode(string? maxEmployeeId)
    {
        var numberText = (maxEmployeeId ?? "EMP000").Replace("EMP", "", StringComparison.OrdinalIgnoreCase);
        var number = int.TryParse(numberText, out var parsed) ? parsed : 0;
        return $"EMP{(number + 1).ToString().PadLeft(3, '0')}";
    }

    private static JsonElement? Section(JsonElement root, string name)
        => root.ValueKind == JsonValueKind.Object && root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Object ? value : null;

    private static string? Text(JsonElement? section, string name)
    {
        if (section is null || section.Value.ValueKind != JsonValueKind.Object || !section.Value.TryGetProperty(name, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString()!.Trim(),
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null
        };
    }

    private static Guid? GuidValue(JsonElement? section, string name) => Guid.TryParse(Text(section, name), out var value) ? value : null;
    private static int? IntValue(JsonElement? section, string name) => int.TryParse(Text(section, name), out var value) ? value : null;
    private static decimal? DecimalValue(JsonElement? section, string name) => decimal.TryParse(Text(section, name), out var value) ? value : null;
    private static bool IsDigits(string value, int length) => Regex.IsMatch(value, $"^[0-9]{{{length}}}$");
    private static bool IsLettersAndSpaces(string value) => Regex.IsMatch(value.Trim(), "^[A-Za-z ]+$");
    private static bool IsAlphaNumeric(string value, int min, int max) => Regex.IsMatch(value.Trim(), $"^[A-Za-z0-9]{{{min},{max}}}$");

    private static async Task EnsureReportingManagerColumnAsync(System.Data.IDbConnection connection)
    {
        await connection.ExecuteAsync("ALTER TABLE public.job_info ADD COLUMN IF NOT EXISTS manager_emp_id text");
    }

    private static async Task EnsureEmployeeProfileColumnsAsync(System.Data.IDbConnection connection)
    {
        await connection.ExecuteAsync("ALTER TABLE public.employee_info ADD COLUMN IF NOT EXISTS marital_status text");
    }
}
