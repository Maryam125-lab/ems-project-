using System.Text.Json;
using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EMS.Web.Controllers.Api;

[ApiController]
[Authorize]
[Route("api/accounts")]
public sealed class AccountsApiController : ControllerBase
{
    private readonly Db _db;

    public AccountsApiController(Db db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT u.id,
                   u.employee_id,
                   u.email,
                   u.role_id,
                   u.must_change_password,
                   u.created_at,
                   u.updated_at,
                   u.password_changed_at,
                   ei.name AS employee_name,
                   r.role_name,
                   wl.location_name AS branch_name
            FROM public.users u
            LEFT JOIN public.employee_info ei ON ei.employee_id = u.employee_id
            LEFT JOIN public.roles r ON r.id = u.role_id
            LEFT JOIN public.job_info ji ON ji.employee_id = u.employee_id
            LEFT JOIN public.work_locations wl ON wl.id = ji.work_location_id
            ORDER BY u.created_at DESC
            LIMIT 300
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("roles")]
    public async Task<IActionResult> Roles(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT id, role_name, description FROM public.roles ORDER BY role_name ASC");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var employeeId = Text(body, "employee_id")?.ToUpperInvariant();
        var email = Text(body, "email");
        var password = Text(body, "password");
        var roleId = GuidValue(body, "role_id");

        if (string.IsNullOrWhiteSpace(employeeId) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Employee, email and password are required."));
        }

        if (password.Length < 8)
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Password must be at least 8 characters."));
        }

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var employeeExists = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*)::int FROM public.employee_info WHERE employee_id = @EmployeeId",
            new { EmployeeId = employeeId });
        if (employeeExists == 0)
        {
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Employee not found."));
        }

        roleId ??= await connection.ExecuteScalarAsync<Guid?>("SELECT id FROM public.roles WHERE role_name = 'employee' LIMIT 1");
        if (roleId is null)
        {
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<object>.Fail("CONFIG_ERROR", "Role configuration is missing."));
        }

        try
        {
            var row = await connection.QuerySingleAsync("""
                INSERT INTO public.users (employee_id, email, password, role_id, must_change_password)
                VALUES (@EmployeeId, @Email, @Password, @RoleId, true)
                RETURNING id, employee_id, email, role_id, must_change_password, created_at, updated_at
                """,
                new
                {
                    EmployeeId = employeeId,
                    Email = email,
                    Password = BCrypt.Net.BCrypt.HashPassword(password, 12),
                    RoleId = roleId.Value
                });
            return StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(row));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(ApiResponse<object>.Fail("CONFLICT", "An account already exists for this employee or email."));
        }
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        var email = Text(body, "email");
        var roleId = GuidValue(body, "role_id");
        var password = Text(body, "password");
        var mustChangePassword = Bool(body, "must_change_password");

        var updates = new List<string>();
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);

        if (!string.IsNullOrWhiteSpace(email))
        {
            updates.Add("email = @Email");
            parameters.Add("Email", email);
        }
        if (roleId is not null)
        {
            updates.Add("role_id = @RoleId");
            parameters.Add("RoleId", roleId.Value);
        }
        if (!string.IsNullOrWhiteSpace(password))
        {
            if (password.Length < 8)
            {
                return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Password must be at least 8 characters."));
            }
            updates.Add("password = @Password");
            updates.Add("must_change_password = true");
            parameters.Add("Password", BCrypt.Net.BCrypt.HashPassword(password, 12));
        }
        else if (mustChangePassword is not null)
        {
            updates.Add("must_change_password = @MustChangePassword");
            parameters.Add("MustChangePassword", mustChangePassword.Value);
        }

        if (updates.Count == 0)
        {
            return BadRequest(ApiResponse<object>.Fail("BAD_REQUEST", "No account fields were provided."));
        }

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        try
        {
            var row = await connection.QuerySingleOrDefaultAsync($"""
                UPDATE public.users
                SET {string.Join(", ", updates)}, updated_at = now()
                WHERE id = @Id
                RETURNING id, employee_id, email, role_id, must_change_password, created_at, updated_at
                """, parameters);
            return row is null
                ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Account not found."))
                : Ok(ApiResponse<object>.Ok(row));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(ApiResponse<object>.Fail("CONFLICT", "Email is already assigned to another account."));
        }
    }

    private static string? Text(JsonElement body, string name)
    {
        if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty(name, out var value)) return null;
        return value.ValueKind switch
        {
            JsonValueKind.String => string.IsNullOrWhiteSpace(value.GetString()) ? null : value.GetString()!.Trim(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null
        };
    }

    private static Guid? GuidValue(JsonElement body, string name) => Guid.TryParse(Text(body, name), out var value) ? value : null;

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
