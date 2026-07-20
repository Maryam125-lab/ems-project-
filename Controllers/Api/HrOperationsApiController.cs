using System.Text.Json;
using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers.Api;

[ApiController]
[Authorize]
public sealed class HrOperationsApiController : ControllerBase
{
    private readonly Db _db;

    public HrOperationsApiController(Db db)
    {
        _db = db;
    }

    [HttpGet("api/attendance")]
    public async Task<IActionResult> Attendance([FromQuery] DateOnly? date, [FromQuery(Name = "location_id")] Guid? locationId, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT a.*, ei.name, ji.work_location_id, s.name AS shift_name
            FROM public.attendance a
            LEFT JOIN public.employee_info ei ON ei.employee_id = a.employee_id
            LEFT JOIN public.job_info ji ON ji.employee_id = a.employee_id
            LEFT JOIN public.shifts s ON s.id = a.shift_id
            WHERE (@Date IS NULL OR a.date = CAST(@Date AS date))
              AND (@LocationId IS NULL OR ji.work_location_id = @LocationId)
            ORDER BY ei.employee_id ASC, a.date DESC
            LIMIT 300
            """, new { Date = date?.ToString("yyyy-MM-dd"), LocationId = locationId });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPut("api/attendance/save")]
    public async Task<IActionResult> SaveAttendance([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        var date = Text(body, "date") ?? DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd");
        var rows = body.TryGetProperty("rows", out var array) && array.ValueKind == JsonValueKind.Array ? array.EnumerateArray().ToList() : [];
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var saved = 0;
        foreach (var row in rows)
        {
            var employeeId = Text(row, "employee_id");
            if (string.IsNullOrWhiteSpace(employeeId)) continue;
            await connection.ExecuteAsync("""
                INSERT INTO public.attendance (employee_id, date, status, notes, marked_by)
                VALUES (@EmployeeId, CAST(@Date AS date), @Status, @Notes, @UserId)
                ON CONFLICT DO NOTHING
                """, new { EmployeeId = employeeId, Date = date, Status = Text(row, "status") ?? "present", Notes = Text(row, "notes"), current.UserId });
            saved++;
        }
        return Ok(ApiResponse<object>.Ok(new { saved, date }));
    }

    [HttpPost("api/attendance/submit")]
    public IActionResult SubmitAttendance([FromBody] JsonElement body) => Ok(ApiResponse<object>.Ok(new { submitted = true, date = Text(body, "date") }));

    [HttpPatch("api/attendance/{id:guid}/ack")]
    public async Task<IActionResult> AckAttendance(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("UPDATE public.attendance SET ack = true WHERE id = @Id RETURNING *", new { Id = id });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Attendance row not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/attendance/report")]
    public async Task<IActionResult> AttendanceReport([FromQuery] int? month, [FromQuery] int? year, CancellationToken cancellationToken)
    {
        var now = DateTime.Today;
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT a.employee_id, ei.name,
                   COUNT(*) FILTER (WHERE a.status = 'present')::int AS present,
                   COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent,
                   COUNT(*) FILTER (WHERE a.status = 'late')::int AS late,
                   COUNT(*) FILTER (WHERE a.status = 'half_day')::int AS half_day
            FROM public.attendance a
            LEFT JOIN public.employee_info ei ON ei.employee_id = a.employee_id
            WHERE EXTRACT(MONTH FROM a.date) = @Month AND EXTRACT(YEAR FROM a.date) = @Year
            GROUP BY a.employee_id, ei.name
            ORDER BY ei.name ASC
            """, new { Month = month ?? now.Month, Year = year ?? now.Year });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/attendance/employee/{employeeId}")]
    public async Task<IActionResult> EmployeeAttendance(string employeeId, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.attendance WHERE employee_id = @EmployeeId ORDER BY date DESC LIMIT 100", new { EmployeeId = employeeId });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/attendance/unlock-request")]
    public IActionResult RequestUnlock([FromBody] JsonElement body) => Ok(ApiResponse<object>.Ok(new { requested = true, date = Text(body, "date"), reason = Text(body, "reason") }));

    [HttpPost("api/attendance/unlock-approve")]
    public IActionResult ApproveUnlock([FromBody] JsonElement body) => Ok(ApiResponse<object>.Ok(new { approved = true, date = Text(body, "date") }));

    [HttpGet("api/leave-requests")]
    public async Task<IActionResult> LeaveRequests([FromQuery] string? status, [FromQuery(Name = "employee_id")] string? employeeId, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT lr.*, ei.name AS employee_name, lt.name AS leave_type
            FROM public.leave_requests lr
            LEFT JOIN public.employee_info ei ON ei.employee_id = lr.employee_id
            LEFT JOIN public.leave_types lt ON lt.id = lr.leave_type_id
            WHERE (@Status IS NULL OR lr.status = @Status)
              AND (@EmployeeId IS NULL OR lr.employee_id = @EmployeeId)
            ORDER BY lr.created_at DESC
            LIMIT 200
            """, new { Status = status, EmployeeId = employeeId });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/leave-requests/mine")]
    public async Task<IActionResult> MyLeaveRequests(CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.leave_requests WHERE employee_id = @EmployeeId ORDER BY created_at DESC", new { current?.EmployeeId });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/leave-requests")]
    public async Task<IActionResult> SubmitLeave([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));

        var startDateStr = Text(body, "start_date");
        var endDateStr = Text(body, "end_date");
        if (string.IsNullOrWhiteSpace(startDateStr) || string.IsNullOrWhiteSpace(endDateStr))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Start date and end date are required."));
        }
        if (!DateOnly.TryParse(startDateStr, out var startDate) || !DateOnly.TryParse(endDateStr, out var endDate))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Invalid date format."));
        }
        if (endDate < startDate)
        {
            return Conflict(ApiResponse<object>.Fail("INVALID_DATE_RANGE", "End date must be after start date."));
        }

        var requestedDays = DaysBetweenInclusive(startDate, endDate);
        var year = startDate.Year;

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        
        // Leave balance check
        var balanceRow = await connection.QuerySingleOrDefaultAsync("""
            SELECT balance, used
            FROM public.leave_balances
            WHERE employee_id = @EmployeeId
              AND leave_type_id = @LeaveTypeId
              AND year = @Year
            LIMIT 1
            """, new { EmployeeId = current.EmployeeId, LeaveTypeId = GuidValue(body, "leave_type_id"), Year = year });

        if (balanceRow is null)
        {
            return Conflict(ApiResponse<object>.Fail("INSUFFICIENT_BALANCE", "No leave balance configured."));
        }
        int balance = Convert.ToInt32(balanceRow.balance);
        int used = Convert.ToInt32(balanceRow.used);
        int remaining = balance - used;
        if (remaining < requestedDays)
        {
            return Conflict(ApiResponse<object>.Fail("INSUFFICIENT_BALANCE", "Insufficient leave balance."));
        }

        // Leave capacity check
        var departmentId = await connection.ExecuteScalarAsync<Guid?>("""
            SELECT department_id FROM public.job_info WHERE employee_id = @EmployeeId LIMIT 1
            """, new { EmployeeId = current.EmployeeId });

        var maxPercent = 50;
        if (departmentId.HasValue)
        {
            var configVal = await connection.ExecuteScalarAsync<int?>("""
                SELECT max_percent
                FROM public.leave_capacity_config
                WHERE department_id = @DepartmentId
                  AND is_active = true
                LIMIT 1
                """, new { DepartmentId = departmentId.Value });
            if (configVal.HasValue) maxPercent = configVal.Value;
        }

        var headcount = 0;
        if (departmentId.HasValue)
        {
            headcount = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*)::int FROM public.job_info WHERE department_id = @DepartmentId", new { DepartmentId = departmentId.Value });
        }

        var exceededDates = new List<object>();
        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            var dateStr = date.ToString("yyyy-MM-dd");
            var onLeaveCount = await connection.ExecuteScalarAsync<int>("""
                SELECT COUNT(*)::int
                FROM public.leave_requests lr
                JOIN public.job_info ji ON ji.employee_id = lr.employee_id
                WHERE ji.department_id = @DepartmentId
                  AND lr.status = 'approved'
                  AND CAST(@Date AS date) BETWEEN lr.start_date AND COALESCE(lr.end_by_force, lr.end_date)
                """, new { DepartmentId = departmentId, Date = dateStr });

            var percent = headcount > 0 ? ((decimal)onLeaveCount / headcount) * 100 : 0;
            if (percent >= maxPercent)
            {
                exceededDates.Add(new { date = dateStr, on_leave_count = onLeaveCount, capacity_limit = maxPercent });
            }
        }

        if (exceededDates.Count > 0)
        {
            return StatusCode(409, ApiResponse<object>.Fail("CAPACITY_EXCEEDED", "Department leave capacity exceeded."));
        }

        var employeeName = await connection.ExecuteScalarAsync<string>("SELECT name FROM public.employee_info WHERE employee_id = @EmployeeId LIMIT 1", new { EmployeeId = current.EmployeeId }) ?? current.EmployeeId;

        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var row = await connection.QuerySingleAsync("""
                INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, reason, status, created_by)
                VALUES (@EmployeeId, @LeaveTypeId, CAST(@StartDate AS date), CAST(@EndDate AS date), @Reason, 'pending', @UserId)
                RETURNING *
                """, new { current.EmployeeId, LeaveTypeId = GuidValue(body, "leave_type_id"), StartDate = startDateStr, EndDate = endDateStr, Reason = Text(body, "reason"), current.UserId }, tx);

            await CreateDbNotification(connection, null, "hr", "leave_request", $"Leave request from {employeeName} for {startDateStr} to {endDateStr}.", current.UserId, tx);
            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("api/leave-requests/{id:guid}/approve")]
    public Task<IActionResult> ApproveLeave(Guid id, CancellationToken cancellationToken) => UpdateLeave(id, "approved", null, cancellationToken);

    [HttpPatch("api/leave-requests/{id:guid}/reject")]
    public async Task<IActionResult> RejectLeave(Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken) => await UpdateLeave(id, "rejected", Text(body, "reason"), cancellationToken);

    [HttpPatch("api/leave-requests/{id:guid}/early-return")]
    public async Task<IActionResult> EarlyReturn(Guid id, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var leave = await connection.QuerySingleOrDefaultAsync("""
                SELECT * FROM public.leave_requests WHERE id = @Id LIMIT 1
                """, new { Id = id }, tx);

            if (leave is null)
            {
                return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Leave request not found."));
            }

            if (leave.status != "approved")
            {
                return Conflict(ApiResponse<object>.Fail("INVALID_STATE", "Only approved leave can be force-ended."));
            }

            var today = DateOnly.FromDateTime(DateTime.Today);
            DateOnly startDate = DateOnly.FromDateTime(leave.start_date);
            DateOnly endDate = DateOnly.FromDateTime(leave.end_date);

            var originalDays = DaysBetweenInclusive(startDate, endDate);
            var daysTaken = Math.Max(DaysBetweenInclusive(startDate, today), 0);
            if (today < startDate)
            {
                daysTaken = 0;
            }
            if (today > endDate)
            {
                daysTaken = originalDays;
            }

            var daysRestored = Math.Max(originalDays - daysTaken, 0);

            var updatedLeave = await connection.QuerySingleOrDefaultAsync("""
                UPDATE public.leave_requests
                SET end_by_force = CURRENT_DATE,
                    updated_at = now()
                WHERE id = @Id
                RETURNING *
                """, new { Id = id }, tx);

            var year = startDate.Year;
            await connection.ExecuteAsync("""
                UPDATE public.leave_balances
                SET used = GREATEST(used - @DaysRestored, 0),
                    updated_at = now()
                WHERE employee_id = @EmployeeId
                  AND leave_type_id = @LeaveTypeId
                  AND year = @Year
                """, new { EmployeeId = leave.employee_id, LeaveTypeId = leave.leave_type_id, Year = year, DaysRestored = daysRestored }, tx);

            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(updatedLeave));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpGet("api/leave-requests/balances")]
    public async Task<IActionResult> LeaveBalances(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT lb.*, ei.name AS employee_name, lt.name AS leave_type
            FROM public.leave_balances lb
            LEFT JOIN public.employee_info ei ON ei.employee_id = lb.employee_id
            LEFT JOIN public.leave_types lt ON lt.id = lb.leave_type_id
            ORDER BY ei.name ASC
            LIMIT 300
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/leave-requests/balances/mine")]
    public async Task<IActionResult> MyLeaveBalances(CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT lb.*, lt.name FROM public.leave_balances lb LEFT JOIN public.leave_types lt ON lt.id = lb.leave_type_id WHERE lb.employee_id = @EmployeeId", new { current?.EmployeeId });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/leave-requests/calendar")]
    public async Task<IActionResult> LeaveCalendar(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT lr.*, ei.name AS employee_name FROM public.leave_requests lr LEFT JOIN public.employee_info ei ON ei.employee_id = lr.employee_id WHERE lr.status = 'approved' ORDER BY lr.start_date DESC LIMIT 200");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/penalty-rules")]
    public async Task<IActionResult> PenaltyRules(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.penalty_rules ORDER BY created_at DESC");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/penalty-rules")]
    public async Task<IActionResult> CreatePenaltyRule([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("INSERT INTO public.penalty_rules (name, amount_pkr, type, created_by) VALUES (@Name, @Amount, @Type, @UserId) RETURNING *", new { Name = Text(body, "name"), Amount = DecimalValue(body, "amount_pkr") ?? 0, Type = Text(body, "type") ?? "flat", current?.UserId });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("api/penalty-rules/{id:guid}")]
    public async Task<IActionResult> UpdatePenaltyRule(Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("UPDATE public.penalty_rules SET name = COALESCE(@Name, name), amount_pkr = COALESCE(@Amount, amount_pkr), type = COALESCE(@Type, type), is_active = COALESCE(@IsActive, is_active) WHERE id = @Id RETURNING *", new { Id = id, Name = Text(body, "name"), Amount = DecimalValue(body, "amount_pkr"), Type = Text(body, "type"), IsActive = Bool(body, "is_active") });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Penalty rule not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/penalties")]
    public async Task<IActionResult> Penalties(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT ep.*, ei.name AS employee_name, pr.name AS rule_name, pr.amount_pkr
            FROM public.employee_penalties ep
            LEFT JOIN public.employee_info ei ON ei.employee_id = ep.employee_id
            LEFT JOIN public.penalty_rules pr ON pr.id = ep.rule_id
            ORDER BY ep.created_at DESC
            LIMIT 200
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/penalties/mine")]
    public async Task<IActionResult> MyPenalties(CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.employee_penalties WHERE employee_id = @EmployeeId ORDER BY created_at DESC", new { current?.EmployeeId });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/penalties")]
    public async Task<IActionResult> ProposePenalty([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        var employeeId = Text(body, "employee_id");
        var ruleId = GuidValue(body, "rule_id");
        var date = Text(body, "date");
        var reason = Text(body, "reason");

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var ruleName = await connection.ExecuteScalarAsync<string>("SELECT name FROM public.penalty_rules WHERE id = @RuleId LIMIT 1", new { RuleId = ruleId }, tx) ?? "Unknown Rule";
            var employeeName = await connection.ExecuteScalarAsync<string>("SELECT name FROM public.employee_info WHERE employee_id = @EmployeeId LIMIT 1", new { EmployeeId = employeeId }, tx) ?? employeeId;

            var row = await connection.QuerySingleAsync("""
                INSERT INTO public.employee_penalties (employee_id, rule_id, date, reason, status, proposed_by)
                VALUES (@EmployeeId, @RuleId, CAST(@Date AS date), @Reason, 'pending', @UserId)
                RETURNING *
                """, new { EmployeeId = employeeId, RuleId = ruleId, Date = date, Reason = reason, current?.UserId }, tx);

            var message = $"New penalty proposed for {employeeName} by Branch HR. Rule: {ruleName}. Awaiting review.";
            await connection.ExecuteAsync("""
                INSERT INTO public.notifications (user_id, role, type, message, created_by)
                VALUES
                (NULL, 'super_admin', 'penalty_proposed', @Message, @UserId),
                (NULL, 'hr', 'penalty_proposed', @Message, @UserId)
                """, new { Message = message, UserId = current?.UserId }, tx);

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("api/penalties/{id:guid}/approve")]
    public Task<IActionResult> ApprovePenalty(Guid id, CancellationToken cancellationToken) => UpdatePenalty(id, "approved", cancellationToken);

    [HttpPatch("api/penalties/{id:guid}/reject")]
    public Task<IActionResult> RejectPenalty(Guid id, CancellationToken cancellationToken) => UpdatePenalty(id, "rejected", cancellationToken);

    [HttpPatch("api/penalties/{id:guid}/ack")]
    public async Task<IActionResult> AckPenalty(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("UPDATE public.employee_penalties SET employee_ack = true, employee_acked_at = now() WHERE id = @Id RETURNING *", new { Id = id });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Penalty not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/promotions")]
    public async Task<IActionResult> Promotions(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT p.*, ei.name AS employee_name FROM public.promotions p LEFT JOIN public.employee_info ei ON ei.employee_id = p.employee_id ORDER BY p.created_at DESC LIMIT 200");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/promotions")]
    public async Task<IActionResult> CreatePromotion([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.promotions (employee_id, old_designation_id, new_designation_id, effective_date, reason, status)
            VALUES (@EmployeeId, @OldDesignationId, @NewDesignationId, CAST(@EffectiveDate AS date), @Reason, 'pending')
            RETURNING *
            """, new { EmployeeId = Text(body, "employee_id"), OldDesignationId = GuidValue(body, "old_designation_id"), NewDesignationId = GuidValue(body, "new_designation_id"), EffectiveDate = Text(body, "effective_date"), Reason = Text(body, "reason") });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("api/promotions/{id:guid}")]
    public IActionResult UpdatePromotion(Guid id) => Ok(ApiResponse<object>.Ok(new { id, updated = true }));

    [HttpPatch("api/promotions/{id:guid}/approve")]
    public Task<IActionResult> ApprovePromotion(Guid id, CancellationToken cancellationToken) => UpdatePromotionStatus(id, "approved", cancellationToken);

    [HttpPatch("api/promotions/{id:guid}/reject")]
    public Task<IActionResult> RejectPromotion(Guid id, CancellationToken cancellationToken) => UpdatePromotionStatus(id, "rejected", cancellationToken);

    [HttpGet("api/payroll")]
    public async Task<IActionResult> Payroll([FromQuery] int? month, [FromQuery] int? year, CancellationToken cancellationToken)
    {
        var now = DateTime.Today;
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT pr.*, ei.name AS employee_name, dep.department_name
            FROM public.payroll_records pr
            LEFT JOIN public.employee_info ei ON ei.employee_id = pr.employee_id
            LEFT JOIN public.job_info ji ON ji.employee_id = pr.employee_id
            LEFT JOIN public.departments dep ON dep.id = ji.department_id
            WHERE pr.month = @Month AND pr.year = @Year
            ORDER BY ei.name ASC
            """, new { Month = month ?? now.Month, Year = year ?? now.Year });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/payroll/mine")]
    public async Task<IActionResult> MyPayroll(CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.payroll_records WHERE employee_id = @EmployeeId ORDER BY year DESC, month DESC", new { current?.EmployeeId });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/payroll/generate")]
    public async Task<IActionResult> GeneratePayroll([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var month = IntValue(body, "month") ?? DateTime.Today.Month;
        var year = IntValue(body, "year") ?? DateTime.Today.Year;
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            await connection.ExecuteAsync("""
                DELETE FROM public.payroll_records
                WHERE month = @Month AND year = @Year AND status = 'pending'
                """, new { Month = month, Year = year }, tx);

            var employees = (await connection.QueryAsync<(string EmployeeId, decimal BasicSalary)>("""
                SELECT employee_id AS EmployeeId, basic_salary AS BasicSalary
                FROM public.employee_salary
                WHERE is_current = true
                """, transaction: tx)).ToList();

            var count = 0;
            foreach (var emp in employees)
            {
                var penaltyTotal = await connection.ExecuteScalarAsync<decimal?>("""
                    SELECT SUM(pr.amount_pkr)
                    FROM public.employee_penalties ep
                    JOIN public.penalty_rules pr ON ep.rule_id = pr.id
                    WHERE ep.employee_id = @EmployeeId
                      AND ep.status = 'approved'
                      AND EXTRACT(MONTH FROM ep.date) = @Month
                      AND EXTRACT(YEAR FROM ep.date) = @Year
                    """, new { EmployeeId = emp.EmployeeId, Month = month, Year = year }, tx) ?? 0;

                var basic = emp.BasicSalary;
                var allowances = 0m;
                var deductions = penaltyTotal;
                var netSalary = basic + allowances - deductions;

                await connection.ExecuteAsync("""
                    INSERT INTO public.payroll_records (employee_id, month, year, basic_salary, allowances, deductions, net_salary, status)
                    VALUES (@EmployeeId, @Month, @Year, @Basic, @Allowances, @Deductions, @NetSalary, 'pending')
                    """, new
                {
                    EmployeeId = emp.EmployeeId,
                    Month = month,
                    Year = year,
                    Basic = basic,
                    Allowances = allowances,
                    Deductions = deductions,
                    NetSalary = netSalary
                }, tx);

                count++;
            }

            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(new { count, month, year }));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("api/payroll/{id:guid}/process")]
    public async Task<IActionResult> ProcessPayroll(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync("UPDATE public.payroll_records SET status = 'processed', processed_at = now() WHERE id = @Id", new { Id = id });
        return Ok(ApiResponse<object>.Ok(new { message = "Payroll processed successfully" }));
    }

    [HttpGet("api/payroll/summary")]
    public async Task<IActionResult> PayrollSummary([FromQuery] int? month, [FromQuery] int? year, CancellationToken cancellationToken)
    {
        var now = DateTime.Today;
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("SELECT COUNT(*)::int AS total_employees, COALESCE(SUM(net_salary), 0)::numeric AS total_amount, COUNT(*) FILTER (WHERE status = 'processed')::int AS processed_count FROM public.payroll_records WHERE month = @Month AND year = @Year", new { Month = month ?? now.Month, Year = year ?? now.Year });
        return Ok(ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/payroll/{id:guid}/payslip")]
    public async Task<IActionResult> Payslip(Guid id, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        var roleName = (User.FindFirst("role_name")?.Value ?? string.Empty).Trim().ToLowerInvariant();
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("SELECT pr.*, ei.name AS employee_name FROM public.payroll_records pr LEFT JOIN public.employee_info ei ON ei.employee_id = pr.employee_id WHERE pr.id = @Id", new { Id = id });
        if (row is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Payslip not found."));
        if (roleName == "employee" && !string.Equals((string?)row.employee_id, current?.EmployeeId, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }
        return Ok(ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/calendar-events")]
    public async Task<IActionResult> CalendarEvents(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.calendar_events ORDER BY date DESC, created_at DESC LIMIT 200");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/calendar-events")]
    public async Task<IActionResult> CreateCalendarEvent([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.calendar_events (title, date, type, visibility)
            VALUES (@Title, CAST(@StartDate AS date), @Type, @Visibility)
            RETURNING *
            """, new { Title = Text(body, "title"), StartDate = Text(body, "date") ?? Text(body, "start_date"), Type = Text(body, "type") ?? "general", Visibility = Text(body, "visibility") ?? "all" });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("api/calendar-events/{id:guid}")]
    public IActionResult UpdateCalendarEvent(Guid id) => Ok(ApiResponse<object>.Ok(new { id, updated = true }));

    [HttpGet("api/audit-logs")]
    public async Task<IActionResult> AuditLogs(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 200");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    private static int DaysBetweenInclusive(DateOnly start, DateOnly end)
    {
        return (end.ToDateTime(TimeOnly.MinValue) - start.ToDateTime(TimeOnly.MinValue)).Days + 1;
    }

    private static async Task CreateDbNotification(System.Data.IDbConnection connection, Guid? targetUserId, string? targetRole, string type, string message, Guid? createdBy, System.Data.IDbTransaction? transaction = null)
    {
        await connection.ExecuteAsync("""
            INSERT INTO public.notifications (user_id, role, type, message, created_by)
            VALUES (@TargetUserId, @TargetRole, @Type, @Message, @CreatedBy)
            """, new { TargetUserId = targetUserId, TargetRole = targetRole, Type = type, Message = message, CreatedBy = createdBy }, transaction);
    }

    private async Task<IActionResult> UpdateLeave(Guid id, string status, string? reason, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var leave = await connection.QuerySingleOrDefaultAsync("""
                SELECT * FROM public.leave_requests WHERE id = @Id LIMIT 1
                """, new { Id = id }, tx);

            if (leave is null)
            {
                return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Leave request not found."));
            }

            var updatedLeave = await connection.QuerySingleOrDefaultAsync("""
                UPDATE public.leave_requests
                SET status = @Status,
                    reviewed_by = @UserId,
                    reviewed_at = now(),
                    review_note = COALESCE(@Reason, review_note),
                    updated_at = now()
                WHERE id = @Id
                RETURNING *
                """, new { Id = id, Status = status, current.UserId, Reason = reason }, tx);

            if (status == "approved")
            {
                DateOnly startDate = DateOnly.FromDateTime(leave.start_date);
                DateOnly endDate = DateOnly.FromDateTime(leave.end_date);
                int days = DaysBetweenInclusive(startDate, endDate);
                int year = startDate.Year;

                await connection.ExecuteAsync("""
                    UPDATE public.leave_balances
                    SET used = used + @Days,
                        updated_at = now()
                    WHERE employee_id = @EmployeeId
                      AND leave_type_id = @LeaveTypeId
                      AND year = @Year
                    """, new { EmployeeId = leave.employee_id, LeaveTypeId = leave.leave_type_id, Year = year, Days = days }, tx);

                var message = $"Your leave request ({startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}) has been approved.";
                await connection.ExecuteAsync("""
                    INSERT INTO public.notifications (user_id, role, type, message, created_by)
                    SELECT u.id, NULL, 'leave_approved', @Message, @UserId
                    FROM public.users u
                    WHERE u.employee_id = @EmployeeId
                    """, new { EmployeeId = leave.employee_id, Message = message, UserId = current.UserId }, tx);
            }
            else if (status == "rejected")
            {
                DateOnly startDate = DateOnly.FromDateTime(leave.start_date);
                DateOnly endDate = DateOnly.FromDateTime(leave.end_date);
                var message = $"Your leave request ({startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}) has been rejected.";
                await connection.ExecuteAsync("""
                    INSERT INTO public.notifications (user_id, role, type, message, created_by)
                    SELECT u.id, NULL, 'leave_rejected', @Message, @UserId
                    FROM public.users u
                    WHERE u.employee_id = @EmployeeId
                    """, new { EmployeeId = leave.employee_id, Message = message, UserId = current.UserId }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(updatedLeave));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<IActionResult> UpdatePenalty(Guid id, string status, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var row = await connection.QuerySingleOrDefaultAsync("""
                UPDATE public.employee_penalties
                SET status = @Status,
                    reviewed_by = @UserId,
                    reviewed_at = now(),
                    updated_at = now()
                WHERE id = @Id
                RETURNING *
                """, new { Id = id, Status = status, current.UserId }, tx);

            if (row is null)
            {
                return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Penalty not found."));
            }

            if (status == "approved")
            {
                await connection.ExecuteAsync("""
                    INSERT INTO public.notifications (user_id, role, type, message, created_by)
                    SELECT u.id, NULL, 'penalty_approved', @Message, @UserId
                    FROM public.users u
                    WHERE u.employee_id = @EmployeeId
                    """, new { EmployeeId = row.employee_id, Message = "Your penalty has been approved.", UserId = current.UserId }, tx);
            }
            else if (status == "rejected" && row.proposed_by != null)
            {
                await connection.ExecuteAsync("""
                    INSERT INTO public.notifications (user_id, role, type, message, created_by)
                    VALUES (@ProposedBy, NULL, 'penalty_rejected', @Message, @UserId)
                    """, new { ProposedBy = row.proposed_by, Message = "A proposed penalty was rejected.", UserId = current.UserId }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<IActionResult> UpdatePromotionStatus(Guid id, string status, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("UPDATE public.promotions SET status = @Status WHERE id = @Id RETURNING *", new { Id = id, Status = status });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Promotion not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    private static string? Text(JsonElement body, string name)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(name, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString()!.Trim(),
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null
        };
    }

    private static Guid? GuidValue(JsonElement body, string name) => Guid.TryParse(Text(body, name), out var value) ? value : null;
    private static int? IntValue(JsonElement body, string name) => int.TryParse(Text(body, name), out var value) ? value : null;
    private static decimal? DecimalValue(JsonElement body, string name) => decimal.TryParse(Text(body, name), out var value) ? value : null;
    private static bool? Bool(JsonElement body, string name)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(name, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(value.GetString(), out var parsed) => parsed,
            _ => null
        };
    }
}
