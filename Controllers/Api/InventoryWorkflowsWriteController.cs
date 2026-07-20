using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EMS.Web.Controllers.Api;

public sealed partial class InventoryApiController
{
    [HttpPost("purchase-requests")]
    public async Task<IActionResult> CreatePurchaseRequest([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.DepartmentId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "department_id is required."));
        var items = NormalizeItems(body.Items);
        if (items.Count == 0) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "At least one item is required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var pr = await connection.QuerySingleAsync("""
                INSERT INTO public.purchase_requests (requested_by, department_id, status, approval_remarks)
                VALUES (@UserId, @DepartmentId, 'PENDING', @Remarks)
                RETURNING *
                """, new { current.UserId, body.DepartmentId, body.Remarks }, tx);

            foreach (var item in items)
            {
                var productName = await connection.QuerySingleOrDefaultAsync<string>("SELECT product_name FROM public.products WHERE id = @ProductId", new { item.ProductId }, tx);
                await connection.ExecuteAsync("""
                    INSERT INTO public.purchase_request_items (purchase_request_id, product_id, product_name, quantity, remarks)
                    VALUES (@PurchaseRequestId, @ProductId, @ProductName, @Quantity, @Remarks)
                    """, new { PurchaseRequestId = pr.id, item.ProductId, ProductName = productName ?? item.ProductName, item.Quantity, item.Remarks }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(pr));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("purchase-requests/{id:guid}/approve")]
    public async Task<IActionResult> ApprovePurchaseRequest(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
        => await UpdateSimpleStatus("purchase_requests", id, "APPROVED", body.Remarks ?? "Approved", cancellationToken);

    [HttpPatch("purchase-requests/{id:guid}/reject")]
    public async Task<IActionResult> RejectPurchaseRequest(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
        => await UpdateSimpleStatus("purchase_requests", id, "REJECTED", body.Remarks ?? "Rejected", cancellationToken);

    [HttpPost("purchase-orders")]
    public async Task<IActionResult> CreatePurchaseOrder([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.PurchaseRequestId is null || body.VendorId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "purchase_request_id and vendor_id are required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var pr = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.purchase_requests WHERE id = @Id LIMIT 1", new { Id = body.PurchaseRequestId }, tx);
            if (pr is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Purchase request not found."));
            if (pr.status != "APPROVED") return Conflict(ApiResponse<object>.Fail("PR_NOT_APPROVED", "Approve the purchase request before generating a PO."));

            var prItems = (await connection.QueryAsync("SELECT * FROM public.purchase_request_items WHERE purchase_request_id = @Id", new { Id = body.PurchaseRequestId }, tx)).ToList();
            decimal total = 0;
            foreach (var item in prItems)
            {
                total += Convert.ToDecimal(item.quantity) * UnitPrice(body, item.product_id);
            }
            var po = await connection.QuerySingleAsync("""
                INSERT INTO public.purchase_orders (pr_id, vendor_id, created_by, total_amount)
                VALUES (@PurchaseRequestId, @VendorId, @UserId, @Total)
                RETURNING *
                """, new { body.PurchaseRequestId, body.VendorId, current.UserId, Total = total }, tx);

            foreach (var item in prItems)
            {
                await connection.ExecuteAsync("""
                    INSERT INTO public.purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, remarks)
                    VALUES (@PurchaseOrderId, @ProductId, @ProductName, @Quantity, @UnitPrice, @Remarks)
                    """, new
                {
                    PurchaseOrderId = po.id,
                    ProductId = item.product_id,
                    ProductName = item.product_name,
                    Quantity = item.quantity,
                    UnitPrice = UnitPrice(body, item.product_id),
                    Remarks = item.remarks
                }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(po));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPost("grns")]
    public async Task<IActionResult> CreateGrn([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.PurchaseOrderId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "purchase_order_id is required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var existing = await connection.QuerySingleOrDefaultAsync<Guid?>("SELECT id FROM public.grns WHERE po_id = @Id LIMIT 1", new { Id = body.PurchaseOrderId }, tx);
            if (existing.HasValue) return Conflict(ApiResponse<object>.Fail("GRN_EXISTS", "This purchase order already has a GRN."));
            var grn = await connection.QuerySingleAsync("INSERT INTO public.grns (po_id, received_by) VALUES (@PurchaseOrderId, @UserId) RETURNING *", new { body.PurchaseOrderId, current.UserId }, tx);
            var items = await connection.QueryAsync("""
                SELECT poi.*, p.tracking_type
                FROM public.purchase_order_items poi
                JOIN public.products p ON p.id = poi.product_id
                WHERE poi.purchase_order_id = @Id
                """, new { Id = body.PurchaseOrderId }, tx);
            var prefix = string.IsNullOrWhiteSpace(body.SerialPrefix) ? $"GRN-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}" : body.SerialPrefix;
            foreach (var item in items)
            {
                var qty = Convert.ToInt32(item.quantity);
                await connection.ExecuteAsync("""
                    INSERT INTO public.grn_items (grn_id, product_id, product_name, quantity_received, remarks)
                    VALUES (@GrnId, @ProductId, @ProductName, @Quantity, @Remarks)
                    """, new { GrnId = grn.id, ProductId = item.product_id, ProductName = item.product_name, Quantity = qty, Remarks = item.remarks }, tx);
                await connection.ExecuteAsync("UPDATE public.products SET quantity = COALESCE(quantity, 0) + @Qty WHERE id = @ProductId", new { Qty = qty, ProductId = item.product_id }, tx);

                if (item.tracking_type == "SERIAL" || item.tracking_type == "IMEI")
                {
                    for (var i = 0; i < qty; i++)
                    {
                        var serialNumber = $"{prefix}-{(i + 1).ToString().PadLeft(3, '0')}-{item.product_id.ToString()[..6]}";
                        var inv = await connection.QuerySingleAsync("INSERT INTO public.inventory_items (product_id, serial_number, current_status) VALUES (@ProductId, @SerialNumber, 'AVAILABLE') RETURNING id", new { ProductId = item.product_id, SerialNumber = serialNumber }, tx);
                        await connection.ExecuteAsync("INSERT INTO public.inventory_movements (inventory_item_id, movement_type, reference_type, reference_id, moved_by, remarks) VALUES (@ItemId, 'STOCK_IN', 'GRN', @GrnId, @UserId, @Remarks)", new { ItemId = inv.id, GrnId = grn.id, current.UserId, Remarks = $"Received via GRN" }, tx);
                    }
                }
                else
                {
                    await connection.ExecuteAsync("INSERT INTO public.inventory_movements (inventory_item_id, movement_type, reference_type, reference_id, moved_by, remarks) VALUES (NULL, 'STOCK_IN', 'GRN', @GrnId, @UserId, @Remarks)", new { GrnId = grn.id, current.UserId, Remarks = $"Received {qty} {item.product_name}" }, tx);
                }
            }
            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(grn));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPost("quotations")]
    public async Task<IActionResult> CreateQuotation([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.CustomerId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "customer_id is required."));
        var items = NormalizeItems(body.Items);
        if (items.Count == 0) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "At least one item is required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var total = items.Sum(item => item.Quantity * item.UnitPrice);
            var quotation = await connection.QuerySingleAsync("""
                INSERT INTO public.quotations (customer_id, status, created_by, approval_remarks, total_amount)
                VALUES (@CustomerId, 'DRAFT', @UserId, @Remarks, @Total)
                RETURNING *
                """, new { body.CustomerId, current.UserId, body.Remarks, Total = total }, tx);

            foreach (var item in items)
            {
                if (item.ProductId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "product_id is required for quotation items."));
                await connection.ExecuteAsync("""
                    INSERT INTO public.quotation_items (quotation_id, quantity, unit_price, product_id)
                    VALUES (@QuotationId, @Quantity, @UnitPrice, @ProductId)
                    """, new { QuotationId = quotation.id, item.Quantity, item.UnitPrice, item.ProductId }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(quotation));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("quotations/{id:guid}/approve")]
    public async Task<IActionResult> ApproveQuotation(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
        => await UpdateSimpleStatus("quotations", id, "APPROVED", body.Remarks ?? "Approved by client/finance", cancellationToken);

    [HttpPatch("quotations/{id:guid}/reject")]
    public async Task<IActionResult> RejectQuotation(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
        => await UpdateSimpleStatus("quotations", id, "REJECTED", body.Remarks ?? "Rejected", cancellationToken);

    [HttpPost("delivery-orders")]
    public async Task<IActionResult> CreateDeliveryOrder([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.QuotationId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "quotation_id is required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var quotation = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.quotations WHERE id = @Id LIMIT 1", new { Id = body.QuotationId }, tx);
            if (quotation is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Quotation not found."));
            if (quotation.status != "APPROVED") return Conflict(ApiResponse<object>.Fail("QUOTE_NOT_APPROVED", "Approve the quotation before creating a delivery order."));

            var existing = await connection.QuerySingleOrDefaultAsync<Guid?>("SELECT id FROM public.delivery_orders WHERE quotation_id = @Id LIMIT 1", new { Id = body.QuotationId }, tx);
            if (existing.HasValue) return Conflict(ApiResponse<object>.Fail("DELIVERY_EXISTS", "Delivery order already exists for this quotation."));

            var order = await connection.QuerySingleAsync("""
                INSERT INTO public.delivery_orders (issued_to_type, issued_to_id, issued_by, status, quotation_id, approval_remarks)
                VALUES ('CUSTOMER', @CustomerId, @UserId, 'PENDING', @QuotationId, @Remarks)
                RETURNING *
                """, new { CustomerId = quotation.customer_id, current.UserId, body.QuotationId, body.Remarks }, tx);

            var items = await connection.QueryAsync("""
                SELECT qi.*, p.product_name
                FROM public.quotation_items qi
                JOIN public.products p ON p.id = qi.product_id
                WHERE qi.quotation_id = @QuotationId
                """, new { body.QuotationId }, tx);

            foreach (var item in items)
            {
                await connection.ExecuteAsync("""
                    INSERT INTO public.delivery_order_items (delivery_order_id, product_name, quantity, remarks, product_id)
                    VALUES (@DeliveryOrderId, @ProductName, @Quantity, @Remarks, @ProductId)
                    """, new
                {
                    DeliveryOrderId = order.id,
                    ProductName = item.product_name,
                    Quantity = item.quantity,
                    body.Remarks,
                    ProductId = item.product_id
                }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(order));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("delivery-orders/{id:guid}/approve")]
    public async Task<IActionResult> ApproveDeliveryOrder(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var order = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.delivery_orders WHERE id = @Id LIMIT 1", new { Id = id }, tx);
            if (order is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Delivery order not found."));
            if (order.status == "APPROVED") return Conflict(ApiResponse<object>.Fail("ALREADY_APPROVED", "Delivery order is already approved."));

            var items = await connection.QueryAsync("SELECT * FROM public.delivery_order_items WHERE delivery_order_id = @Id", new { Id = id }, tx);
            foreach (var item in items)
            {
                var product = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.products WHERE id = @ProductId LIMIT 1", new { ProductId = item.product_id }, tx);
                if (product is null) return NotFound(ApiResponse<object>.Fail("PRODUCT_NOT_FOUND", $"Product not found for {item.product_name}."));
                var qty = Math.Max(1, Convert.ToInt32(item.quantity));
                if (Convert.ToInt32(product.quantity ?? 0) < qty) return Conflict(ApiResponse<object>.Fail("INSUFFICIENT_STOCK", $"{product.product_name} has insufficient stock."));

                await connection.ExecuteAsync("UPDATE public.products SET quantity = COALESCE(quantity, 0) - @Qty WHERE id = @ProductId", new { Qty = qty, ProductId = item.product_id }, tx);
                if (product.tracking_type == "SERIAL" || product.tracking_type == "IMEI")
                {
                    var serials = (await connection.QueryAsync<Guid>("""
                        SELECT id
                        FROM public.inventory_items
                        WHERE product_id = @ProductId AND current_status = 'AVAILABLE'
                        ORDER BY created_at ASC
                        LIMIT @Qty
                        """, new { ProductId = item.product_id, Qty = qty }, tx)).ToList();
                    if (serials.Count < qty) return Conflict(ApiResponse<object>.Fail("INSUFFICIENT_SERIALS", $"{product.product_name} does not have enough available serials."));

                    foreach (var serialId in serials)
                    {
                        await connection.ExecuteAsync("UPDATE public.inventory_items SET current_status = 'ALLOCATED' WHERE id = @SerialId", new { SerialId = serialId }, tx);
                        await connection.ExecuteAsync("""
                            INSERT INTO public.inventory_movements (inventory_item_id, movement_type, reference_type, reference_id, moved_by, remarks)
                            VALUES (@SerialId, 'STOCK_OUT', 'DELIVERY_ORDER', @OrderId, @UserId, @Remarks)
                            """, new { SerialId = serialId, OrderId = id, current.UserId, Remarks = $"Allocated for {order.do_id ?? "delivery order"}" }, tx);
                    }
                }
                else
                {
                    await connection.ExecuteAsync("""
                        INSERT INTO public.inventory_movements (inventory_item_id, movement_type, reference_type, reference_id, moved_by, remarks)
                        VALUES (NULL, 'STOCK_OUT', 'DELIVERY_ORDER', @OrderId, @UserId, @Remarks)
                        """, new { OrderId = id, current.UserId, Remarks = $"Issued {qty} {product.product_name}" }, tx);
                }
            }

            var row = await connection.QuerySingleAsync("""
                UPDATE public.delivery_orders
                SET status = 'APPROVED',
                    approved_by = @UserId,
                    approved_at = now(),
                    approval_remarks = @Remarks
                WHERE id = @Id
                RETURNING *
                """, new { Id = id, current.UserId, Remarks = body.Remarks ?? "Stock allocated" }, tx);
            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("delivery-orders/{id:guid}/reject")]
    public async Task<IActionResult> RejectDeliveryOrder(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
        => await UpdateSimpleStatus("delivery_orders", id, "REJECTED", body.Remarks ?? "Rejected", cancellationToken);

    [HttpPost("invoices")]
    public async Task<IActionResult> CreateInvoice([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.QuotationId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "quotation_id is required."));

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var quotation = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.quotations WHERE id = @Id LIMIT 1", new { Id = body.QuotationId }, tx);
            if (quotation is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Quotation not found."));
            if (quotation.status != "APPROVED") return Conflict(ApiResponse<object>.Fail("QUOTE_NOT_APPROVED", "Approve the quotation before creating an invoice."));

            var existing = await connection.QuerySingleOrDefaultAsync<Guid?>("SELECT id FROM public.invoices WHERE quotation_id = @Id LIMIT 1", new { Id = body.QuotationId }, tx);
            if (existing.HasValue) return Conflict(ApiResponse<object>.Fail("INVOICE_EXISTS", "Invoice already exists for this quotation."));

            var invoice = await connection.QuerySingleAsync("""
                INSERT INTO public.invoices (quotation_id, created_by, total_amount, payment_status, remarks, approval_status)
                VALUES (@QuotationId, @UserId, @Total, 'UNPAID', @Remarks, 'PENDING')
                RETURNING *
                """, new { body.QuotationId, current.UserId, Total = quotation.total_amount ?? 0, body.Remarks }, tx);

            var items = await connection.QueryAsync("SELECT * FROM public.quotation_items WHERE quotation_id = @QuotationId", new { body.QuotationId }, tx);
            foreach (var item in items)
            {
                await connection.ExecuteAsync("""
                    INSERT INTO public.invoice_items (invoice_id, product_id, quantity, unit_price)
                    VALUES (@InvoiceId, @ProductId, @Quantity, @UnitPrice)
                    """, new { InvoiceId = invoice.id, ProductId = item.product_id, Quantity = item.quantity, UnitPrice = item.unit_price }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(invoice));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("invoices/{id:guid}/approve")]
    public async Task<IActionResult> ApproveInvoice(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
        => await UpdateInvoiceStatus(id, "APPROVED", body.Remarks, cancellationToken);

    [HttpPatch("invoices/{id:guid}/reject")]
    public async Task<IActionResult> RejectInvoice(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
        => await UpdateInvoiceStatus(id, "REJECTED", body.Remarks ?? "Rejected", cancellationToken);

    [HttpPatch("invoices/{id:guid}/mark-paid")]
    public async Task<IActionResult> MarkInvoicePaid(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.invoices
            SET payment_status = 'PAID',
                remarks = COALESCE(@Remarks, remarks)
            WHERE id = @Id
            RETURNING *
            """, new { Id = id, Remarks = body.Remarks ?? "Payment received" });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Invoice not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPost("installations")]
    public async Task<IActionResult> CreateInstallation([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.CustomerId is null || string.IsNullOrWhiteSpace(body.VehicleNo)) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "customer_id and vehicle_no are required."));
        await EnsurePhaseSchema(cancellationToken);

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var vehicleId = await connection.QuerySingleAsync<Guid>("""
                INSERT INTO public.customer_vehicles (customer_id, vehicle_no, vehicle_model, driver_name, driver_phone, created_by)
                VALUES (@CustomerId, @VehicleNo, @VehicleModel, @DriverName, @DriverPhone, @UserId)
                ON CONFLICT (customer_id, vehicle_no)
                DO UPDATE SET
                  vehicle_model = COALESCE(EXCLUDED.vehicle_model, public.customer_vehicles.vehicle_model),
                  driver_name = COALESCE(EXCLUDED.driver_name, public.customer_vehicles.driver_name),
                  driver_phone = COALESCE(EXCLUDED.driver_phone, public.customer_vehicles.driver_phone)
                RETURNING id
                """, new { body.CustomerId, body.VehicleNo, body.VehicleModel, body.DriverName, body.DriverPhone, current.UserId }, tx);

            var row = await connection.QuerySingleAsync("""
                INSERT INTO public.tracker_installations (request_no, customer_id, vehicle_id, vehicle_no, contact_person, contact_phone, installation_type, status, po_reference, remarks, created_by)
                VALUES (@RequestNo, @CustomerId, @VehicleId, @VehicleNo, @ContactPerson, @ContactPhone, @InstallationType, 'REQUESTED', @PoReference, @Remarks, @UserId)
                RETURNING *
                """, new
            {
                RequestNo = WorkflowNo("INS"),
                body.CustomerId,
                VehicleId = vehicleId,
                body.VehicleNo,
                body.ContactPerson,
                body.ContactPhone,
                InstallationType = string.IsNullOrWhiteSpace(body.InstallationType) ? "NEW" : body.InstallationType,
                body.PoReference,
                body.Remarks,
                current.UserId
            }, tx);
            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("installations/{id:guid}/assign-tracker")]
    public async Task<IActionResult> AssignTracker(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.TrackerItemId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "tracker_item_id is required."));
        await EnsurePhaseSchema(cancellationToken);

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var installation = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.tracker_installations WHERE id = @Id LIMIT 1", new { Id = id }, tx);
            if (installation is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Installation request not found."));
            if (installation.status == "COMPLETED" || installation.status == "CANCELLED") return Conflict(ApiResponse<object>.Fail("INSTALLATION_CLOSED", "This installation request is already closed."));

            var serial = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.inventory_items WHERE id = @Id LIMIT 1", new { Id = body.TrackerItemId }, tx);
            if (serial is null) return NotFound(ApiResponse<object>.Fail("TRACKER_NOT_FOUND", "Tracker serial not found."));
            if (serial.current_status != "AVAILABLE" && serial.current_status != "ALLOCATED") return Conflict(ApiResponse<object>.Fail("TRACKER_NOT_AVAILABLE", "Selected tracker is not available for installation."));

            await connection.ExecuteAsync("UPDATE public.inventory_items SET current_status = 'INSTALLED' WHERE id = @Id", new { Id = body.TrackerItemId }, tx);
            await connection.ExecuteAsync("""
                INSERT INTO public.inventory_movements (inventory_item_id, movement_type, reference_type, reference_id, moved_by, remarks)
                VALUES (@TrackerItemId, 'TRANSFER', 'TRACKER_INSTALLATION', @InstallationId, @UserId, @Remarks)
                """, new { body.TrackerItemId, InstallationId = id, current.UserId, Remarks = body.Remarks ?? $"Tracker assigned to vehicle {installation.vehicle_no}" }, tx);

            var row = await connection.QuerySingleAsync("""
                UPDATE public.tracker_installations
                SET tracker_item_id = @TrackerItemId,
                    installer_id = COALESCE(@InstallerId, installer_id),
                    status = 'INSTALLED',
                    mapping_notes = COALESCE(@MappingNotes, mapping_notes),
                    remarks = COALESCE(@Remarks, remarks),
                    updated_at = now(),
                    installed_at = now()
                WHERE id = @Id
                RETURNING *
                """, new { Id = id, body.TrackerItemId, body.InstallerId, body.MappingNotes, body.Remarks }, tx);
            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPatch("installations/{id:guid}/complete")]
    public async Task<IActionResult> CompleteInstallation(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        await EnsurePhaseSchema(cancellationToken);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.tracker_installations
            SET status = 'COMPLETED',
                welcome_call_notes = COALESCE(@WelcomeCallNotes, welcome_call_notes),
                billing_notes = COALESCE(@BillingNotes, billing_notes),
                remarks = COALESCE(@Remarks, remarks),
                updated_at = now()
            WHERE id = @Id
            RETURNING *
            """, new { Id = id, WelcomeCallNotes = body.WelcomeCallNotes ?? "Welcome call recorded", BillingNotes = body.BillingNotes ?? "Billing setup ready", body.Remarks });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Installation request not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPatch("installations/{id:guid}/cancel")]
    public async Task<IActionResult> CancelInstallation(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        await EnsurePhaseSchema(cancellationToken);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var installation = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.tracker_installations WHERE id = @Id LIMIT 1", new { Id = id }, tx);
            if (installation is null) return NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Installation request not found."));
            if (installation.tracker_item_id is not null) await connection.ExecuteAsync("UPDATE public.inventory_items SET current_status = 'AVAILABLE' WHERE id = @Id", new { Id = installation.tracker_item_id }, tx);
            var row = await connection.QuerySingleAsync("""
                UPDATE public.tracker_installations
                SET status = 'CANCELLED',
                    remarks = COALESCE(@Remarks, remarks),
                    updated_at = now()
                WHERE id = @Id
                RETURNING *
                """, new { Id = id, Remarks = body.Remarks ?? "Installation cancelled" }, tx);
            await tx.CommitAsync(cancellationToken);
            return Ok(ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [HttpPost("complaints")]
    public async Task<IActionResult> CreateComplaint([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.CustomerId is null || string.IsNullOrWhiteSpace(body.IssueType)) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "customer_id and issue_type are required."));
        await EnsurePhaseSchema(cancellationToken);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleAsync("""
            INSERT INTO public.customer_complaints (ticket_no, customer_id, vehicle_no, issue_type, priority, status, remarks, created_by)
            VALUES (@TicketNo, @CustomerId, @VehicleNo, @IssueType, @Priority, @Status, @Remarks, @UserId)
            RETURNING *
            """, new
        {
            TicketNo = WorkflowNo("CMP"),
            body.CustomerId,
            body.VehicleNo,
            body.IssueType,
            Priority = string.IsNullOrWhiteSpace(body.Priority) ? "MEDIUM" : body.Priority.ToUpperInvariant(),
            Status = NormalizeComplaintStatus(body.Status),
            body.Remarks,
            current.UserId
        });
        return StatusCode(201, ApiResponse<object>.Ok(row));
    }

    [HttpPatch("complaints/{id:guid}/resolve")]
    public async Task<IActionResult> ResolveComplaint(Guid id, [FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        await EnsurePhaseSchema(cancellationToken);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.customer_complaints
            SET status = 'RESOLVED',
                resolution_notes = @Resolution,
                updated_at = now(),
                resolved_at = now()
            WHERE id = @Id
            RETURNING *
            """, new { Id = id, Resolution = body.ResolutionNotes ?? body.Remarks ?? "Resolved" });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Complaint not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    [HttpPost("replacements")]
    public async Task<IActionResult> CreateReplacement([FromBody] WorkflowPayload body, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        if (body.CustomerId is null || body.NewInventoryItemId is null) return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "customer_id and new_inventory_item_id are required."));
        await EnsurePhaseSchema(cancellationToken);

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var tx = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            var newSerial = await connection.QuerySingleOrDefaultAsync("SELECT * FROM public.inventory_items WHERE id = @Id LIMIT 1", new { Id = body.NewInventoryItemId }, tx);
            if (newSerial is null) return NotFound(ApiResponse<object>.Fail("NEW_SERIAL_NOT_FOUND", "New tracker serial not found."));
            if (newSerial.current_status != "AVAILABLE" && newSerial.current_status != "ALLOCATED") return Conflict(ApiResponse<object>.Fail("NEW_SERIAL_NOT_AVAILABLE", "New tracker serial is not available for replacement."));

            await connection.ExecuteAsync("UPDATE public.inventory_items SET current_status = 'INSTALLED' WHERE id = @Id", new { Id = body.NewInventoryItemId }, tx);
            if (body.OldInventoryItemId is not null) await connection.ExecuteAsync("UPDATE public.inventory_items SET current_status = 'RETURNED' WHERE id = @Id", new { Id = body.OldInventoryItemId }, tx);

            var status = NormalizeReplacementStatus(body.Status ?? "REPLACED");
            var row = await connection.QuerySingleAsync("""
                INSERT INTO public.item_replacements (replacement_no, complaint_id, customer_id, vehicle_no, old_inventory_item_id, new_inventory_item_id, status, remarks, created_by, completed_at)
                VALUES (@ReplacementNo, @ComplaintId, @CustomerId, @VehicleNo, @OldInventoryItemId, @NewInventoryItemId, @Status, @Remarks, @UserId, CASE WHEN @Status = 'REPLACED' THEN now() ELSE NULL END)
                RETURNING *
                """, new
            {
                ReplacementNo = WorkflowNo("REP"),
                body.ComplaintId,
                body.CustomerId,
                body.VehicleNo,
                body.OldInventoryItemId,
                body.NewInventoryItemId,
                Status = status,
                body.Remarks,
                current.UserId
            }, tx);

            await connection.ExecuteAsync("""
                INSERT INTO public.inventory_movements (inventory_item_id, movement_type, reference_type, reference_id, moved_by, remarks)
                VALUES (@NewInventoryItemId, 'TRANSFER', 'ITEM_REPLACEMENT', @ReplacementId, @UserId, @Remarks)
                """, new { body.NewInventoryItemId, ReplacementId = row.id, current.UserId, Remarks = body.Remarks ?? "Tracker replacement completed" }, tx);

            if (body.ComplaintId is not null)
            {
                await connection.ExecuteAsync("""
                    UPDATE public.customer_complaints
                    SET status = 'RESOLVED',
                        resolution_notes = COALESCE(@Remarks, resolution_notes),
                        updated_at = now(),
                        resolved_at = now()
                    WHERE id = @ComplaintId
                    """, new { body.ComplaintId, Remarks = body.Remarks ?? "Resolved through item replacement" }, tx);
            }

            await tx.CommitAsync(cancellationToken);
            return StatusCode(201, ApiResponse<object>.Ok(row));
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<IActionResult> UpdateSimpleStatus(string table, Guid id, string status, string remarks, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var sql = table switch
        {
            "purchase_requests" => "UPDATE public.purchase_requests SET status = @Status, approved_by = @UserId, approved_at = now(), approval_remarks = @Remarks WHERE id = @Id RETURNING *",
            "quotations" => "UPDATE public.quotations SET status = @Status, approved_by = @UserId, approved_at = now(), approval_remarks = @Remarks WHERE id = @Id RETURNING *",
            "delivery_orders" => "UPDATE public.delivery_orders SET status = @Status, approved_by = @UserId, approved_at = now(), approval_remarks = @Remarks WHERE id = @Id RETURNING *",
            _ => throw new InvalidOperationException("Unsupported table.")
        };
        var row = await connection.QuerySingleOrDefaultAsync(sql, new { Id = id, Status = status, current.UserId, Remarks = remarks });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Record not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    private async Task<IActionResult> UpdateInvoiceStatus(Guid id, string status, string? remarks, CancellationToken cancellationToken)
    {
        var current = CurrentUser.FromPrincipal(User);
        if (current is null) return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required."));
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var row = await connection.QuerySingleOrDefaultAsync("""
            UPDATE public.invoices
            SET approval_status = @Status,
                approved_by = @UserId,
                approved_at = now(),
                remarks = COALESCE(@Remarks, remarks)
            WHERE id = @Id
            RETURNING *
            """, new { Id = id, Status = status, current.UserId, Remarks = remarks });
        return row is null ? NotFound(ApiResponse<object>.Fail("NOT_FOUND", "Invoice not found.")) : Ok(ApiResponse<object>.Ok(row));
    }

    private static List<WorkflowItem> NormalizeItems(List<WorkflowItem>? items)
        => (items ?? [])
            .Where(item => item.ProductId is not null || !string.IsNullOrWhiteSpace(item.ProductName))
            .Select(item => item with
            {
                ProductName = string.IsNullOrWhiteSpace(item.ProductName) ? null : item.ProductName.Trim(),
                Quantity = Math.Max(1, item.Quantity),
                UnitPrice = Math.Max(0, item.UnitPrice),
                Remarks = string.IsNullOrWhiteSpace(item.Remarks) ? null : item.Remarks.Trim()
            })
            .ToList();

    private static decimal UnitPrice(WorkflowPayload body, object productId)
    {
        var key = Convert.ToString(productId) ?? string.Empty;
        if (body.UnitPrices is not null && body.UnitPrices.TryGetValue(key, out var price)) return Math.Max(0, price);
        var itemPrice = body.Items?.FirstOrDefault(item => Convert.ToString(item.ProductId) == key)?.UnitPrice ?? 0;
        return Math.Max(0, itemPrice);
    }

    private static string WorkflowNo(string prefix) => $"{prefix}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

    private static string NormalizeComplaintStatus(string? value)
    {
        var status = (value ?? "TAKEN").Trim().ToUpperInvariant();
        return status is "TAKEN" or "RESOLVED" or "PENDING" ? status : "TAKEN";
    }

    private static string NormalizeReplacementStatus(string? value)
    {
        var status = (value ?? "REPLACED").Trim().ToUpperInvariant();
        return status is "PENDING" or "REPLACED" ? status : "REPLACED";
    }
}

public sealed record WorkflowItem(
    [property: System.Text.Json.Serialization.JsonPropertyName("product_id")] Guid? ProductId,
    [property: System.Text.Json.Serialization.JsonPropertyName("product_name")] string? ProductName,
    [property: System.Text.Json.Serialization.JsonPropertyName("quantity")] int Quantity = 1,
    [property: System.Text.Json.Serialization.JsonPropertyName("unit_price")] decimal UnitPrice = 0,
    [property: System.Text.Json.Serialization.JsonPropertyName("remarks")] string? Remarks = null
);

public sealed record WorkflowPayload(
    [property: System.Text.Json.Serialization.JsonPropertyName("department_id")] Guid? DepartmentId,
    [property: System.Text.Json.Serialization.JsonPropertyName("purchase_request_id")] Guid? PurchaseRequestId,
    [property: System.Text.Json.Serialization.JsonPropertyName("purchase_order_id")] Guid? PurchaseOrderId,
    [property: System.Text.Json.Serialization.JsonPropertyName("vendor_id")] Guid? VendorId,
    [property: System.Text.Json.Serialization.JsonPropertyName("customer_id")] Guid? CustomerId,
    [property: System.Text.Json.Serialization.JsonPropertyName("quotation_id")] Guid? QuotationId,
    [property: System.Text.Json.Serialization.JsonPropertyName("tracker_item_id")] Guid? TrackerItemId,
    [property: System.Text.Json.Serialization.JsonPropertyName("new_inventory_item_id")] Guid? NewInventoryItemId,
    [property: System.Text.Json.Serialization.JsonPropertyName("old_inventory_item_id")] Guid? OldInventoryItemId,
    [property: System.Text.Json.Serialization.JsonPropertyName("complaint_id")] Guid? ComplaintId,
    [property: System.Text.Json.Serialization.JsonPropertyName("vehicle_no")] string? VehicleNo,
    [property: System.Text.Json.Serialization.JsonPropertyName("vehicle_model")] string? VehicleModel,
    [property: System.Text.Json.Serialization.JsonPropertyName("driver_name")] string? DriverName,
    [property: System.Text.Json.Serialization.JsonPropertyName("driver_phone")] string? DriverPhone,
    [property: System.Text.Json.Serialization.JsonPropertyName("contact_person")] string? ContactPerson,
    [property: System.Text.Json.Serialization.JsonPropertyName("contact_phone")] string? ContactPhone,
    [property: System.Text.Json.Serialization.JsonPropertyName("installer_id")] Guid? InstallerId,
    [property: System.Text.Json.Serialization.JsonPropertyName("installation_type")] string? InstallationType,
    [property: System.Text.Json.Serialization.JsonPropertyName("po_reference")] string? PoReference,
    [property: System.Text.Json.Serialization.JsonPropertyName("mapping_notes")] string? MappingNotes,
    [property: System.Text.Json.Serialization.JsonPropertyName("welcome_call_notes")] string? WelcomeCallNotes,
    [property: System.Text.Json.Serialization.JsonPropertyName("billing_notes")] string? BillingNotes,
    [property: System.Text.Json.Serialization.JsonPropertyName("issue_type")] string? IssueType,
    [property: System.Text.Json.Serialization.JsonPropertyName("priority")] string? Priority,
    [property: System.Text.Json.Serialization.JsonPropertyName("resolution_notes")] string? ResolutionNotes,
    [property: System.Text.Json.Serialization.JsonPropertyName("status")] string? Status,
    [property: System.Text.Json.Serialization.JsonPropertyName("serial_prefix")] string? SerialPrefix,
    [property: System.Text.Json.Serialization.JsonPropertyName("remarks")] string? Remarks,
    [property: System.Text.Json.Serialization.JsonPropertyName("items")] List<WorkflowItem>? Items,
    [property: System.Text.Json.Serialization.JsonPropertyName("unit_prices")] Dictionary<string, decimal>? UnitPrices
);
