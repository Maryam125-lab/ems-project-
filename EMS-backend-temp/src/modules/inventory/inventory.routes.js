import { Router } from 'express';
import pool from '../../config/db.js';
import { verifyToken } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/respond.js';
import { AppError } from '../../utils/errors.js';

const router = Router();

router.use(verifyToken);

function toLimit(value, fallback = 10, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !cleanText(body[field]));
  if (missing.length) {
    throw new AppError(400, 'VALIDATION_ERROR', `Missing required field(s): ${missing.join(', ')}`);
  }
}

function normalizeProductType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ['ASSET', 'CONSUMABLE', 'SERVICE'].includes(normalized) ? normalized : 'ASSET';
}

function normalizeTrackingType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ['SERIAL', 'IMEI', 'NONE'].includes(normalized) ? normalized : 'NONE';
}

function normalizeSerialStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ['AVAILABLE', 'ALLOCATED', 'INSTALLED', 'RETURNED', 'DAMAGED'].includes(normalized)
    ? normalized
    : 'AVAILABLE';
}

function normalizeWorkflowStatus(value, allowed, fallback) {
  const normalized = String(value || '').trim().toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeInstallationStatus(value) {
  return normalizeWorkflowStatus(value, ['REQUESTED', 'PROCUREMENT', 'ASSIGNED', 'INSTALLED', 'WELCOME_CALL', 'BILLING_READY', 'COMPLETED', 'CANCELLED'], 'REQUESTED');
}

function normalizeComplaintStatus(value) {
  return normalizeWorkflowStatus(value, ['TAKEN', 'PENDING', 'RESOLVED', 'REJECTED'], 'TAKEN');
}

function normalizeReplacementStatus(value) {
  return normalizeWorkflowStatus(value, ['PENDING', 'REPLACED', 'REJECTED'], 'PENDING');
}

function toPositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function toMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function workflowNo(prefix) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${stamp}-${suffix}`;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one item is required.');
  }

  const normalized = items.map((item) => ({
    product_id: cleanText(item.product_id),
    product_name: cleanText(item.product_name),
    quantity: toPositiveInt(item.quantity),
    unit_price: toMoney(item.unit_price),
    remarks: cleanText(item.remarks) || null,
  })).filter((item) => item.product_id && item.product_name);

  if (!normalized.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Please select valid products.');
  }

  return normalized;
}

async function getProductMap(client, productIds) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (!uniqueIds.length) return new Map();
  const result = await client.query(
    `
      SELECT id, product_name, product_type, tracking_type, COALESCE(quantity, 0)::int AS quantity
      FROM public.products
      WHERE id = ANY($1::uuid[])
    `,
    [uniqueIds]
  );
  return new Map(result.rows.map((row) => [row.id, row]));
}

function handleDbWriteError(error, next) {
  if (error.code === '23503') {
    return next(new AppError(409, 'IN_USE', 'This record is connected with other ERP data and cannot be deleted or changed this way.'));
  } else if (error.code === '23505') {
    return next(new AppError(409, 'DUPLICATE_RECORD', 'A record with the same unique value already exists.'));
  }
  next(error);
}

let phaseSchemaPromise;

async function ensurePhaseSchema() {
  if (!phaseSchemaPromise) {
    phaseSchemaPromise = pool.query(`
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

      CREATE INDEX IF NOT EXISTS idx_tracker_installations_customer ON public.tracker_installations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_tracker_installations_status ON public.tracker_installations(status);
      CREATE INDEX IF NOT EXISTS idx_customer_complaints_customer ON public.customer_complaints(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_complaints_status ON public.customer_complaints(status);
      CREATE INDEX IF NOT EXISTS idx_item_replacements_customer ON public.item_replacements(customer_id);
    `);
  }
  await phaseSchemaPromise;
}

async function getSummary() {
  await ensurePhaseSchema();
  const [
    products,
    serialStatus,
    purchaseFlow,
    salesFlow,
    installationFlow,
    supportFlow,
    partyCounts,
    categoryCounts,
    recentMovements,
  ] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total_products,
        COALESCE(SUM(quantity), 0)::int AS product_quantity,
        COUNT(*) FILTER (WHERE product_type = 'ASSET')::int AS assets,
        COUNT(*) FILTER (WHERE product_type = 'CONSUMABLE')::int AS consumables,
        COUNT(*) FILTER (WHERE product_type = 'SERVICE')::int AS services,
        COUNT(*) FILTER (WHERE tracking_type IN ('SERIAL', 'IMEI'))::int AS tracked_products
      FROM public.products
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS total_serials,
        COUNT(*) FILTER (WHERE current_status = 'AVAILABLE')::int AS available,
        COUNT(*) FILTER (WHERE current_status = 'ALLOCATED')::int AS allocated,
        COUNT(*) FILTER (WHERE current_status = 'INSTALLED')::int AS installed,
        COUNT(*) FILTER (WHERE current_status = 'RETURNED')::int AS returned,
        COUNT(*) FILTER (WHERE current_status = 'DAMAGED')::int AS damaged
      FROM public.inventory_items
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS purchase_requests,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_pr,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_pr,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_pr,
        (SELECT COUNT(*)::int FROM public.purchase_orders) AS purchase_orders,
        (SELECT COUNT(*)::int FROM public.grns) AS grns
      FROM public.purchase_requests
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.quotations) AS quotations,
        (SELECT COUNT(*)::int FROM public.delivery_orders) AS delivery_orders,
        (SELECT COUNT(*)::int FROM public.invoices) AS invoices,
        (SELECT COUNT(*)::int FROM public.invoices WHERE approval_status = 'PENDING') AS pending_invoices,
        (SELECT COUNT(*)::int FROM public.invoices WHERE payment_status = 'UNPAID') AS unpaid_invoices,
        (SELECT COUNT(*)::int FROM public.invoices WHERE payment_status = 'PAID') AS paid_invoices,
        (SELECT COALESCE(SUM(total_amount), 0)::numeric FROM public.invoices) AS invoice_value
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS installation_requests,
        COUNT(*) FILTER (WHERE status = 'REQUESTED')::int AS requested,
        COUNT(*) FILTER (WHERE status = 'INSTALLED')::int AS installed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled
      FROM public.tracker_installations
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.customer_complaints) AS complaints,
        (SELECT COUNT(*)::int FROM public.customer_complaints WHERE status IN ('TAKEN', 'PENDING')) AS open_complaints,
        (SELECT COUNT(*)::int FROM public.customer_complaints WHERE status = 'RESOLVED') AS resolved_complaints,
        (SELECT COUNT(*)::int FROM public.item_replacements) AS replacements,
        (SELECT COUNT(*)::int FROM public.customer_vehicles) AS vehicles
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.customers) AS customers,
        (SELECT COUNT(*)::int FROM public.vendors) AS vendors
    `),
    pool.query(`
      SELECT
        ic.id,
        ic.category_name,
        COUNT(p.id)::int AS products
      FROM public.item_categories ic
      LEFT JOIN public.products p ON p.category_id = ic.id
      GROUP BY ic.id, ic.category_name
      ORDER BY products DESC, ic.category_name ASC
      LIMIT 8
    `),
    pool.query(`
      SELECT
        im.id,
        im.movement_type,
        im.reference_type,
        im.remarks,
        im.created_at,
        ii.serial_number,
        p.product_name
      FROM public.inventory_movements im
      LEFT JOIN public.inventory_items ii ON ii.id = im.inventory_item_id
      LEFT JOIN public.products p ON p.id = ii.product_id
      ORDER BY im.created_at DESC
      LIMIT 8
    `),
  ]);

  return {
    products: products.rows[0],
    stock: serialStatus.rows[0],
    purchase: purchaseFlow.rows[0],
    sales: salesFlow.rows[0],
    installations: installationFlow.rows[0],
    support: supportFlow.rows[0],
    parties: partyCounts.rows[0],
    categories: categoryCounts.rows,
    recent_movements: recentMovements.rows,
  };
}

router.get('/status', async (req, res, next) => {
  try {
    const summary = await getSummary();
    return sendSuccess(
      res,
      {
        module: 'inventory',
        status: 'live',
        auth: 'connected',
        connected_to_hr_auth: true,
        message: 'Inventory, purchasing, invoicing, tracker installations, complaints, replacements, customers, and vendors are connected to the ERP database.',
        planned_next: [],
        summary,
      },
      200
    );
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    sendSuccess(res, await getSummary());
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        ic.*,
        COUNT(p.id)::int AS product_count
      FROM public.item_categories ic
      LEFT JOIN public.products p ON p.category_id = ic.id
      GROUP BY ic.id
      ORDER BY ic.category_name ASC
    `);
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    requireFields(req.body, ['category_name']);
    const result = await pool.query(
      `
        INSERT INTO public.item_categories (category_name, description)
        VALUES ($1, $2)
        RETURNING *
      `,
      [cleanText(req.body.category_name), cleanText(req.body.description) || null]
    );
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/categories/:id', async (req, res, next) => {
  try {
    requireFields(req.body, ['category_name']);
    const result = await pool.query(
      `
        UPDATE public.item_categories
        SET category_name = $1, description = $2
        WHERE id = $3
        RETURNING *
      `,
      [cleanText(req.body.category_name), cleanText(req.body.description) || null, req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM public.item_categories WHERE id = $1`, [req.params.id]);
    sendSuccess(res, { deleted: true });
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const limit = toLimit(req.query.limit, 25);
    const search = req.query.search?.toString().trim();
    const params = [];
    let whereSql = '';

    if (search) {
      params.push(`%${search}%`);
      whereSql = `WHERE p.product_name ILIKE $${params.length} OR ic.category_name ILIKE $${params.length}`;
    }

    params.push(limit);
    const result = await pool.query(
      `
        SELECT
          p.id,
          p.product_name,
          p.category_id,
          p.product_type,
          p.tracking_type,
          COALESCE(p.quantity, 0)::int AS quantity,
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
        ${whereSql}
        GROUP BY p.id, ic.category_name
        ORDER BY p.created_at DESC, p.product_name ASC
        LIMIT $${params.length}
      `,
      params
    );
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    requireFields(req.body, ['product_name']);
    const quantity = Math.max(Number(req.body.quantity) || 0, 0);
    const result = await pool.query(
      `
        INSERT INTO public.products (
          product_name,
          category_id,
          product_type,
          tracking_type,
          quantity
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        cleanText(req.body.product_name),
        cleanText(req.body.category_id) || null,
        normalizeProductType(req.body.product_type),
        normalizeTrackingType(req.body.tracking_type),
        quantity,
      ]
    );
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    requireFields(req.body, ['product_name']);
    const quantity = Math.max(Number(req.body.quantity) || 0, 0);
    const result = await pool.query(
      `
        UPDATE public.products
        SET product_name = $1,
            category_id = $2,
            product_type = $3,
            tracking_type = $4,
            quantity = $5
        WHERE id = $6
        RETURNING *
      `,
      [
        cleanText(req.body.product_name),
        cleanText(req.body.category_id) || null,
        normalizeProductType(req.body.product_type),
        normalizeTrackingType(req.body.tracking_type),
        quantity,
        req.params.id,
      ]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM public.products WHERE id = $1`, [req.params.id]);
    sendSuccess(res, { deleted: true });
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.get('/serials', async (req, res, next) => {
  try {
    const limit = toLimit(req.query.limit, 25);
    const result = await pool.query(
      `
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
        LIMIT $1
      `,
      [limit]
    );
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/serials', async (req, res, next) => {
  try {
    requireFields(req.body, ['product_id', 'serial_number']);
    const result = await pool.query(
      `
        INSERT INTO public.inventory_items (product_id, serial_number, current_status)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [
        cleanText(req.body.product_id),
        cleanText(req.body.serial_number),
        normalizeSerialStatus(req.body.current_status),
      ]
    );
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/serials/:id', async (req, res, next) => {
  try {
    requireFields(req.body, ['product_id', 'serial_number']);
    const result = await pool.query(
      `
        UPDATE public.inventory_items
        SET product_id = $1,
            serial_number = $2,
            current_status = $3
        WHERE id = $4
        RETURNING *
      `,
      [
        cleanText(req.body.product_id),
        cleanText(req.body.serial_number),
        normalizeSerialStatus(req.body.current_status),
        req.params.id,
      ]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.delete('/serials/:id', async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM public.inventory_items WHERE id = $1`, [req.params.id]);
    sendSuccess(res, { deleted: true });
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.get('/customers', async (req, res, next) => {
  try {
    const limit = toLimit(req.query.limit, 20);
    const result = await pool.query(
      `
        SELECT *
        FROM public.customers
        ORDER BY created_at DESC, customer_name ASC
        LIMIT $1
      `,
      [limit]
    );
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/customers', async (req, res, next) => {
  try {
    requireFields(req.body, ['customer_name', 'company_name', 'customer_type', 'phone', 'email']);
    const result = await pool.query(
      `
        INSERT INTO public.customers (customer_name, company_name, customer_type, phone, email)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [
        cleanText(req.body.customer_name),
        cleanText(req.body.company_name),
        cleanText(req.body.customer_type),
        cleanText(req.body.phone),
        cleanText(req.body.email),
      ]
    );
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/customers/:id', async (req, res, next) => {
  try {
    requireFields(req.body, ['customer_name', 'company_name', 'customer_type', 'phone', 'email']);
    const result = await pool.query(
      `
        UPDATE public.customers
        SET customer_name = $1,
            company_name = $2,
            customer_type = $3,
            phone = $4,
            email = $5
        WHERE id = $6
        RETURNING *
      `,
      [
        cleanText(req.body.customer_name),
        cleanText(req.body.company_name),
        cleanText(req.body.customer_type),
        cleanText(req.body.phone),
        cleanText(req.body.email),
        req.params.id,
      ]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.delete('/customers/:id', async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM public.customers WHERE id = $1`, [req.params.id]);
    sendSuccess(res, { deleted: true });
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.get('/vendors', async (req, res, next) => {
  try {
    const limit = toLimit(req.query.limit, 20);
    const result = await pool.query(
      `
        SELECT *
        FROM public.vendors
        ORDER BY created_at DESC, vendor_name ASC
        LIMIT $1
      `,
      [limit]
    );
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/vendors', async (req, res, next) => {
  try {
    requireFields(req.body, ['vendor_name']);
    const result = await pool.query(
      `
        INSERT INTO public.vendors (vendor_name, contact_person, phone, email)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [
        cleanText(req.body.vendor_name),
        cleanText(req.body.contact_person) || null,
        cleanText(req.body.phone) || null,
        cleanText(req.body.email) || null,
      ]
    );
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/vendors/:id', async (req, res, next) => {
  try {
    requireFields(req.body, ['vendor_name']);
    const result = await pool.query(
      `
        UPDATE public.vendors
        SET vendor_name = $1,
            contact_person = $2,
            phone = $3,
            email = $4
        WHERE id = $5
        RETURNING *
      `,
      [
        cleanText(req.body.vendor_name),
        cleanText(req.body.contact_person) || null,
        cleanText(req.body.phone) || null,
        cleanText(req.body.email) || null,
        req.params.id,
      ]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.delete('/vendors/:id', async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM public.vendors WHERE id = $1`, [req.params.id]);
    sendSuccess(res, { deleted: true });
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.get('/purchase-flow', async (req, res, next) => {
  try {
    const result = await pool.query(`
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
    `);
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/purchase-requests', async (req, res, next) => {
  const client = await pool.connect();
  try {
    requireFields(req.body, ['department_id']);
    const items = normalizeItems(req.body.items);
    const productMap = await getProductMap(client, items.map((item) => item.product_id));

    await client.query('BEGIN');
    const pr = await client.query(
      `
        INSERT INTO public.purchase_requests (
          requested_by,
          department_id,
          status,
          approval_remarks
        )
        VALUES ($1, $2, 'PENDING', $3)
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.department_id), cleanText(req.body.remarks) || null]
    );

    for (const item of items) {
      const product = productMap.get(item.product_id);
      await client.query(
        `
          INSERT INTO public.purchase_request_items (
            purchase_request_id,
            product_id,
            product_name,
            quantity,
            remarks
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [pr.rows[0].id, item.product_id, product?.product_name || item.product_name, item.quantity, item.remarks]
      );
    }

    await client.query('COMMIT');
    sendSuccess(res, pr.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.patch('/purchase-requests/:id/approve', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.purchase_requests
        SET status = 'APPROVED',
            approved_by = $1,
            approved_at = now(),
            approval_remarks = $2
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || 'Approved', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/purchase-requests/:id/reject', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.purchase_requests
        SET status = 'REJECTED',
            approved_by = $1,
            approved_at = now(),
            approval_remarks = $2
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || 'Rejected', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.get('/purchase-orders', async (req, res, next) => {
  try {
    const result = await pool.query(`
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
    `);
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/purchase-orders', async (req, res, next) => {
  const client = await pool.connect();
  try {
    requireFields(req.body, ['purchase_request_id', 'vendor_id']);
    await client.query('BEGIN');

    const pr = await client.query(
      `SELECT * FROM public.purchase_requests WHERE id = $1 LIMIT 1`,
      [req.body.purchase_request_id]
    );
    if (!pr.rowCount) throw new AppError(404, 'NOT_FOUND', 'Purchase request not found.');
    if (pr.rows[0].status !== 'APPROVED') {
      throw new AppError(409, 'PR_NOT_APPROVED', 'Approve the purchase request before generating a PO.');
    }

    const prItems = await client.query(
      `SELECT * FROM public.purchase_request_items WHERE purchase_request_id = $1`,
      [req.body.purchase_request_id]
    );
    if (!prItems.rowCount) throw new AppError(400, 'NO_ITEMS', 'Purchase request has no items.');

    const unitPrices = req.body.unit_prices || {};
    const total = prItems.rows.reduce((sum, item) => sum + Number(item.quantity) * toMoney(unitPrices[item.product_id]), 0);
    const po = await client.query(
      `
        INSERT INTO public.purchase_orders (
          pr_id,
          vendor_id,
          created_by,
          total_amount
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [req.body.purchase_request_id, req.body.vendor_id, req.user.user_id, total]
    );

    for (const item of prItems.rows) {
      const unitPrice = toMoney(unitPrices[item.product_id]);
      await client.query(
        `
          INSERT INTO public.purchase_order_items (
            purchase_order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            remarks
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [po.rows[0].id, item.product_id, item.product_name, item.quantity, unitPrice, item.remarks]
      );
    }

    await client.query('COMMIT');
    sendSuccess(res, po.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.post('/grns', async (req, res, next) => {
  const client = await pool.connect();
  try {
    requireFields(req.body, ['purchase_order_id']);
    await client.query('BEGIN');

    const existing = await client.query(`SELECT id FROM public.grns WHERE po_id = $1 LIMIT 1`, [req.body.purchase_order_id]);
    if (existing.rowCount) throw new AppError(409, 'GRN_EXISTS', 'This purchase order already has a GRN.');

    const po = await client.query(`SELECT * FROM public.purchase_orders WHERE id = $1 LIMIT 1`, [req.body.purchase_order_id]);
    if (!po.rowCount) throw new AppError(404, 'NOT_FOUND', 'Purchase order not found.');

    const poItems = await client.query(`SELECT * FROM public.purchase_order_items WHERE purchase_order_id = $1`, [req.body.purchase_order_id]);
    if (!poItems.rowCount) throw new AppError(400, 'NO_ITEMS', 'Purchase order has no items.');

    const productMap = await getProductMap(client, poItems.rows.map((item) => item.product_id));
    const grn = await client.query(
      `
        INSERT INTO public.grns (po_id, received_by)
        VALUES ($1, $2)
        RETURNING *
      `,
      [req.body.purchase_order_id, req.user.user_id]
    );

    const serials = req.body.serials || {};
    const serialPrefix = cleanText(req.body.serial_prefix) || `GRN-${Date.now()}`;

    for (const item of poItems.rows) {
      const product = productMap.get(item.product_id);
      const qty = toPositiveInt(item.quantity);
      await client.query(
        `
          INSERT INTO public.grn_items (
            grn_id,
            product_id,
            product_name,
            quantity_received,
            remarks
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [grn.rows[0].id, item.product_id, item.product_name, qty, item.remarks]
      );

      await client.query(
        `UPDATE public.products SET quantity = COALESCE(quantity, 0) + $1 WHERE id = $2`,
        [qty, item.product_id]
      );

      if (['SERIAL', 'IMEI'].includes(product?.tracking_type)) {
        const providedSerials = Array.isArray(serials[item.product_id]) ? serials[item.product_id] : [];
        for (let i = 0; i < qty; i += 1) {
          const serialNumber = cleanText(providedSerials[i]) || `${serialPrefix}-${String(i + 1).padStart(3, '0')}-${String(item.product_id).slice(0, 6)}`;
          const inventoryItem = await client.query(
            `
              INSERT INTO public.inventory_items (product_id, serial_number, current_status)
              VALUES ($1, $2, 'AVAILABLE')
              RETURNING id
            `,
            [item.product_id, serialNumber]
          );

          await client.query(
            `
              INSERT INTO public.inventory_movements (
                inventory_item_id,
                movement_type,
                reference_type,
                reference_id,
                moved_by,
                remarks
              )
              VALUES ($1, 'STOCK_IN', 'GRN', $2, $3, $4)
            `,
            [inventoryItem.rows[0].id, grn.rows[0].id, req.user.user_id, `Received via ${grn.rows[0].grn_id || 'GRN'}`]
          );
        }
      } else {
        await client.query(
          `
            INSERT INTO public.inventory_movements (
              inventory_item_id,
              movement_type,
              reference_type,
              reference_id,
              moved_by,
              remarks
            )
            VALUES (NULL, 'STOCK_IN', 'GRN', $1, $2, $3)
          `,
          [grn.rows[0].id, req.user.user_id, `Received ${qty} ${item.product_name}`]
        );
      }
    }

    await client.query('COMMIT');
    sendSuccess(res, grn.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.get('/sales-flow', async (req, res, next) => {
  try {
    const result = await pool.query(`
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
    `);
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/quotations', async (req, res, next) => {
  const client = await pool.connect();
  try {
    requireFields(req.body, ['customer_id']);
    const items = normalizeItems(req.body.items);
    const productMap = await getProductMap(client, items.map((item) => item.product_id));
    await client.query('BEGIN');

    const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const quotation = await client.query(
      `
        INSERT INTO public.quotations (
          customer_id,
          status,
          created_by,
          approval_remarks,
          total_amount
        )
        VALUES ($1, 'DRAFT', $2, $3, $4)
        RETURNING *
      `,
      [req.body.customer_id, req.user.user_id, cleanText(req.body.remarks) || null, total]
    );

    for (const item of items) {
      const product = productMap.get(item.product_id);
      await client.query(
        `
          INSERT INTO public.quotation_items (
            quotation_id,
            quantity,
            unit_price,
            product_id
          )
          VALUES ($1, $2, $3, $4)
        `,
        [quotation.rows[0].id, item.quantity, item.unit_price, product?.id || item.product_id]
      );
    }

    await client.query('COMMIT');
    sendSuccess(res, quotation.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.patch('/quotations/:id/approve', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.quotations
        SET status = 'APPROVED',
            approved_by = $1,
            approved_at = now(),
            approval_remarks = $2
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || 'Approved by client/finance', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/quotations/:id/reject', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.quotations
        SET status = 'REJECTED',
            approved_by = $1,
            approved_at = now(),
            approval_remarks = $2
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || 'Rejected', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.post('/delivery-orders', async (req, res, next) => {
  const client = await pool.connect();
  try {
    requireFields(req.body, ['quotation_id']);
    await client.query('BEGIN');

    const quotation = await client.query(`SELECT * FROM public.quotations WHERE id = $1 LIMIT 1`, [req.body.quotation_id]);
    if (!quotation.rowCount) throw new AppError(404, 'NOT_FOUND', 'Quotation not found.');
    if (quotation.rows[0].status !== 'APPROVED') {
      throw new AppError(409, 'QUOTE_NOT_APPROVED', 'Approve the quotation before creating a delivery order.');
    }

    const existing = await client.query(`SELECT id FROM public.delivery_orders WHERE quotation_id = $1 LIMIT 1`, [req.body.quotation_id]);
    if (existing.rowCount) throw new AppError(409, 'DELIVERY_EXISTS', 'Delivery order already exists for this quotation.');

    const order = await client.query(
      `
        INSERT INTO public.delivery_orders (
          issued_to_type,
          issued_to_id,
          issued_by,
          status,
          quotation_id,
          approval_remarks
        )
        VALUES ('CUSTOMER', $1, $2, 'PENDING', $3, $4)
        RETURNING *
      `,
      [quotation.rows[0].customer_id, req.user.user_id, req.body.quotation_id, cleanText(req.body.remarks) || null]
    );

    const items = await client.query(
      `
        SELECT qi.*, p.product_name
        FROM public.quotation_items qi
        JOIN public.products p ON p.id = qi.product_id
        WHERE qi.quotation_id = $1
      `,
      [req.body.quotation_id]
    );

    for (const item of items.rows) {
      await client.query(
        `
          INSERT INTO public.delivery_order_items (
            delivery_order_id,
            product_name,
            quantity,
            remarks,
            product_id
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [order.rows[0].id, item.product_name, item.quantity || 1, cleanText(req.body.remarks) || null, item.product_id]
      );
    }

    await client.query('COMMIT');
    sendSuccess(res, order.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.patch('/delivery-orders/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query(`SELECT * FROM public.delivery_orders WHERE id = $1 LIMIT 1`, [req.params.id]);
    if (!order.rowCount) throw new AppError(404, 'NOT_FOUND', 'Delivery order not found.');
    if (order.rows[0].status === 'APPROVED') {
      throw new AppError(409, 'ALREADY_APPROVED', 'Delivery order is already approved.');
    }

    const items = await client.query(`SELECT * FROM public.delivery_order_items WHERE delivery_order_id = $1`, [req.params.id]);
    const productMap = await getProductMap(client, items.rows.map((item) => item.product_id));

    for (const item of items.rows) {
      const product = productMap.get(item.product_id);
      const qty = toPositiveInt(item.quantity);
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product not found for ${item.product_name}.`);
      if (Number(product.quantity || 0) < qty) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', `${product.product_name} has insufficient stock.`);
      }

      await client.query(`UPDATE public.products SET quantity = COALESCE(quantity, 0) - $1 WHERE id = $2`, [qty, item.product_id]);

      if (['SERIAL', 'IMEI'].includes(product.tracking_type)) {
        const serials = await client.query(
          `
            SELECT id
            FROM public.inventory_items
            WHERE product_id = $1 AND current_status = 'AVAILABLE'
            ORDER BY created_at ASC
            LIMIT $2
          `,
          [item.product_id, qty]
        );
        if (serials.rowCount < qty) {
          throw new AppError(409, 'INSUFFICIENT_SERIALS', `${product.product_name} does not have enough available serials.`);
        }

        for (const serial of serials.rows) {
          await client.query(`UPDATE public.inventory_items SET current_status = 'ALLOCATED' WHERE id = $1`, [serial.id]);
          await client.query(
            `
              INSERT INTO public.inventory_movements (
                inventory_item_id,
                movement_type,
                reference_type,
                reference_id,
                moved_by,
                remarks
              )
              VALUES ($1, 'STOCK_OUT', 'DELIVERY_ORDER', $2, $3, $4)
            `,
            [serial.id, req.params.id, req.user.user_id, `Allocated for ${order.rows[0].do_id || 'delivery order'}`]
          );
        }
      } else {
        await client.query(
          `
            INSERT INTO public.inventory_movements (
              inventory_item_id,
              movement_type,
              reference_type,
              reference_id,
              moved_by,
              remarks
            )
            VALUES (NULL, 'STOCK_OUT', 'DELIVERY_ORDER', $1, $2, $3)
          `,
          [req.params.id, req.user.user_id, `Issued ${qty} ${product.product_name}`]
        );
      }
    }

    const result = await client.query(
      `
        UPDATE public.delivery_orders
        SET status = 'APPROVED',
            approved_by = $1,
            approved_at = now(),
            approval_remarks = $2
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || 'Stock allocated', req.params.id]
    );

    await client.query('COMMIT');
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.patch('/delivery-orders/:id/reject', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.delivery_orders
        SET status = 'REJECTED',
            approved_by = $1,
            approved_at = now(),
            approval_remarks = $2
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || 'Rejected', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.post('/invoices', async (req, res, next) => {
  const client = await pool.connect();
  try {
    requireFields(req.body, ['quotation_id']);
    await client.query('BEGIN');

    const quotation = await client.query(`SELECT * FROM public.quotations WHERE id = $1 LIMIT 1`, [req.body.quotation_id]);
    if (!quotation.rowCount) throw new AppError(404, 'NOT_FOUND', 'Quotation not found.');
    if (quotation.rows[0].status !== 'APPROVED') {
      throw new AppError(409, 'QUOTE_NOT_APPROVED', 'Approve the quotation before creating an invoice.');
    }

    const existing = await client.query(`SELECT id FROM public.invoices WHERE quotation_id = $1 LIMIT 1`, [req.body.quotation_id]);
    if (existing.rowCount) throw new AppError(409, 'INVOICE_EXISTS', 'Invoice already exists for this quotation.');

    const invoice = await client.query(
      `
        INSERT INTO public.invoices (
          quotation_id,
          created_by,
          total_amount,
          payment_status,
          remarks,
          approval_status
        )
        VALUES ($1, $2, $3, 'UNPAID', $4, 'PENDING')
        RETURNING *
      `,
      [req.body.quotation_id, req.user.user_id, quotation.rows[0].total_amount || 0, cleanText(req.body.remarks) || null]
    );

    const items = await client.query(`SELECT * FROM public.quotation_items WHERE quotation_id = $1`, [req.body.quotation_id]);
    for (const item of items.rows) {
      await client.query(
        `
          INSERT INTO public.invoice_items (
            invoice_id,
            product_id,
            quantity,
            unit_price
          )
          VALUES ($1, $2, $3, $4)
        `,
        [invoice.rows[0].id, item.product_id, item.quantity || 1, item.unit_price || 0]
      );
    }

    await client.query('COMMIT');
    sendSuccess(res, invoice.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.patch('/invoices/:id/approve', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.invoices
        SET approval_status = 'APPROVED',
            approved_by = $1,
            approved_at = now(),
            remarks = COALESCE($2, remarks)
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || null, req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/invoices/:id/reject', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.invoices
        SET approval_status = 'REJECTED',
            approved_by = $1,
            approved_at = now(),
            remarks = COALESCE($2, remarks)
        WHERE id = $3
        RETURNING *
      `,
      [req.user.user_id, cleanText(req.body.remarks) || 'Rejected', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/invoices/:id/mark-paid', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        UPDATE public.invoices
        SET payment_status = 'PAID',
            remarks = COALESCE($1, remarks)
        WHERE id = $2
        RETURNING *
      `,
      [cleanText(req.body.remarks) || 'Payment received', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.get('/installation-flow', async (req, res, next) => {
  try {
    await ensurePhaseSchema();
    const result = await pool.query(`
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
    `);
    sendSuccess(res, result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/installations', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensurePhaseSchema();
    requireFields(req.body, ['customer_id', 'vehicle_no']);
    await client.query('BEGIN');

    const vehicle = await client.query(
      `
        INSERT INTO public.customer_vehicles (
          customer_id,
          vehicle_no,
          vehicle_model,
          driver_name,
          driver_phone,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (customer_id, vehicle_no)
        DO UPDATE SET
          vehicle_model = COALESCE(EXCLUDED.vehicle_model, public.customer_vehicles.vehicle_model),
          driver_name = COALESCE(EXCLUDED.driver_name, public.customer_vehicles.driver_name),
          driver_phone = COALESCE(EXCLUDED.driver_phone, public.customer_vehicles.driver_phone)
        RETURNING id
      `,
      [
        req.body.customer_id,
        cleanText(req.body.vehicle_no),
        cleanText(req.body.vehicle_model) || null,
        cleanText(req.body.driver_name) || null,
        cleanText(req.body.driver_phone) || null,
        req.user.user_id,
      ]
    );

    const result = await client.query(
      `
        INSERT INTO public.tracker_installations (
          request_no,
          customer_id,
          vehicle_id,
          vehicle_no,
          contact_person,
          contact_phone,
          installation_type,
          status,
          po_reference,
          remarks,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'REQUESTED', $8, $9, $10)
        RETURNING *
      `,
      [
        workflowNo('INS'),
        req.body.customer_id,
        vehicle.rows[0].id,
        cleanText(req.body.vehicle_no),
        cleanText(req.body.contact_person) || null,
        cleanText(req.body.contact_phone) || null,
        cleanText(req.body.installation_type) || 'NEW',
        cleanText(req.body.po_reference) || null,
        cleanText(req.body.remarks) || null,
        req.user.user_id,
      ]
    );

    await client.query('COMMIT');
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.patch('/installations/:id/assign-tracker', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensurePhaseSchema();
    requireFields(req.body, ['tracker_item_id']);
    await client.query('BEGIN');

    const installation = await client.query(`SELECT * FROM public.tracker_installations WHERE id = $1 LIMIT 1`, [req.params.id]);
    if (!installation.rowCount) throw new AppError(404, 'NOT_FOUND', 'Installation request not found.');
    if (['COMPLETED', 'CANCELLED'].includes(installation.rows[0].status)) {
      throw new AppError(409, 'INSTALLATION_CLOSED', 'This installation request is already closed.');
    }

    const serial = await client.query(
      `
        SELECT ii.*, p.product_name
        FROM public.inventory_items ii
        JOIN public.products p ON p.id = ii.product_id
        WHERE ii.id = $1
        LIMIT 1
      `,
      [req.body.tracker_item_id]
    );
    if (!serial.rowCount) throw new AppError(404, 'TRACKER_NOT_FOUND', 'Tracker serial not found.');
    if (!['AVAILABLE', 'ALLOCATED'].includes(serial.rows[0].current_status)) {
      throw new AppError(409, 'TRACKER_NOT_AVAILABLE', 'Selected tracker is not available for installation.');
    }

    await client.query(`UPDATE public.inventory_items SET current_status = 'INSTALLED' WHERE id = $1`, [req.body.tracker_item_id]);
    await client.query(
      `
        INSERT INTO public.inventory_movements (
          inventory_item_id,
          movement_type,
          reference_type,
          reference_id,
          moved_by,
          remarks
        )
        VALUES ($1, 'TRANSFER', 'TRACKER_INSTALLATION', $2, $3, $4)
      `,
      [
        req.body.tracker_item_id,
        req.params.id,
        req.user.user_id,
        cleanText(req.body.remarks) || `Tracker assigned to vehicle ${installation.rows[0].vehicle_no}`,
      ]
    );

    const result = await client.query(
      `
        UPDATE public.tracker_installations
        SET tracker_item_id = $1,
            installer_id = COALESCE($2, installer_id),
            status = 'INSTALLED',
            mapping_notes = COALESCE($3, mapping_notes),
            remarks = COALESCE($4, remarks),
            updated_at = now(),
            installed_at = now()
        WHERE id = $5
        RETURNING *
      `,
      [
        req.body.tracker_item_id,
        cleanText(req.body.installer_id) || null,
        cleanText(req.body.mapping_notes) || null,
        cleanText(req.body.remarks) || null,
        req.params.id,
      ]
    );

    await client.query('COMMIT');
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.patch('/installations/:id/complete', async (req, res, next) => {
  try {
    await ensurePhaseSchema();
    const result = await pool.query(
      `
        UPDATE public.tracker_installations
        SET status = 'COMPLETED',
            welcome_call_notes = COALESCE($1, welcome_call_notes),
            billing_notes = COALESCE($2, billing_notes),
            remarks = COALESCE($3, remarks),
            updated_at = now()
        WHERE id = $4
        RETURNING *
      `,
      [
        cleanText(req.body.welcome_call_notes) || 'Welcome call recorded',
        cleanText(req.body.billing_notes) || 'Billing setup ready',
        cleanText(req.body.remarks) || null,
        req.params.id,
      ]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/installations/:id/cancel', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensurePhaseSchema();
    await client.query('BEGIN');
    const installation = await client.query(`SELECT * FROM public.tracker_installations WHERE id = $1 LIMIT 1`, [req.params.id]);
    if (!installation.rowCount) throw new AppError(404, 'NOT_FOUND', 'Installation request not found.');
    if (installation.rows[0].tracker_item_id) {
      await client.query(`UPDATE public.inventory_items SET current_status = 'AVAILABLE' WHERE id = $1`, [installation.rows[0].tracker_item_id]);
    }
    const result = await client.query(
      `
        UPDATE public.tracker_installations
        SET status = 'CANCELLED',
            remarks = COALESCE($1, remarks),
            updated_at = now()
        WHERE id = $2
        RETURNING *
      `,
      [cleanText(req.body.remarks) || 'Installation cancelled', req.params.id]
    );
    await client.query('COMMIT');
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

router.get('/support-flow', async (req, res, next) => {
  try {
    await ensurePhaseSchema();
    const [complaints, replacements] = await Promise.all([
      pool.query(`
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
      `),
      pool.query(`
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
      `),
    ]);
    sendSuccess(res, { complaints: complaints.rows, replacements: replacements.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/complaints', async (req, res, next) => {
  try {
    await ensurePhaseSchema();
    requireFields(req.body, ['customer_id', 'issue_type']);
    const result = await pool.query(
      `
        INSERT INTO public.customer_complaints (
          ticket_no,
          customer_id,
          vehicle_no,
          issue_type,
          priority,
          status,
          remarks,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        workflowNo('CMP'),
        req.body.customer_id,
        cleanText(req.body.vehicle_no) || null,
        cleanText(req.body.issue_type),
        cleanText(req.body.priority) || 'MEDIUM',
        normalizeComplaintStatus(req.body.status),
        cleanText(req.body.remarks) || null,
        req.user.user_id,
      ]
    );
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.patch('/complaints/:id/resolve', async (req, res, next) => {
  try {
    await ensurePhaseSchema();
    const result = await pool.query(
      `
        UPDATE public.customer_complaints
        SET status = 'RESOLVED',
            resolution_notes = $1,
            updated_at = now(),
            resolved_at = now()
        WHERE id = $2
        RETURNING *
      `,
      [cleanText(req.body.resolution_notes) || cleanText(req.body.remarks) || 'Resolved', req.params.id]
    );
    sendSuccess(res, result.rows[0] || null);
  } catch (error) {
    handleDbWriteError(error, next);
  }
});

router.post('/replacements', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensurePhaseSchema();
    requireFields(req.body, ['customer_id', 'new_inventory_item_id']);
    await client.query('BEGIN');

    if (cleanText(req.body.new_inventory_item_id)) {
      const newSerial = await client.query(`SELECT * FROM public.inventory_items WHERE id = $1 LIMIT 1`, [req.body.new_inventory_item_id]);
      if (!newSerial.rowCount) throw new AppError(404, 'NEW_SERIAL_NOT_FOUND', 'New tracker serial not found.');
      if (!['AVAILABLE', 'ALLOCATED'].includes(newSerial.rows[0].current_status)) {
        throw new AppError(409, 'NEW_SERIAL_NOT_AVAILABLE', 'New tracker serial is not available for replacement.');
      }
      await client.query(`UPDATE public.inventory_items SET current_status = 'INSTALLED' WHERE id = $1`, [req.body.new_inventory_item_id]);
    }

    if (cleanText(req.body.old_inventory_item_id)) {
      await client.query(`UPDATE public.inventory_items SET current_status = 'RETURNED' WHERE id = $1`, [req.body.old_inventory_item_id]);
    }

    const result = await client.query(
      `
        INSERT INTO public.item_replacements (
          replacement_no,
          complaint_id,
          customer_id,
          vehicle_no,
          old_inventory_item_id,
          new_inventory_item_id,
          status,
          remarks,
          created_by,
          completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $7 = 'REPLACED' THEN now() ELSE NULL END)
        RETURNING *
      `,
      [
        workflowNo('REP'),
        cleanText(req.body.complaint_id) || null,
        req.body.customer_id,
        cleanText(req.body.vehicle_no) || null,
        cleanText(req.body.old_inventory_item_id) || null,
        req.body.new_inventory_item_id,
        normalizeReplacementStatus(req.body.status || 'REPLACED'),
        cleanText(req.body.remarks) || null,
        req.user.user_id,
      ]
    );

    await client.query(
      `
        INSERT INTO public.inventory_movements (
          inventory_item_id,
          movement_type,
          reference_type,
          reference_id,
          moved_by,
          remarks
        )
        VALUES ($1, 'TRANSFER', 'ITEM_REPLACEMENT', $2, $3, $4)
      `,
      [
        req.body.new_inventory_item_id,
        result.rows[0].id,
        req.user.user_id,
        cleanText(req.body.remarks) || 'Tracker replacement completed',
      ]
    );

    if (cleanText(req.body.complaint_id)) {
      await client.query(
        `
          UPDATE public.customer_complaints
          SET status = 'RESOLVED',
              resolution_notes = COALESCE($1, resolution_notes),
              updated_at = now(),
              resolved_at = now()
          WHERE id = $2
        `,
        [cleanText(req.body.remarks) || 'Resolved through item replacement', req.body.complaint_id]
      );
    }

    await client.query('COMMIT');
    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    handleDbWriteError(error, next);
  } finally {
    client.release();
  }
});

export default router;
