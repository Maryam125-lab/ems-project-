using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EMS.Web.Controllers.Api;

[ApiController]
[Authorize]
[Route("api/inventory")]
public sealed partial class InventoryApiController : ControllerBase
{
    private readonly Db _db;

    public InventoryApiController(Db db)
    {
        _db = db;
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken cancellationToken)
    {
        var summary = await GetSummary(cancellationToken);
        return Ok(ApiResponse<object>.Ok(new
        {
            module = "inventory",
            status = "live",
            auth = "connected",
            connected_to_hr_auth = true,
            message = "Inventory, purchasing, invoicing, tracker installations, complaints, replacements, customers, and vendors are connected to the ERP database.",
            planned_next = Array.Empty<string>(),
            summary
        }));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken cancellationToken)
        => Ok(ApiResponse<object>.Ok(await GetSummary(cancellationToken)));

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT ic.*, COUNT(p.id)::int AS product_count
            FROM public.item_categories ic
            LEFT JOIN public.products p ON p.category_id = ic.id
            GROUP BY ic.id
            ORDER BY ic.category_name ASC
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.item_categories (category_name, description)
            VALUES (@category_name, @description)
            RETURNING *
            """, new { category_name = Clean(body, "category_name"), description = Clean(body, "description") });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("categories/{id:guid}")]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.item_categories
            SET category_name = @category_name,
                description = @description
            WHERE id = @id
            RETURNING *
            """, new { id, category_name = Clean(body, "category_name"), description = Clean(body, "description") });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Category not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpDelete("categories/{id:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync("DELETE FROM public.item_categories WHERE id = @id", new { id });
        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT
              p.id,
              p.product_name,
              p.category_id,
              p.product_type,
              p.tracking_type,
              p.quantity,
              p.created_at,
              ic.category_name,
              COUNT(ii.id)::int AS serial_count,
              COUNT(ii.id) FILTER (WHERE ii.current_status = 'AVAILABLE')::int AS available_count,
              COUNT(ii.id) FILTER (WHERE ii.current_status = 'ALLOCATED')::int AS allocated_count,
              COUNT(ii.id) FILTER (WHERE ii.current_status = 'INSTALLED')::int AS installed_count,
              COUNT(ii.id) FILTER (WHERE ii.current_status = 'DAMAGED')::int AS damaged_count
            FROM public.products p
            LEFT JOIN public.item_categories ic ON ic.id = p.category_id
            LEFT JOIN public.inventory_items ii ON ii.product_id = p.id
            GROUP BY p.id, ic.category_name
            ORDER BY p.created_at DESC
            LIMIT @limit
            """, new { limit = ToLimit(limit, 20, 100) });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct([FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.products (product_name, category_id, product_type, tracking_type, quantity)
            VALUES (@product_name, @category_id, @product_type, @tracking_type, @quantity)
            RETURNING *
            """, new
        {
            product_name = Clean(body, "product_name"),
            category_id = GuidValue(body, "category_id"),
            product_type = Normalize(body, "product_type", ["ASSET", "CONSUMABLE", "SERVICE"], "ASSET"),
            tracking_type = Normalize(body, "tracking_type", ["SERIAL", "IMEI", "NONE"], "NONE"),
            quantity = IntValue(body, "quantity", 0)
        });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("products/{id:guid}")]
    public async Task<IActionResult> UpdateProduct(Guid id, [FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.products
            SET product_name = @product_name,
                category_id = @category_id,
                product_type = @product_type,
                tracking_type = @tracking_type,
                quantity = @quantity
            WHERE id = @id
            RETURNING *
            """, new
        {
            id,
            product_name = Clean(body, "product_name"),
            category_id = GuidValue(body, "category_id"),
            product_type = Normalize(body, "product_type", ["ASSET", "CONSUMABLE", "SERVICE"], "ASSET"),
            tracking_type = Normalize(body, "tracking_type", ["SERIAL", "IMEI", "NONE"], "NONE"),
            quantity = IntValue(body, "quantity", 0)
        });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Product not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpDelete("products/{id:guid}")]
    public async Task<IActionResult> DeleteProduct(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync("DELETE FROM public.products WHERE id = @id", new { id });
        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpGet("serials")]
    public async Task<IActionResult> Serials([FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT
              ii.id,
              ii.product_id,
              ii.serial_number,
              ii.current_status,
              ii.created_at,
              p.product_name,
              p.product_type,
              p.tracking_type,
              ic.category_name
            FROM public.inventory_items ii
            JOIN public.products p ON p.id = ii.product_id
            LEFT JOIN public.item_categories ic ON ic.id = p.category_id
            ORDER BY ii.created_at DESC
            LIMIT @limit
            """, new { limit = ToLimit(limit, 20, 100) });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("serials")]
    public async Task<IActionResult> CreateSerial([FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.inventory_items (product_id, serial_number, current_status)
            VALUES (@product_id, @serial_number, @current_status)
            RETURNING *
            """, new
        {
            product_id = GuidValue(body, "product_id"),
            serial_number = Clean(body, "serial_number"),
            current_status = Normalize(body, "current_status", ["AVAILABLE", "ALLOCATED", "INSTALLED", "RETURNED", "DAMAGED"], "AVAILABLE")
        });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("serials/{id:guid}")]
    public async Task<IActionResult> UpdateSerial(Guid id, [FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.inventory_items
            SET product_id = @product_id,
                serial_number = @serial_number,
                current_status = @current_status
            WHERE id = @id
            RETURNING *
            """, new
        {
            id,
            product_id = GuidValue(body, "product_id"),
            serial_number = Clean(body, "serial_number"),
            current_status = Normalize(body, "current_status", ["AVAILABLE", "ALLOCATED", "INSTALLED", "RETURNED", "DAMAGED"], "AVAILABLE")
        });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Serial item not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpDelete("serials/{id:guid}")]
    public async Task<IActionResult> DeleteSerial(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync("DELETE FROM public.inventory_items WHERE id = @id", new { id });
        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpGet("customers")]
    public async Task<IActionResult> Customers([FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.customers ORDER BY created_at DESC, customer_name ASC LIMIT @limit", new { limit = ToLimit(limit, 20, 100) });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("customers")]
    public async Task<IActionResult> CreateCustomer([FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
        => await UpsertParty("customers", null, body, cancellationToken);

    [HttpPatch("customers/{id:guid}")]
    public async Task<IActionResult> UpdateCustomer(Guid id, [FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
        => await UpsertParty("customers", id, body, cancellationToken);

    [HttpDelete("customers/{id:guid}")]
    public async Task<IActionResult> DeleteCustomer(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync("DELETE FROM public.customers WHERE id = @id", new { id });
        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    [HttpGet("vendors")]
    public async Task<IActionResult> Vendors([FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("SELECT * FROM public.vendors ORDER BY created_at DESC, vendor_name ASC LIMIT @limit", new { limit = ToLimit(limit, 20, 100) });
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("vendors")]
    public async Task<IActionResult> CreateVendor([FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
        => await UpsertParty("vendors", null, body, cancellationToken);

    [HttpPatch("vendors/{id:guid}")]
    public async Task<IActionResult> UpdateVendor(Guid id, [FromBody] Dictionary<string, object?> body, CancellationToken cancellationToken)
        => await UpsertParty("vendors", id, body, cancellationToken);

    [HttpDelete("vendors/{id:guid}")]
    public async Task<IActionResult> DeleteVendor(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync("DELETE FROM public.vendors WHERE id = @id", new { id });
        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    private async Task<IActionResult> UpsertParty(string table, Guid? id, Dictionary<string, object?> body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        if (table == "customers")
        {
            var sql = id is null
                ? """
                  INSERT INTO public.customers (customer_name, company_name, customer_type, phone, email)
                  VALUES (@customer_name, @company_name, @customer_type, @phone, @email)
                  RETURNING *
                  """
                : """
                  UPDATE public.customers
                  SET customer_name = @customer_name,
                      company_name = @company_name,
                      customer_type = @customer_type,
                      phone = @phone,
                      email = @email
                  WHERE id = @id
                  RETURNING *
                  """;
            var row = await connection.QuerySingleOrDefaultAsync(sql, new
            {
                id,
                customer_name = Clean(body, "customer_name"),
                company_name = Clean(body, "company_name"),
                customer_type = Clean(body, "customer_type") ?? "Corporate",
                phone = Clean(body, "phone"),
                email = Clean(body, "email")
            });
            return id is null ? StatusCode(201, ApiResponse<object>.Ok(row)) : Ok(ApiResponse<object>.Ok(row));
        }

        var vendorSql = id is null
            ? """
              INSERT INTO public.vendors (vendor_name, contact_person, phone, email)
              VALUES (@vendor_name, @contact_person, @phone, @email)
              RETURNING *
              """
            : """
              UPDATE public.vendors
              SET vendor_name = @vendor_name,
                  contact_person = @contact_person,
                  phone = @phone,
                  email = @email
              WHERE id = @id
              RETURNING *
              """;
        var vendor = await connection.QuerySingleOrDefaultAsync(vendorSql, new
        {
            id,
            vendor_name = Clean(body, "vendor_name"),
            contact_person = Clean(body, "contact_person"),
            phone = Clean(body, "phone"),
            email = Clean(body, "email")
        });
        return id is null ? StatusCode(201, ApiResponse<object>.Ok(vendor)) : Ok(ApiResponse<object>.Ok(vendor));
    }

    private async Task<object> GetSummary(CancellationToken cancellationToken)
    {
        await EnsurePhaseSchema(cancellationToken);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var products = await connection.QuerySingleAsync("""
            SELECT
              COUNT(*)::int AS total_products,
              COALESCE(SUM(quantity), 0)::int AS product_quantity,
              COUNT(*) FILTER (WHERE product_type = 'ASSET')::int AS assets,
              COUNT(*) FILTER (WHERE product_type = 'CONSUMABLE')::int AS consumables,
              COUNT(*) FILTER (WHERE product_type = 'SERVICE')::int AS services,
              COUNT(*) FILTER (WHERE tracking_type IN ('SERIAL', 'IMEI'))::int AS tracked_products
            FROM public.products
            """);
        var stock = await connection.QuerySingleAsync("""
            SELECT
              COUNT(*)::int AS total_serials,
              COUNT(*) FILTER (WHERE current_status = 'AVAILABLE')::int AS available,
              COUNT(*) FILTER (WHERE current_status = 'ALLOCATED')::int AS allocated,
              COUNT(*) FILTER (WHERE current_status = 'INSTALLED')::int AS installed,
              COUNT(*) FILTER (WHERE current_status = 'RETURNED')::int AS returned,
              COUNT(*) FILTER (WHERE current_status = 'DAMAGED')::int AS damaged
            FROM public.inventory_items
            """);
        var purchase = await connection.QuerySingleAsync("""
            SELECT
              COUNT(*)::int AS purchase_requests,
              COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_pr,
              COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_pr,
              COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_pr,
              (SELECT COUNT(*)::int FROM public.purchase_orders) AS purchase_orders,
              (SELECT COUNT(*)::int FROM public.grns) AS grns
            FROM public.purchase_requests
            """);
        var sales = await connection.QuerySingleAsync("""
            SELECT
              (SELECT COUNT(*)::int FROM public.quotations) AS quotations,
              (SELECT COUNT(*)::int FROM public.delivery_orders) AS delivery_orders,
              (SELECT COUNT(*)::int FROM public.invoices) AS invoices,
              (SELECT COUNT(*)::int FROM public.invoices WHERE approval_status = 'PENDING') AS pending_invoices,
              (SELECT COUNT(*)::int FROM public.invoices WHERE payment_status = 'UNPAID') AS unpaid_invoices,
              (SELECT COUNT(*)::int FROM public.invoices WHERE payment_status = 'PAID') AS paid_invoices,
              (SELECT COALESCE(SUM(total_amount), 0)::numeric FROM public.invoices) AS invoice_value
            """);
        var installations = await connection.QuerySingleAsync("""
            SELECT
              COUNT(*)::int AS installation_requests,
              COUNT(*) FILTER (WHERE status = 'REQUESTED')::int AS requested,
              COUNT(*) FILTER (WHERE status = 'INSTALLED')::int AS installed,
              COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
              COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
            FROM public.tracker_installations
            """);
        var support = await connection.QuerySingleAsync("""
            SELECT
              (SELECT COUNT(*)::int FROM public.customer_complaints) AS complaints,
              (SELECT COUNT(*)::int FROM public.customer_complaints WHERE status IN ('TAKEN', 'PENDING')) AS open_complaints,
              (SELECT COUNT(*)::int FROM public.customer_complaints WHERE status = 'RESOLVED') AS resolved_complaints,
              (SELECT COUNT(*)::int FROM public.item_replacements) AS replacements,
              (SELECT COUNT(*)::int FROM public.customer_vehicles) AS vehicles
            """);
        var parties = await connection.QuerySingleAsync("SELECT (SELECT COUNT(*)::int FROM public.customers) AS customers, (SELECT COUNT(*)::int FROM public.vendors) AS vendors");
        var categories = await connection.QueryAsync("""
            SELECT ic.id, ic.category_name, COUNT(p.id)::int AS products
            FROM public.item_categories ic
            LEFT JOIN public.products p ON p.category_id = ic.id
            GROUP BY ic.id, ic.category_name
            ORDER BY products DESC, ic.category_name ASC
            LIMIT 8
            """);
        var movements = await connection.QueryAsync("""
            SELECT im.id, im.movement_type, im.reference_type, im.remarks, im.created_at, ii.serial_number, p.product_name
            FROM public.inventory_movements im
            LEFT JOIN public.inventory_items ii ON ii.id = im.inventory_item_id
            LEFT JOIN public.products p ON p.id = ii.product_id
            ORDER BY im.created_at DESC
            LIMIT 8
            """);

        return new { products, stock, purchase, sales, installations, support, parties, categories, recent_movements = movements };
    }

    private async Task EnsurePhaseSchema(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await connection.ExecuteAsync("""
            CREATE TABLE IF NOT EXISTS public.customer_vehicles (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
              vehicle_no text NOT NULL,
              vehicle_model text,
              driver_name text,
              driver_phone text,
              created_by uuid REFERENCES public.users(id),
              created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(customer_id, vehicle_no)
            );
            CREATE TABLE IF NOT EXISTS public.tracker_installations (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              request_no text UNIQUE,
              customer_id uuid NOT NULL REFERENCES public.customers(id),
              vehicle_id uuid REFERENCES public.customer_vehicles(id) ON DELETE SET NULL,
              vehicle_no text NOT NULL,
              contact_person text,
              contact_phone text,
              installation_type text DEFAULT 'NEW',
              tracker_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
              installer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
              status text DEFAULT 'REQUESTED',
              po_reference text,
              mapping_notes text,
              welcome_call_notes text,
              billing_notes text,
              remarks text,
              created_by uuid REFERENCES public.users(id),
              created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
              updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
              installed_at timestamptz
            );
            CREATE TABLE IF NOT EXISTS public.customer_complaints (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              ticket_no text UNIQUE,
              customer_id uuid NOT NULL REFERENCES public.customers(id),
              vehicle_no text,
              issue_type text NOT NULL,
              priority text DEFAULT 'MEDIUM',
              status text DEFAULT 'TAKEN',
              assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
              remarks text,
              resolution_notes text,
              created_by uuid REFERENCES public.users(id),
              created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
              updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
              resolved_at timestamptz
            );
            CREATE TABLE IF NOT EXISTS public.item_replacements (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              replacement_no text UNIQUE,
              complaint_id uuid REFERENCES public.customer_complaints(id) ON DELETE SET NULL,
              customer_id uuid NOT NULL REFERENCES public.customers(id),
              vehicle_no text,
              old_inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
              new_inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
              status text DEFAULT 'PENDING',
              remarks text,
              created_by uuid REFERENCES public.users(id),
              created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
              completed_at timestamptz
            );
            """);
    }

    private static int ToLimit(int value, int fallback, int max) => value < 1 ? fallback : Math.Min(value, max);
    private static string? Clean(Dictionary<string, object?> body, string key) => body.TryGetValue(key, out var value) ? value?.ToString()?.Trim() : null;
    private static Guid? GuidValue(Dictionary<string, object?> body, string key) => Guid.TryParse(Clean(body, key), out var id) ? id : null;
    private static int IntValue(Dictionary<string, object?> body, string key, int fallback) => int.TryParse(Clean(body, key), out var value) ? value : fallback;
    private static string Normalize(Dictionary<string, object?> body, string key, string[] allowed, string fallback)
    {
        var value = (Clean(body, key) ?? string.Empty).ToUpperInvariant();
        return allowed.Contains(value) ? value : fallback;
    }
}
