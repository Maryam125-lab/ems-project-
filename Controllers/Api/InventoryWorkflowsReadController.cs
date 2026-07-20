using Dapper;
using EMS.Web.Backend;
using Microsoft.AspNetCore.Mvc;

namespace EMS.Web.Controllers.Api;

public sealed partial class InventoryApiController
{
    [HttpGet("purchase-flow")]
    public async Task<IActionResult> PurchaseFlow(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT
              pr.id,
              pr.pr_id,
              pr.status,
              pr.created_at,
              pr.approval_remarks,
              dep.department_name,
              u.email AS requested_by_name,
              COALESCE(items.item_count, 0)::int AS item_count,
              COALESCE(items.requested_qty, 0)::int AS requested_qty,
              COALESCE(items.items, '[]'::json) AS items,
              po.id AS purchase_order_db_id,
              po.po_id,
              po.total_amount AS po_amount,
              g.id AS grn_db_id,
              g.grn_id
            FROM public.purchase_requests pr
            LEFT JOIN public.departments dep ON dep.id = pr.department_id
            LEFT JOIN public.users u ON u.id = pr.requested_by
            LEFT JOIN LATERAL (
              SELECT
                COUNT(pri.id)::int AS item_count,
                COALESCE(SUM(pri.quantity), 0)::int AS requested_qty,
                json_agg(json_build_object(
                  'product_id', pri.product_id,
                  'product_name', pri.product_name,
                  'quantity', pri.quantity,
                  'remarks', pri.remarks
                ) ORDER BY pri.id) AS items
              FROM public.purchase_request_items pri
              WHERE pri.purchase_request_id = pr.id
            ) items ON true
            LEFT JOIN public.purchase_orders po ON po.pr_id = pr.id
            LEFT JOIN public.grns g ON g.po_id = po.id
            ORDER BY pr.created_at DESC
            LIMIT 20
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("purchase-orders")]
    public async Task<IActionResult> PurchaseOrders(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT
              po.id,
              po.po_id,
              po.pr_id,
              po.vendor_id,
              po.total_amount,
              po.created_at,
              v.vendor_name,
              pr.pr_id AS purchase_request_no,
              COUNT(poi.id)::int AS item_count,
              COALESCE(SUM(poi.quantity), 0)::int AS total_qty,
              g.grn_id
            FROM public.purchase_orders po
            LEFT JOIN public.vendors v ON v.id = po.vendor_id
            LEFT JOIN public.purchase_requests pr ON pr.id = po.pr_id
            LEFT JOIN public.purchase_order_items poi ON poi.purchase_order_id = po.id
            LEFT JOIN public.grns g ON g.po_id = po.id
            GROUP BY po.id, v.vendor_name, pr.pr_id, g.grn_id
            ORDER BY po.created_at DESC
            LIMIT 30
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("sales-flow")]
    public async Task<IActionResult> SalesFlow(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT
              q.id,
              q.quotation_id,
              q.status AS quotation_status,
              q.total_amount AS quotation_amount,
              q.created_at,
              c.customer_name,
              c.company_name,
              inv.invoice_id,
              inv.id AS invoice_db_id,
              inv.payment_status,
              inv.approval_status,
              inv.total_amount AS invoice_amount,
              doo.do_id,
              doo.id AS delivery_db_id,
              doo.status AS delivery_status
            FROM public.quotations q
            LEFT JOIN public.customers c ON c.id = q.customer_id
            LEFT JOIN public.invoices inv ON inv.quotation_id = q.id
            LEFT JOIN public.delivery_orders doo ON doo.quotation_id = q.id
            ORDER BY q.created_at DESC
            LIMIT 20
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("invoice-ledger")]
    public async Task<IActionResult> InvoiceLedger(CancellationToken cancellationToken)
    {
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT *
            FROM (
              SELECT
                po.id,
                'INBOUND'::text AS invoice_direction,
                COALESCE(g.grn_id, po.po_id) AS invoice_no,
                po.po_id AS reference_no,
                v.vendor_name AS party_name,
                'Purchase / Stock-In'::text AS invoice_type,
                CASE WHEN g.id IS NOT NULL THEN 'received' ELSE 'pending_grn' END AS workflow_status,
                CASE WHEN g.id IS NOT NULL THEN 'approved' ELSE 'pending' END AS approval_status,
                'payable'::text AS payment_status,
                po.total_amount,
                po.created_at
              FROM public.purchase_orders po
              LEFT JOIN public.vendors v ON v.id = po.vendor_id
              LEFT JOIN public.grns g ON g.po_id = po.id

              UNION ALL

              SELECT
                inv.id,
                'OUTBOUND'::text AS invoice_direction,
                inv.invoice_id AS invoice_no,
                q.quotation_id AS reference_no,
                c.customer_name AS party_name,
                'Sales / Stock-Out'::text AS invoice_type,
                COALESCE(doo.status, 'invoice_created') AS workflow_status,
                inv.approval_status,
                inv.payment_status,
                inv.total_amount,
                inv.created_at
              FROM public.invoices inv
              LEFT JOIN public.quotations q ON q.id = inv.quotation_id
              LEFT JOIN public.customers c ON c.id = q.customer_id
              LEFT JOIN public.delivery_orders doo ON doo.quotation_id = q.id
            ) ledger
            ORDER BY created_at DESC
            LIMIT 100
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("installation-flow")]
    public async Task<IActionResult> InstallationFlow(CancellationToken cancellationToken)
    {
        await EnsurePhaseSchema(cancellationToken);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var rows = await connection.QueryAsync("""
            SELECT
              ti.id,
              ti.request_no,
              ti.customer_id,
              ti.vehicle_no,
              ti.contact_person,
              ti.contact_phone,
              ti.installation_type,
              ti.status,
              ti.po_reference,
              ti.mapping_notes,
              ti.welcome_call_notes,
              ti.billing_notes,
              ti.remarks,
              ti.created_at,
              ti.installed_at,
              c.customer_name,
              c.company_name,
              ii.id AS tracker_item_id,
              ii.serial_number AS tracker_serial,
              p.product_name AS tracker_product,
              u.email AS installer_name
            FROM public.tracker_installations ti
            LEFT JOIN public.customers c ON c.id = ti.customer_id
            LEFT JOIN public.inventory_items ii ON ii.id = ti.tracker_item_id
            LEFT JOIN public.products p ON p.id = ii.product_id
            LEFT JOIN public.users u ON u.id = ti.installer_id
            ORDER BY ti.created_at DESC
            LIMIT 30
            """);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("support-flow")]
    public async Task<IActionResult> SupportFlow(CancellationToken cancellationToken)
    {
        await EnsurePhaseSchema(cancellationToken);
        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        var complaints = await connection.QueryAsync("""
            SELECT
              cc.id,
              cc.ticket_no,
              cc.customer_id,
              cc.vehicle_no,
              cc.issue_type,
              cc.priority,
              cc.status,
              cc.remarks,
              cc.resolution_notes,
              cc.created_at,
              cc.resolved_at,
              c.customer_name,
              c.company_name
            FROM public.customer_complaints cc
            LEFT JOIN public.customers c ON c.id = cc.customer_id
            ORDER BY cc.created_at DESC
            LIMIT 30
            """);
        var replacements = await connection.QueryAsync("""
            SELECT
              ir.id,
              ir.replacement_no,
              ir.complaint_id,
              ir.customer_id,
              ir.vehicle_no,
              ir.status,
              ir.remarks,
              ir.created_at,
              ir.completed_at,
              c.customer_name,
              old_item.serial_number AS old_serial,
              new_item.serial_number AS new_serial
            FROM public.item_replacements ir
            LEFT JOIN public.customers c ON c.id = ir.customer_id
            LEFT JOIN public.inventory_items old_item ON old_item.id = ir.old_inventory_item_id
            LEFT JOIN public.inventory_items new_item ON new_item.id = ir.new_inventory_item_id
            ORDER BY ir.created_at DESC
            LIMIT 30
            """);
        return Ok(ApiResponse<object>.Ok(new { complaints, replacements }));
    }
}
