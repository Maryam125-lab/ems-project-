using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers.Api;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardApiController : ControllerBase
{
    private readonly Db _db;

    public DashboardApiController(Db db)
    {
        _db = db;
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> Metrics([FromQuery] string? range, CancellationToken cancellationToken)
    {
        var months = range == "12m" ? 12 : 6;
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var totals = await connection.QuerySingleAsync("""
            SELECT
              (SELECT COUNT(*)::int FROM public.employee_info) AS total_employees,
              (SELECT COUNT(*)::int FROM public.job_info WHERE date_trunc('month', date_of_joining) = date_trunc('month', CURRENT_DATE)) AS new_this_month,
              (SELECT COUNT(*)::int FROM public.departments WHERE is_active = true) AS department_count,
              (SELECT COUNT(*)::int FROM public.attendance WHERE date = CURRENT_DATE AND status IN ('present', 'late', 'half_day')) AS present_today,
              (SELECT COUNT(*)::int FROM public.leave_requests WHERE status = 'approved' AND CURRENT_DATE BETWEEN start_date AND COALESCE(end_by_force, end_date)) AS on_leave_today,
              (SELECT COALESCE(SUM(net_salary), 0)::bigint FROM public.payroll_records WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) AND year = EXTRACT(YEAR FROM CURRENT_DATE)) AS total_payroll,
              (SELECT COUNT(*)::int FROM public.employee_penalties WHERE status = 'pending') AS pending_penalties,
              (SELECT COALESCE(AVG(basic_salary), 0)::int FROM public.employee_salary WHERE is_current = true) AS average_salary
            """);
        var attendanceTrend = await connection.QueryAsync("""
            WITH months AS (
              SELECT to_char(date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs), 'Mon') AS month,
                     date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs) AS month_start
              FROM generate_series(0, @Months - 1) AS gs
            )
            SELECT m.month,
                   COUNT(a.*) FILTER (WHERE a.status = 'present')::int AS present,
                   COUNT(a.*) FILTER (WHERE a.status = 'absent')::int AS absent,
                   COUNT(a.*) FILTER (WHERE a.status = 'late')::int AS late
            FROM months m
            LEFT JOIN public.attendance a ON date_trunc('month', a.date) = m.month_start
            GROUP BY m.month, m.month_start
            ORDER BY m.month_start ASC
            """, new { Months = months });
        var departments = await connection.QueryAsync("""
            SELECT d.department_name AS name, COUNT(ji.employee_id)::int AS count
            FROM public.departments d
            LEFT JOIN public.job_info ji ON ji.department_id = d.id
            WHERE d.is_active = true
            GROUP BY d.department_name
            ORDER BY count DESC, d.department_name ASC
            """);
        var employmentTypes = await connection.QueryAsync("""
            SELECT et.type_name AS label, COUNT(ji.employee_id)::int AS count
            FROM public.employment_types et
            LEFT JOIN public.job_info ji ON ji.employment_type_id = et.id
            GROUP BY et.type_name
            ORDER BY count DESC
            """);
        var recentActivity = await connection.QueryAsync("""
            SELECT 'Promotion' AS type, ei.name, p.effective_date AS date
            FROM public.promotions p
            JOIN public.employee_info ei ON ei.employee_id = p.employee_id
            ORDER BY p.created_at DESC
            LIMIT 5
            """);
        var headcountTrend = await connection.QueryAsync("""
            WITH months AS (
              SELECT
                date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs) AS month_start,
                (date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs) + interval '1 month - 1 day')::date AS month_end
              FROM generate_series(0, @Months - 1) AS gs
            )
            SELECT
              to_char(m.month_start, 'Mon') AS month,
              COUNT(ei.employee_id)::int AS count,
              COUNT(ei.employee_id) FILTER (WHERE date_trunc('month', ji.date_of_joining) = m.month_start)::int AS joined
            FROM months m
            LEFT JOIN public.employee_info ei ON true
            LEFT JOIN public.job_info ji ON ji.employee_id = ei.employee_id
            WHERE ji.date_of_joining IS NULL OR ji.date_of_joining <= m.month_end
            GROUP BY m.month_start, m.month_end
            ORDER BY m.month_start ASC
            """, new { Months = months });
        var pendingActions = await GetPendingActionsRows(connection);
        var urgentAlerts = await GetUrgentAlertsRows(connection, 30);
        var totalEmployees = Convert.ToInt32(totals.total_employees);
        var presentToday = Convert.ToInt32(totals.present_today);

        return Ok(ApiResponse<object>.Ok(new
        {
            totals.total_employees,
            totals.new_this_month,
            totals.department_count,
            totals.present_today,
            present_today_percent = totalEmployees > 0 ? Math.Round((decimal)presentToday / totalEmployees * 100, 1) : 0,
            totals.on_leave_today,
            totals.total_payroll,
            totals.pending_penalties,
            attendance_trend = attendanceTrend,
            headcount_trend = headcountTrend,
            upcoming_birthdays = Array.Empty<object>(),
            pending_actions = pendingActions,
            urgent_alerts = urgentAlerts,
            departments,
            monthly_attendance = attendanceTrend,
            employment_types = employmentTypes,
            totals.average_salary,
            recent_activity = recentActivity,
            attendance_rate = 94,
            leave_utilization = 12,
            on_time_rate = 88
        }));
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var attendance = await connection.QuerySingleAsync("""
            SELECT
              COUNT(*) FILTER (WHERE status = 'present')::int AS presents,
              COUNT(*) FILTER (WHERE status = 'absent')::int AS absents,
              COUNT(*) FILTER (WHERE status = 'late')::int AS lates,
              COUNT(*) FILTER (WHERE status = 'half_day')::int AS half_days
            FROM public.attendance
            WHERE employee_id = @EmployeeId
              AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
              AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
            """, new { current.EmployeeId });
        var balances = await connection.QueryAsync("""
            SELECT lb.leave_type_id, lt.name, lb.balance, lb.used, (lb.balance - lb.used) AS remaining
            FROM public.leave_balances lb
            JOIN public.leave_types lt ON lt.id = lb.leave_type_id
            WHERE lb.employee_id = @EmployeeId AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)
            """, new { current.EmployeeId });
        var recent = await connection.QueryAsync("""
            SELECT date, status, check_in, check_out
            FROM public.attendance
            WHERE employee_id = @EmployeeId
            ORDER BY date DESC
            LIMIT 6
            """, new { current.EmployeeId });
        return Ok(ApiResponse<object>.Ok(new
        {
            attendance_summary = attendance,
            leave_balances = balances,
            leave_wallet = balances,
            active_penalties = Array.Empty<object>(),
            recent_attendance = recent,
            leave_requests = Array.Empty<object>(),
            upcoming_birthdays = Array.Empty<object>()
        }));
    }

    [HttpGet("pending-actions")]
    public async Task<IActionResult> PendingActions(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        return Ok(ApiResponse<object>.Ok(await GetPendingActionsRows(connection)));
    }

    [HttpGet("urgent-alerts")]
    public async Task<IActionResult> UrgentAlerts([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        return Ok(ApiResponse<object>.Ok(await GetUrgentAlertsRows(connection, days)));
    }

    private static async Task<IEnumerable<object>> GetPendingActionsRows(System.Data.IDbConnection connection)
    {
        var rows = await connection.QueryAsync("""
            SELECT ei.employee_id, ei.name, eba.account_number AS bank_acc_num, ec.e_contact_1_phone, ec.postal_address
            FROM public.employee_info ei
            LEFT JOIN public.emergency_contacts ec ON ec.employee_id = ei.employee_id
            LEFT JOIN public.employee_bank_accounts eba ON eba.employee_id = ei.employee_id
            WHERE eba.account_number IS NULL OR ec.e_contact_1_phone IS NULL OR ec.postal_address IS NULL
            ORDER BY ei.employee_id ASC
            LIMIT 50
            """);
        return rows.Select(row => new
        {
            row.employee_id,
            row.name,
            missing_fields = new[] {
                row.bank_acc_num is null ? "bank_acc_num" : null,
                row.e_contact_1_phone is null ? "emergence_contact_1" : null,
                row.postal_address is null ? "postal_address" : null
            }.Where(value => value is not null)
        });
    }

    private static async Task<IEnumerable<object>> GetUrgentAlertsRows(System.Data.IDbConnection connection, int days)
    {
        var rows = await connection.QueryAsync("""
            SELECT ei.employee_id, ei.name, ji.probation_end_date, ji.contract_end_date
            FROM public.job_info ji
            JOIN public.employee_info ei ON ei.employee_id = ji.employee_id
            WHERE (ji.probation_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (@Days || ' day')::interval)
               OR (ji.contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (@Days || ' day')::interval)
            ORDER BY ei.employee_id ASC
            """, new { Days = days.ToString() });
        return rows;
    }
}
