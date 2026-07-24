using System.Text.Json;
using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers.Api;

[ApiController]
[Authorize]
public sealed class WorkspaceApiController : ControllerBase
{
    private readonly Db _db;

    public WorkspaceApiController(Db db)
    {
        _db = db;
    }

    [HttpGet("api/erp/modules")]
    public async Task<IActionResult> Modules(CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var roleName = current?.RoleId is null
            ? "employee"
            : await connection.QuerySingleOrDefaultAsync<string>("SELECT role_name FROM public.roles WHERE id = @RoleId LIMIT 1", new { current.RoleId }) ?? "employee";
        var normalizedRole = (roleName ?? "employee").Trim().ToLowerInvariant().Replace(" ", "_");
        var isEmployee = normalizedRole == "employee";
        var isSuperAdmin = normalizedRole is "super_admin" or "superadmin";
        var modules = isEmployee
            ? new[]
            {
                new { key = "hr", name = "Employee Portal", status = "active", health = "online", route = "/MyPortal/Dashboard", description = "Self-service attendance, leave, payslips, penalties, profile, and company directory.", capabilities = new[] { "My dashboard", "Leave self-service", "Attendance verification", "Company directory" } }
            }
            : isSuperAdmin
                ? new[]
                {
                    new { key = "hr", name = "HR Management", status = "active", health = "online", route = "/Dashboard", description = "Employees, attendance, leave, payroll, penalties, announcements, and HR configuration.", capabilities = new[] { "Employee master", "Attendance ledger", "Leave approvals", "Payroll and penalties" } },
                    new { key = "inventory", name = "Inventory Control", status = "active", health = "online", route = "/Inventory", description = "Item master, stock-in, stock-out, purchase approvals, invoicing, tracker installation, complaints, and replacements.", capabilities = new[] { "Item master", "Purchase flow", "Sales and invoices", "Tracker support" } },
                    new { key = "projects", name = "Project Management", status = "active", health = "online", route = "/Projects", description = "Projects, milestones, tasks, team allocation, timesheets, inventory consumption, and project cost tracking.", capabilities = new[] { "Project master", "Milestones", "Tasks", "Team allocation", "Cost tracking" } },
                    new { key = "reports", name = "Reports Center", status = "partial", health = "connected", route = "/AuditLog", description = "Cross-module reporting surface for HR, inventory, projects, approvals, and audit trails.", capabilities = new[] { "Audit logs", "HR summaries", "Exports", "Cross-module KPIs" } }
                }
                : new[]
                {
                    new { key = "hr", name = "HR Management", status = "active", health = "online", route = "/Dashboard", description = "Employees, attendance, leave, payroll, penalties, announcements, and HR configuration.", capabilities = new[] { "Employee master", "Attendance ledger", "Leave approvals", "Payroll and penalties" } }
                };
        return Ok(ApiResponse<object>.Ok(new
        {
            user = new { current?.EmployeeId, current?.RoleId, role_name = roleName },
            modules,
            integration = new { auth = "single_erp_session", backend = "aspnet_core_shared_api", roadmap = "modular_services_ready" }
        }));
    }

    [HttpGet("api/projects/status")]
    public async Task<IActionResult> ProjectStatus(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureProjectSchemaAsync(connection);
        var stats = await ProjectStatsAsync(connection);
        return Ok(ApiResponse<object>.Ok(new
        {
            module = "projects",
            status = "active",
            health = "online",
            message = "Project management backend is connected with HR employees and ERP auth.",
            stats,
            features = new[] { "Project master", "Milestones", "Tasks", "Team allocation", "Timesheets", "Cost tracking" }
        }));
    }

    [HttpGet("api/projects")]
    public async Task<IActionResult> Projects(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureProjectSchemaAsync(connection);
        var rows = await connection.QueryAsync("""
            SELECT
              p.*,
              dep.department_name,
              mgr.name AS manager_name,
              COALESCE(t.task_count, 0)::int AS task_count,
              COALESCE(t.done_count, 0)::int AS done_count,
              CASE WHEN COALESCE(t.task_count, 0) = 0 THEN 0 ELSE ROUND((COALESCE(t.done_count, 0)::numeric / t.task_count::numeric) * 100, 0)::int END AS progress_percent
            FROM public.erp_projects p
            LEFT JOIN public.departments dep ON dep.id = p.department_id
            LEFT JOIN public.employee_info mgr ON mgr.employee_id = p.manager_emp_id
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS task_count, COUNT(*) FILTER (WHERE status = 'done')::int AS done_count
              FROM public.erp_project_tasks pt
              WHERE pt.project_id = p.id
            ) t ON true
            ORDER BY p.created_at DESC
            LIMIT 100
            """);
        return Ok(ApiResponse<object>.Ok(new { data = rows, stats = await ProjectStatsAsync(connection) }));
    }

    [HttpPost("api/projects")]
    public async Task<IActionResult> CreateProject([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        var name = Text(body, "project_name");
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Project name is required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureProjectSchemaAsync(connection);
        var code = Text(body, "project_code") ?? $"PRJ-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.erp_projects (project_code, project_name, description, client_name, department_id, manager_emp_id, priority, status, start_date, due_date, budget_amount, created_by)
            VALUES (@ProjectCode, @ProjectName, @Description, @ClientName, @DepartmentId, @ManagerEmpId, @Priority, @Status, CAST(@StartDate AS date), CAST(@DueDate AS date), @BudgetAmount, @UserId)
            RETURNING *
            """, new
        {
            ProjectCode = code,
            ProjectName = name,
            Description = Text(body, "description"),
            ClientName = Text(body, "client_name"),
            DepartmentId = GuidValue(body, "department_id"),
            ManagerEmpId = Text(body, "manager_emp_id"),
            Priority = Text(body, "priority") ?? "medium",
            Status = Text(body, "status") ?? "planning",
            StartDate = Text(body, "start_date"),
            DueDate = Text(body, "due_date"),
            BudgetAmount = DecimalValue(body, "budget_amount") ?? 0,
            current.UserId
        });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/projects/{id:guid}/tasks")]
    public async Task<IActionResult> ProjectTasks(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureProjectSchemaAsync(connection);
        var rows = await connection.QueryAsync("""
            SELECT pt.*, emp.name AS assignee_name
            FROM public.erp_project_tasks pt
            LEFT JOIN public.employee_info emp ON emp.employee_id = pt.assignee_emp_id
            WHERE pt.project_id = @Id
            ORDER BY pt.created_at DESC
            """, new { Id = id });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/projects/{id:guid}/tasks")]
    public async Task<IActionResult> CreateProjectTask(Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        var title = Text(body, "title");
        if (string.IsNullOrWhiteSpace(title)) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Task title is required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureProjectSchemaAsync(connection);
        var exists = await connection.QuerySingleAsync<int>("SELECT COUNT(*)::int FROM public.erp_projects WHERE id = @Id", new { Id = id });
        if (exists == 0) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Project not found."));

        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.erp_project_tasks (project_id, title, description, assignee_emp_id, priority, status, due_date, created_by)
            VALUES (@ProjectId, @Title, @Description, @AssigneeEmpId, @Priority, @Status, CAST(@DueDate AS date), @UserId)
            RETURNING *
            """, new
        {
            ProjectId = id,
            Title = title,
            Description = Text(body, "description"),
            AssigneeEmpId = Text(body, "assignee_emp_id"),
            Priority = Text(body, "priority") ?? "medium",
            Status = Text(body, "status") ?? "todo",
            DueDate = Text(body, "due_date"),
            current.UserId
        });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/announcements")]
    public async Task<IActionResult> Announcements([FromQuery] int limit = 20, [FromQuery] int offset = 0, CancellationToken cancellationToken = default)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT a.*, u.email AS author_name
            FROM public.announcements a
            LEFT JOIN public.users u ON u.id = a.created_by
            ORDER BY a.is_pinned DESC, a.created_at DESC
            LIMIT @Limit OFFSET @Offset
            """, new { Limit = Math.Clamp(limit, 1, 100), Offset = Math.Max(offset, 0) });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("api/announcements/{id:guid}")]
    public async Task<IActionResult> Announcement(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.announcements WHERE id = @Id LIMIT 1", new { Id = id });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Announcement not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPost("api/announcements")]
    public async Task<IActionResult> CreateAnnouncement([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.announcements (title, content, type, is_pinned, created_by)
            VALUES (@Title, @Content, @Type, @IsPinned, @UserId)
            RETURNING *
            """, new { Title = Text(body, "title"), Content = Text(body, "content"), Type = Text(body, "type") ?? "general", IsPinned = Bool(body, "is_pinned") ?? false, current.UserId });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("api/announcements/{id:guid}")]
    public async Task<IActionResult> UpdateAnnouncement(Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.announcements
            SET title = COALESCE(@Title, title),
                content = COALESCE(@Content, content),
                type = COALESCE(@Type, type),
                is_pinned = COALESCE(@IsPinned, is_pinned),
                updated_at = now()
            WHERE id = @Id
            RETURNING *
            """, new { Id = id, Title = Text(body, "title"), Content = Text(body, "content"), Type = Text(body, "type"), IsPinned = Bool(body, "is_pinned") });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Announcement not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPatch("api/announcements/{id:guid}/pin")]
    public Task<IActionResult> PinAnnouncement(Guid id, CancellationToken cancellationToken) => SetAnnouncementPin(id, true, cancellationToken);

    [HttpPatch("api/announcements/{id:guid}/unpin")]
    public Task<IActionResult> UnpinAnnouncement(Guid id, CancellationToken cancellationToken) => SetAnnouncementPin(id, false, cancellationToken);

    [HttpDelete("api/announcements/{id:guid}")]
    public async Task<IActionResult> DeleteAnnouncement(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var count = await connection.ExecuteAsync("DELETE FROM public.announcements WHERE id = @Id", new { Id = id });
        return count == 0 ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Announcement not found.")) : Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpGet("api/notifications")]
    public async Task<IActionResult> Notifications(CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        try
        {
            await using var connection = await _db.OpenConnectionAsync(cancellationToken);
            var roleName = current.RoleId is null ? null : await connection.QuerySingleOrDefaultAsync<string>("SELECT role_name FROM public.roles WHERE id = @RoleId LIMIT 1", new { current.RoleId });
            var rows = await connection.QueryAsync("""
                SELECT *
                FROM public.notifications
                WHERE user_id = @UserId OR (role IS NOT NULL AND role = @RoleName)
                ORDER BY created_at DESC
                """, new { current.UserId, RoleName = roleName });
            var unread = await connection.QuerySingleAsync<int>("SELECT COUNT(*)::int FROM public.notifications WHERE is_read = false AND (user_id = @UserId OR (role IS NOT NULL AND role = @RoleName))", new { current.UserId, RoleName = roleName });
            return Ok(ApiResponse<object>.Ok(new { notifications = rows, unread_count = unread }));
        }
        catch (Exception)
        {
            // DB temporarily unreachable — return empty gracefully
            return Ok(ApiResponse<object>.Ok(new { notifications = Array.Empty<object>(), unread_count = 0 }));
        }
    }


    [HttpPatch("api/notifications/{id:guid}/read")]
    public async Task<IActionResult> MarkNotificationRead(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("UPDATE public.notifications SET is_read = true, updated_at = now() WHERE id = @Id RETURNING *", new { Id = id });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Notification not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPost("api/notifications")]
    public async Task<IActionResult> CreateNotification([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.notifications (user_id, role, type, message, created_by)
            VALUES (@UserIdTarget, @Role, @Type, @Message, @UserId)
            RETURNING *
            """, new { UserIdTarget = GuidValue(body, "user_id"), Role = Text(body, "role"), Type = Text(body, "type"), Message = Text(body, "message"), current.UserId });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpGet("api/directory")]
    public async Task<IActionResult> Directory([FromQuery] string? search, [FromQuery(Name = "department_id")] Guid? departmentId, [FromQuery(Name = "branch_id")] Guid? branchId, CancellationToken cancellationToken = default)
    {
        var args = new DynamicParameters();
        var where = new List<string>();
        if (!string.IsNullOrWhiteSpace(search))
        {
            where.Add("(de.name ILIKE @Search OR de.email ILIKE @Search OR de.employee_id ILIKE @Search)");
            args.Add("Search", $"%{search.Trim()}%");
        }
        if (departmentId is not null) { where.Add("de.department_id = @DepartmentId"); args.Add("DepartmentId", departmentId); }
        if (branchId is not null) { where.Add("de.branch_id = @BranchId"); args.Add("BranchId", branchId); }
        var whereSql = where.Count == 0 ? "" : $"WHERE {string.Join(" AND ", where)}";
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync($"""
            SELECT de.*, d.department_name, wl.location_name AS branch_name
            FROM public.directory_entries de
            LEFT JOIN public.departments d ON d.id = de.department_id
            LEFT JOIN public.work_locations wl ON wl.id = de.branch_id
            {whereSql}
            ORDER BY de.name ASC
            """, args);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("api/directory")]
    public async Task<IActionResult> CreateDirectory([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.directory_entries (employee_id, name, email, phone_internal, phone_mobile, phone_mobile_public, role_title, department_id, branch_id, availability, created_by)
            VALUES (@EmployeeId, @Name, @Email, @PhoneInternal, @PhoneMobile, @PhoneMobilePublic, @RoleTitle, @DepartmentId, @BranchId, @Availability, @UserId)
            RETURNING *
            """, DirectoryArgs(body, current.UserId));
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("api/directory/{id:guid}")]
    public async Task<IActionResult> UpdateDirectory(Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.directory_entries
            SET employee_id = COALESCE(@EmployeeId, employee_id),
                name = COALESCE(@Name, name),
                email = COALESCE(@Email, email),
                phone_internal = COALESCE(@PhoneInternal, phone_internal),
                phone_mobile = COALESCE(@PhoneMobile, phone_mobile),
                phone_mobile_public = COALESCE(@PhoneMobilePublic, phone_mobile_public),
                role_title = COALESCE(@RoleTitle, role_title),
                department_id = COALESCE(@DepartmentId, department_id),
                branch_id = COALESCE(@BranchId, branch_id),
                availability = COALESCE(@Availability, availability),
                updated_at = now()
            WHERE id = @Id
            RETURNING *
            """, DirectoryArgs(body, null, id));
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Directory entry not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    private async Task<IActionResult> SetAnnouncementPin(Guid id, bool isPinned, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("UPDATE public.announcements SET is_pinned = @IsPinned, updated_at = now() WHERE id = @Id RETURNING *", new { Id = id, IsPinned = isPinned });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Announcement not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    private static object DirectoryArgs(JsonElement body, Guid? userId, Guid? id = null) => new
    {
        Id = id,
        EmployeeId = Text(body, "employee_id"),
        Name = Text(body, "name"),
        Email = Text(body, "email"),
        PhoneInternal = Text(body, "phone_internal"),
        PhoneMobile = Text(body, "phone_mobile"),
        PhoneMobilePublic = Bool(body, "phone_mobile_public"),
        RoleTitle = Text(body, "role_title"),
        DepartmentId = GuidValue(body, "department_id"),
        BranchId = GuidValue(body, "branch_id"),
        Availability = Text(body, "availability"),
        UserId = userId
    };

    private static async Task EnsureProjectSchemaAsync(System.Data.IDbConnection connection)
    {
        await connection.ExecuteAsync("""
            CREATE TABLE IF NOT EXISTS public.erp_projects (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              project_code text NOT NULL UNIQUE,
              project_name text NOT NULL,
              description text NULL,
              client_name text NULL,
              department_id uuid NULL,
              manager_emp_id text NULL,
              priority text NOT NULL DEFAULT 'medium',
              status text NOT NULL DEFAULT 'planning',
              start_date date NULL,
              due_date date NULL,
              budget_amount numeric(14,2) NOT NULL DEFAULT 0,
              created_by uuid NULL,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NULL
            );

            CREATE TABLE IF NOT EXISTS public.erp_project_milestones (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id uuid NOT NULL REFERENCES public.erp_projects(id) ON DELETE CASCADE,
              title text NOT NULL,
              description text NULL,
              owner_emp_id text NULL,
              status text NOT NULL DEFAULT 'planned',
              due_date date NULL,
              completed_at timestamptz NULL,
              created_by uuid NULL,
              created_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS public.erp_project_tasks (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id uuid NOT NULL REFERENCES public.erp_projects(id) ON DELETE CASCADE,
              title text NOT NULL,
              description text NULL,
              assignee_emp_id text NULL,
              priority text NOT NULL DEFAULT 'medium',
              status text NOT NULL DEFAULT 'todo',
              due_date date NULL,
              completed_at timestamptz NULL,
              created_by uuid NULL,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NULL
            );

            CREATE TABLE IF NOT EXISTS public.erp_project_timesheets (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id uuid NOT NULL REFERENCES public.erp_projects(id) ON DELETE CASCADE,
              task_id uuid NULL REFERENCES public.erp_project_tasks(id) ON DELETE SET NULL,
              employee_id text NOT NULL,
              work_date date NOT NULL,
              hours numeric(6,2) NOT NULL DEFAULT 0,
              notes text NULL,
              status text NOT NULL DEFAULT 'submitted',
              approved_by uuid NULL,
              created_by uuid NULL,
              created_at timestamptz NOT NULL DEFAULT now()
            );
            """);
    }

    private static async Task<object> ProjectStatsAsync(System.Data.IDbConnection connection)
    {
        var row = await connection.QuerySingleAsync("""
            SELECT
              COUNT(*)::int AS total_projects,
              COUNT(*) FILTER (WHERE status IN ('active', 'in_progress'))::int AS active_projects,
              COUNT(*) FILTER (WHERE status IN ('planning', 'on_hold'))::int AS planning_projects,
              COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE AND status NOT IN ('completed', 'closed'))::int AS overdue_projects,
              COALESCE(SUM(budget_amount), 0)::numeric AS total_budget
            FROM public.erp_projects
            """);
        return row;
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
