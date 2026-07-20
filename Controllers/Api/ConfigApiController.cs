using System.Text.Json;
using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EMS.Web.Controllers.Api;

[ApiController]
[Authorize]
[Route("api/config")]
public sealed class ConfigApiController : ControllerBase
{
    private sealed record ConfigEntity(string Table, string[] CreateFields, string[] UpdateFields, string OrderBy);

    private static readonly Dictionary<string, ConfigEntity> EntityTables = new(StringComparer.OrdinalIgnoreCase)
    {
        ["departments"] = new("departments", ["department_code", "department_name", "parent_department_id", "is_active"], ["department_code", "department_name", "parent_department_id", "is_active"], "department_name ASC"),
        ["designations"] = new("designations", ["title", "is_active"], ["title", "is_active"], "created_at DESC"),
        ["employment-types"] = new("employment_types", ["type_name", "is_active"], ["type_name", "is_active"], "created_at DESC"),
        ["job-statuses"] = new("job_statuses", ["status_name", "is_active"], ["status_name", "is_active"], "created_at DESC"),
        ["work-modes"] = new("work_modes", ["mode_name", "is_active"], ["mode_name", "is_active"], "created_at DESC"),
        ["work-locations"] = new("work_locations", ["location_name", "is_active"], ["location_name", "is_active"], "created_at DESC"),
        ["shifts"] = new("shifts", ["name", "start_time", "end_time", "late_after_minutes", "is_active"], ["name", "start_time", "end_time", "late_after_minutes", "is_active"], "created_at DESC"),
        ["leave-types"] = new("leave_types", ["name", "is_active"], ["name", "is_active"], "created_at DESC"),
        ["leave-policies"] = new("leave_policies", ["department_id", "leave_type_id", "days_allowed", "year", "is_active"], ["department_id", "leave_type_id", "days_allowed", "year", "is_active"], "created_at DESC"),
        ["leave-capacity"] = new("leave_capacity_config", ["department_id", "max_percent", "is_active"], ["department_id", "max_percent", "is_active"], "created_at DESC"),
        ["penalty-rules"] = new("penalty_rules", ["name", "amount_pkr", "type", "is_active"], ["name", "amount_pkr", "type", "is_active"], "created_at DESC"),
        ["salary-components"] = new("salary_components", ["component_name", "component_type", "calculation_type", "fixed_amount", "percentage_rate", "is_taxable", "is_active"], ["component_name", "component_type", "calculation_type", "fixed_amount", "percentage_rate", "is_taxable", "is_active"], "created_at DESC"),
        ["global-days"] = new("global_days", ["name", "type", "start_date", "end_date", "is_active"], ["name", "type", "start_date", "end_date", "is_active"], "start_date DESC"),
        ["tax-config"] = new("tax_slabs", ["income_from", "income_to", "rate_percent", "fixed_amount", "is_active"], ["income_from", "income_to", "rate_percent", "fixed_amount", "is_active"], "income_from ASC"),
        ["custom-fields"] = new("custom_fields", ["field_name", "field_type", "section", "is_required", "is_active"], ["field_name", "field_type", "section", "is_required", "is_active"], "created_at DESC")
    };

    private readonly Db _db;

    public ConfigApiController(Db db)
    {
        _db = db;
    }

    [HttpGet("{entity}")]
    public async Task<IActionResult> Get(string entity, CancellationToken cancellationToken)
    {
        if (!EntityTables.TryGetValue(entity, out var config))
        {
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Config entity not found."));
        }

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureOptionalTableAsync(connection, config.Table);
        var rows = await connection.QueryAsync($"SELECT * FROM public.{config.Table} WHERE (is_active IS NULL OR is_active = true) ORDER BY {config.OrderBy}");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("{entity}")]
    public async Task<IActionResult> Create(string entity, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        if (!EntityTables.TryGetValue(entity, out var config))
        {
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Config entity not found."));
        }

        var data = PickFields(body, config.CreateFields, includeDefaults: true);
        if (data.Count == 0)
        {
            return BadRequest(ApiResponse<object>.Fail("BAD_REQUEST", "No fields provided for creation."));
        }

        var columns = data.Keys.ToArray();
        var parameters = new DynamicParameters();
        foreach (var (key, value) in data)
        {
            parameters.Add(key, value);
        }

        var columnSql = string.Join(", ", columns);
        var valueSql = string.Join(", ", columns.Select(column => "@" + column));

        try
        {
            await using var connection = await _db.OpenConnectionAsync(cancellationToken);
            await EnsureOptionalTableAsync(connection, config.Table);
            var row = await connection.QuerySingleAsync(
                $"INSERT INTO public.{config.Table} ({columnSql}) VALUES ({valueSql}) RETURNING *",
                parameters);
            return StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(row));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(ApiResponse<object>.Fail("CONFLICT", "A record with the same value already exists."));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            return BadRequest(ApiResponse<object>.Fail("INVALID_REFERENCE", "One of the selected references does not exist."));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.NotNullViolation || ex.SqlState == PostgresErrorCodes.CheckViolation)
        {
            return UnprocessableEntity(ApiResponse<object>.Fail("VALIDATION_ERROR", "Please fill the required fields correctly."));
        }
    }

    [HttpPatch("{entity}/{id:guid}")]
    public async Task<IActionResult> Update(string entity, Guid id, [FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        if (!EntityTables.TryGetValue(entity, out var config))
        {
            return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Config entity not found."));
        }

        var data = PickFields(body, config.UpdateFields, includeDefaults: false);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await EnsureOptionalTableAsync(connection, config.Table);

        if (data.Count == 0)
        {
            var existing = await connection.QuerySingleOrDefaultAsync($"SELECT * FROM public.{config.Table} WHERE id = @Id", new { Id = id });
            return existing is null
                ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Record not found."))
                : Ok(ApiResponse<object>.Ok(existing));
        }

        var parameters = new DynamicParameters();
        parameters.Add("Id", id);
        foreach (var (key, value) in data)
        {
            parameters.Add(key, value);
        }

        var setSql = string.Join(", ", data.Keys.Select(column => $"{column} = @{column}"));

        try
        {
            var row = await connection.QuerySingleOrDefaultAsync(
                $"UPDATE public.{config.Table} SET {setSql}, updated_at = now() WHERE id = @Id RETURNING *",
                parameters);
            return row is null
                ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Record not found."))
                : Ok(ApiResponse<object>.Ok(row));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return Conflict(ApiResponse<object>.Fail("CONFLICT", "A record with the same value already exists."));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            return BadRequest(ApiResponse<object>.Fail("INVALID_REFERENCE", "One of the selected references does not exist."));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.NotNullViolation || ex.SqlState == PostgresErrorCodes.CheckViolation)
        {
            return UnprocessableEntity(ApiResponse<object>.Fail("VALIDATION_ERROR", "Please fill the required fields correctly."));
        }
    }

    private static Dictionary<string, object?> PickFields(JsonElement body, IEnumerable<string> allowedFields, bool includeDefaults)
    {
        var data = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        if (body.ValueKind != JsonValueKind.Object) return data;

        foreach (var field in allowedFields)
        {
            if (body.TryGetProperty(field, out var value))
            {
                data[field] = JsonValue(field, value);
            }
        }

        if (includeDefaults && allowedFields.Contains("is_active", StringComparer.OrdinalIgnoreCase) && !data.ContainsKey("is_active"))
        {
            data["is_active"] = true;
        }

        return data;
    }

    private static object? JsonValue(string field, JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.String)
        {
            var text = value.GetString();
            if (string.IsNullOrWhiteSpace(text)) return null;
            if (field.EndsWith("_date", StringComparison.OrdinalIgnoreCase) && DateTime.TryParse(text, out var dateValue)) return dateValue.Date;
            if (field.EndsWith("_time", StringComparison.OrdinalIgnoreCase) && TimeSpan.TryParse(text, out var timeValue)) return timeValue;
            return text.Trim();
        }

        return value.ValueKind switch
        {
            JsonValueKind.Number when value.TryGetInt32(out var intValue) => intValue,
            JsonValueKind.Number when value.TryGetDecimal(out var decimalValue) => decimalValue,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => value.GetRawText()
        };
    }

    private static async Task EnsureOptionalTableAsync(System.Data.IDbConnection connection, string table)
    {
        var sql = table switch
        {
            "salary_components" => """
                CREATE TABLE IF NOT EXISTS public.salary_components (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    component_name text NOT NULL,
                    component_type text NOT NULL CHECK (component_type IN ('earning', 'deduction')),
                    calculation_type text NOT NULL DEFAULT 'fixed',
                    fixed_amount numeric(12,2),
                    percentage_rate numeric(7,3),
                    is_taxable boolean NOT NULL DEFAULT false,
                    is_active boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """,
            "global_days" => """
                CREATE TABLE IF NOT EXISTS public.global_days (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    name text NOT NULL,
                    type text NOT NULL DEFAULT 'company',
                    start_date date NOT NULL,
                    end_date date,
                    is_active boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """,
            "tax_slabs" => """
                CREATE TABLE IF NOT EXISTS public.tax_slabs (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    income_from numeric(14,2) NOT NULL DEFAULT 0,
                    income_to numeric(14,2),
                    rate_percent numeric(7,3) NOT NULL DEFAULT 0,
                    fixed_amount numeric(14,2) NOT NULL DEFAULT 0,
                    is_active boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """,
            "custom_fields" => """
                CREATE TABLE IF NOT EXISTS public.custom_fields (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    field_name text NOT NULL,
                    field_type text NOT NULL DEFAULT 'text',
                    section text NOT NULL DEFAULT 'personal',
                    is_required boolean NOT NULL DEFAULT false,
                    is_active boolean NOT NULL DEFAULT true,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    updated_at timestamptz NOT NULL DEFAULT now()
                );
                """,
            _ => null
        };

        if (!string.IsNullOrWhiteSpace(sql))
        {
            await connection.ExecuteAsync(sql);
        }
    }
}
