import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { query } from './db';
import { swaggerDocument } from './swagger';

export const apiRouter = express.Router();
apiRouter.use(express.json());

// Resolve the actual cafe ID from the DB once and cache it.
// This avoids hardcoding 'negis-kitchen' when the real ID may differ.
let _cafeId: string | null = null;
async function getCafeId(): Promise<string> {
  if (_cafeId) return _cafeId;
  const res = await query('SELECT id FROM cafes LIMIT 1');
  if (res.rows.length === 0) throw new Error('No cafe found in DB. Please seed the cafes table first.');
  _cafeId = res.rows[0].id as string;
  return _cafeId;
}

// Swagger API Documentation UI & JSON endpoint
apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
apiRouter.get('/docs-json', (req: Request, res: Response) => {
  res.json(swaggerDocument);
});

// ---------------------------------------------------------------------------
// ONE-TIME MIGRATION: rename cafe id from 'royal-cafe' → 'negis-kitchen'
// POST /api/migrate-cafe-id   (remove this endpoint after running once)
// ---------------------------------------------------------------------------
apiRouter.post('/migrate-cafe-id', async (req: Request, res: Response) => {
  try {
    const OLD = 'royal-cafe';
    const NEW = 'negis-kitchen';
    const results: Record<string, number> = {};

    const { getPool } = await import('./db');
    const pool = await getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Find all FK constraints on cafes.id so we can temporarily drop them
      const fkRes = await client.query(`
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
          AND tc.table_schema = rc.constraint_schema
        JOIN information_schema.key_column_usage ccu
          ON rc.unique_constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'cafes'
          AND ccu.column_name = 'id'
          AND tc.table_schema = 'public'
      `);

      const fkConstraints = fkRes.rows;
      console.log('[migrate] Found FK constraints:', fkConstraints.map((r: any) => `${r.table_name}.${r.constraint_name}`).join(', '));

      // Drop all FK constraints referencing cafes.id
      for (const fk of fkConstraints) {
        await client.query(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
        console.log('[migrate] Dropped FK:', fk.constraint_name);
      }

      // Update the primary key on cafes
      const cafeRes = await client.query(`UPDATE cafes SET id = $1 WHERE id = $2`, [NEW, OLD]);
      results['cafes'] = cafeRes.rowCount ?? 0;
      console.log('[migrate] cafes updated:', results['cafes']);

      // Update all child table cafe_id values
      for (const t of ['tables', 'categories', 'menu_items', 'orders']) {
        try {
          const r = await client.query(`UPDATE "${t}" SET cafe_id = $1 WHERE cafe_id = $2`, [NEW, OLD]);
          results[t] = r.rowCount ?? 0;
          console.log(`[migrate] ${t} updated:`, results[t]);
        } catch (e: any) {
          console.warn(`[migrate] Skipping ${t}:`, e.message);
          results[t] = -1;
        }
      }

      // Re-add FK constraints pointing to the new ID
      for (const fk of fkConstraints) {
        await client.query(`
          ALTER TABLE "${fk.table_name}"
          ADD CONSTRAINT "${fk.constraint_name}"
          FOREIGN KEY ("${fk.column_name}") REFERENCES cafes(id)
        `);
        console.log('[migrate] Re-added FK:', fk.constraint_name);
      }

      await client.query('COMMIT');
      console.log('[migrate] COMMITTED');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Bust the in-memory cached cafe ID
    _cafeId = NEW;

    res.json({ success: true, updated: results });
  } catch (err: any) {
    console.error('[migrate-cafe-id]', err);
    res.status(500).json({ error: err.message, detail: err.detail, code: err.code });
  }
});

// Helper to map DB cafe to CafeInfo
function mapCafe(row: any) {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline || '',
    logo: row.logo_url || '',
    address: row.address || '',
    phone: row.phone || '',
    currency: row.currency || '₹',
    taxPercent: Number(row.tax_percent || 0),
    serviceChargePercent: Number(row.service_charge_percent || 0),
    isAcceptingOrders: row.is_accepting_orders ?? true,
    upiId: row.upi_id || '',
  };
}

// Helper to map DB table to TableItem
function mapTable(row: any) {
  return {
    id: row.id,
    number: row.number,
    code: row.code,
    capacity: Number(row.capacity),
    status: row.status,
    activeOrderId: row.active_order_id || undefined,
  };
}

// Helper to map DB category
function mapCategory(row: any) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || 'Utensils',
    displayOrder: Number(row.display_order || 0),
  };
}

// Helper to map DB menu item
function mapMenuItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    price: Number(row.price),
    categoryId: row.category_id,
    vegType: row.veg_type,
    image: row.image_url || '',
    isAvailable: row.is_available,
    preparationTimeMin: row.preparation_time_min ? Number(row.preparation_time_min) : undefined,
    customizationGroups: row.customization_groups || [],
  };
}

// --- CAFE INFO ---
apiRouter.get('/cafe', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM cafes LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cafe not found' });
    }
    res.json(mapCafe(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/cafe', async (req: Request, res: Response) => {
  try {
    const c = req.body;
    const result = await query(
      `UPDATE cafes SET 
        name = $1, tagline = $2, logo_url = $3, address = $4, phone = $5,
        currency = $6, tax_percent = $7, service_charge_percent = $8,
        is_accepting_orders = $9, upi_id = $10
       WHERE id = $11
       RETURNING *`,
      [
        c.name,
        c.tagline,
        c.logo,
        c.address,
        c.phone,
        c.currency || '₹',
        c.taxPercent || 0,
        c.serviceChargePercent || 0,
        c.isAcceptingOrders ?? true,
        c.upiId || '',
        c.id || await getCafeId(),
      ]
    );
    res.json(mapCafe(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- TABLES ---
apiRouter.get('/tables', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM tables ORDER BY number ASC');
    res.json(result.rows.map(mapTable));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/tables', async (req: Request, res: Response) => {
  try {
    const t = req.body;
    const cafeId = await getCafeId();
    const cleanNum = t.number.replace(/[^0-9]/g, '') || String(Date.now()).slice(-2);
    const id = `table-${cleanNum}`;
    const code = `table-${cleanNum}`;
    const result = await query(
      `INSERT INTO tables (id, cafe_id, number, code, capacity, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, cafeId, t.number, code, t.capacity || 4, t.status || 'available']
    );
    res.json(mapTable(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/tables/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.capacity !== undefined) {
      fields.push(`capacity = $${idx++}`);
      values.push(updates.capacity);
    }
    if (updates.number !== undefined) {
      fields.push(`number = $${idx++}`);
      values.push(updates.number);
    }
    if (updates.activeOrderId !== undefined) {
      fields.push(`active_order_id = $${idx++}`);
      values.push(updates.activeOrderId || null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(
      `UPDATE tables SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Table not found' });
    res.json(mapTable(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/tables/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM tables WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- CATEGORIES ---
apiRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY display_order ASC, name ASC');
    res.json(result.rows.map(mapCategory));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, icon } = req.body;
    const cafeId = await getCafeId();
    const id = `cat-${Date.now()}`;
    const countRes = await query('SELECT count(*) FROM categories');
    const displayOrder = parseInt(countRes.rows[0].count, 10) + 1;
    const result = await query(
      `INSERT INTO categories (id, cafe_id, name, icon, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, cafeId, name, icon || 'Utensils', displayOrder]
    );
    res.json(mapCategory(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;
    const result = await query(
      'UPDATE categories SET name = $1, icon = COALESCE($2, icon) WHERE id = $3 RETURNING *',
      [name, icon, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(mapCategory(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- MENU ITEMS ---
apiRouter.get('/menu', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM menu_items ORDER BY name ASC');
    res.json(result.rows.map(mapMenuItem));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/menu', async (req: Request, res: Response) => {
  try {
    const item = req.body;
    const cafeId = await getCafeId();
    const id = `item-${Date.now()}`;
    const result = await query(
      `INSERT INTO menu_items (id, cafe_id, category_id, name, description, price, veg_type, image_url, is_available, preparation_time_min, customization_groups)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        cafeId,
        item.categoryId,
        item.name,
        item.description || '',
        item.price,
        item.vegType,
        item.image || '',
        item.isAvailable ?? true,
        item.preparationTimeMin || 15,
        JSON.stringify(item.customizationGroups || []),
      ]
    );
    res.json(mapMenuItem(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/menu/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = req.body;
    const result = await query(
      `UPDATE menu_items SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        category_id = COALESCE($4, category_id),
        veg_type = COALESCE($5, veg_type),
        image_url = COALESCE($6, image_url),
        is_available = COALESCE($7, is_available),
        preparation_time_min = COALESCE($8, preparation_time_min),
        customization_groups = COALESCE($9, customization_groups)
       WHERE id = $10
       RETURNING *`,
      [
        item.name,
        item.description,
        item.price,
        item.categoryId,
        item.vegType,
        item.image,
        item.isAvailable,
        item.preparationTimeMin,
        item.customizationGroups ? JSON.stringify(item.customizationGroups) : null,
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(mapMenuItem(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/menu/:id/availability', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE menu_items SET is_available = NOT is_available WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ isAvailable: result.rows[0].is_available });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/menu/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORDERS ---
async function fetchFullOrders(whereClause = '', params: any[] = []) {
  const ordersQuery = `
    SELECT * FROM orders
    ${whereClause}
    ORDER BY created_at DESC
  `;
  const ordersRes = await query(ordersQuery, params);
  if (ordersRes.rows.length === 0) return [];

  const orderIds = ordersRes.rows.map((o) => o.id);

  // Fetch all rounds for these orders
  const roundsRes = await query(
    `SELECT * FROM order_rounds WHERE order_id = ANY($1::text[]) ORDER BY order_id, round_number ASC`,
    [orderIds]
  );

  const roundIds = roundsRes.rows.map((r) => r.id);

  // Fetch all items for these rounds
  let itemsRes: any = { rows: [] };
  if (roundIds.length > 0) {
    itemsRes = await query(
      `SELECT * FROM order_items WHERE order_round_id = ANY($1::uuid[])`,
      [roundIds]
    );
  }

  // Group items by round_id
  const itemsByRound = new Map<string, any[]>();
  for (const item of itemsRes.rows) {
    const arr = itemsByRound.get(item.order_round_id) || [];
    arr.push({
      itemId: item.id,
      menuItemId: item.menu_item_id,
      name: item.name,
      price: Number(item.price),
      vegType: item.veg_type,
      image: '',
      quantity: Number(item.quantity),
      selectedCustomizations: item.selected_customizations || [],
      specialInstructions: item.special_instructions || undefined,
      itemTotal: Number(item.item_total),
      preparationTimeMin: item.preparation_time_min || undefined,
    });
    itemsByRound.set(item.order_round_id, arr);
  }

  // Group rounds by order_id
  const roundsByOrder = new Map<string, any[]>();
  for (const round of roundsRes.rows) {
    const arr = roundsByOrder.get(round.order_id) || [];
    const rItems = itemsByRound.get(round.id) || [];
    arr.push({
      roundNumber: Number(round.round_number),
      items: rItems,
      placedAt: new Date(round.placed_at).getTime(),
      estimatedPrepTimeMin: Number(round.estimated_prep_time_min || 15),
      preparingStartedAt: round.preparing_started_at ? new Date(round.preparing_started_at).getTime() : undefined,
      readyAt: round.ready_at ? new Date(round.ready_at).getTime() : undefined,
      status: round.status,
    });
    roundsByOrder.set(round.order_id, arr);
  }

  // Assemble orders
  return ordersRes.rows.map((o) => {
    const rounds = roundsByOrder.get(o.id) || [];
    // Aggregate items from all rounds
    const allItems: any[] = [];
    for (const r of rounds) {
      allItems.push(...r.items);
    }

    const firstRound = rounds[0];
    return {
      id: o.id,
      cafeId: o.cafe_id,
      tableId: o.table_id,
      tableNumber: o.table_number,
      items: allItems,
      subtotal: Number(o.subtotal),
      tax: Number(o.tax),
      serviceCharge: Number(o.service_charge),
      total: Number(o.total),
      status: o.status,
      customerName: o.customer_name || undefined,
      customerPhone: o.customer_phone || undefined,
      specialInstructions: o.special_instructions || undefined,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      createdAt: new Date(o.created_at).getTime(),
      updatedAt: new Date(o.updated_at).getTime(),
      preparingStartedAt: firstRound?.preparingStartedAt,
      estimatedPrepTimeMin: firstRound?.estimatedPrepTimeMin || 15,
      readyAt: firstRound?.readyAt,
      orderRounds: Number(o.order_rounds_count || rounds.length || 1),
      isMerged: o.is_merged,
      mergedOrderIds: o.merged_order_ids || [],
      rounds: rounds,
    };
  });
}

apiRouter.get('/orders', async (req: Request, res: Response) => {
  try {
    const orders = await fetchFullOrders();
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/orders', async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    console.log('[POST /orders] body keys:', orderData ? Object.keys(orderData) : 'NO BODY');
    console.log('[POST /orders] tableId:', orderData?.tableId, '| items count:', orderData?.items?.length);

    // Body-parse guard: if body is empty the JSON middleware didn't run
    if (!orderData || typeof orderData !== 'object' || !orderData.tableId) {
      console.error('[POST /orders] Bad or missing body:', orderData);
      return res.status(400).json({ error: 'Missing or invalid request body. Received: ' + JSON.stringify(orderData) });
    }
    const forceNew = req.query.force === 'true';

    // Ensure table exists in tables DB table to avoid FK constraint failure
    if (orderData.tableId) {
      const cafeId = await getCafeId();
      const tableCheck = await query('SELECT id FROM tables WHERE id = $1', [orderData.tableId]);
      if (tableCheck.rows.length === 0) {
        await query(
          `INSERT INTO tables (id, cafe_id, number, code, capacity, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            orderData.tableId,
            cafeId,
            orderData.tableNumber || `Table ${orderData.tableId.replace(/[^0-9]/g, '')}`,
            orderData.tableId,
            4,
            'available',
          ]
        );
      }
    }

    // Helper function to resolve valid menuItemId that exists in DB
    const getValidMenuItemId = async (rawId?: string): Promise<string | null> => {
      if (!rawId) return null;
      const check = await query('SELECT id FROM menu_items WHERE id = $1', [rawId]);
      return check.rows.length > 0 ? rawId : null;
    };

    // 1. Check if there is an active order placed for this table within 30 minutes
    if (!forceNew) {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const activeRes = await query(
        `SELECT id, order_rounds_count, subtotal, total FROM orders 
         WHERE table_id = $1 AND status NOT IN ('served', 'cancelled') AND created_at >= $2
         ORDER BY created_at DESC LIMIT 1`,
        [orderData.tableId, thirtyMinsAgo]
      );

      if (activeRes.rows.length > 0) {
        const existing = activeRes.rows[0];
        const newRoundNumber = Number(existing.order_rounds_count) + 1;

        // Calculate prep time for new round
        const prepTime = orderData.estimatedPrepTimeMin || 15;

        // Create new round in DB
        const roundRes = await query(
          `INSERT INTO order_rounds (order_id, round_number, placed_at, estimated_prep_time_min, status)
           VALUES ($1, $2, now(), $3, 'received')
           RETURNING id`,
          [existing.id, newRoundNumber, prepTime]
        );
        const roundId = roundRes.rows[0].id;

        // Insert items for this new round
        for (const it of orderData.items || []) {
          const validMenuItemId = await getValidMenuItemId(it.menuItemId);
          await query(
            `INSERT INTO order_items (order_round_id, menu_item_id, name, price, veg_type, quantity, item_total, special_instructions, preparation_time_min, selected_customizations)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              roundId,
              validMenuItemId,
              it.name,
              it.price,
              it.vegType || 'veg',
              it.quantity,
              it.itemTotal,
              it.specialInstructions || null,
              it.preparationTimeMin || 15,
              JSON.stringify(it.selectedCustomizations || []),
            ]
          );
        }

        // Update existing order subtotal and total
        const newSubtotal = Number(existing.subtotal) + Number(orderData.subtotal);
        const newTotal = Number(existing.total) + Number(orderData.total);

        await query(
          `UPDATE orders SET 
            order_rounds_count = $1,
            is_merged = true,
            subtotal = $2,
            total = $3,
            updated_at = now()
           WHERE id = $4`,
          [newRoundNumber, newSubtotal, newTotal, existing.id]
        );

        const updatedOrders = await fetchFullOrders('WHERE id = $1', [existing.id]);
        return res.json(updatedOrders[0]);
      }
    }

    // 2. Create fresh new order
    let orderId = orderData.id;
    if (!orderId) {
      try {
        console.log('[POST /orders] getting next order id via function...');
        const seqRes = await query('SELECT get_next_order_id() as id');
        orderId = seqRes.rows[0].id;
      } catch (e: any) {
        console.warn('[POST /orders] get_next_order_id() not found, using count fallback:', e.message);
        const countRes = await query('SELECT count(*) FROM orders');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 1026;
        orderId = `ORD-${nextNum}`;
      }
    }
    console.log('[POST /orders] inserting order id:', orderId);
    const cafeId = await getCafeId();
    await query(
      `INSERT INTO orders (id, cafe_id, table_id, table_number, status, customer_name, customer_phone, special_instructions, payment_method, payment_status, subtotal, tax, service_charge, total, order_rounds_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 1)`,
      [
        orderId,
        cafeId,
        orderData.tableId,
        orderData.tableNumber,
        orderData.status || 'received',
        orderData.customerName || null,
        orderData.customerPhone || null,
        orderData.specialInstructions || null,
        orderData.paymentMethod || 'counter_cash',
        orderData.paymentStatus || 'pending',
        orderData.subtotal || 0,
        orderData.tax || 0,
        orderData.serviceCharge || 0,
        orderData.total || 0,
      ]
    );
    console.log('[POST /orders] order row inserted, inserting round 1...');

    // Insert Round 1
    const prepTime = orderData.estimatedPrepTimeMin || 15;
    const roundRes = await query(
      `INSERT INTO order_rounds (order_id, round_number, placed_at, estimated_prep_time_min, status)
       VALUES ($1, 1, now(), $2, $3)
       RETURNING id`,
      [orderId, prepTime, orderData.status || 'received']
    );
    const roundId = roundRes.rows[0].id;
    console.log('[POST /orders] round 1 inserted, id:', roundId, '| inserting', (orderData.items || []).length, 'items...');

    // Insert Round 1 items
    for (const it of orderData.items || []) {
      const validMenuItemId = await getValidMenuItemId(it.menuItemId);
      console.log('[POST /orders] inserting item:', it.name, '| menuItemId:', validMenuItemId);
      await query(
        `INSERT INTO order_items (order_round_id, menu_item_id, name, price, veg_type, quantity, item_total, special_instructions, preparation_time_min, selected_customizations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          roundId,
          validMenuItemId,
          it.name,
          it.price,
          it.vegType || 'veg',
          it.quantity,
          it.itemTotal,
          it.specialInstructions || null,
          it.preparationTimeMin || 15,
          JSON.stringify(it.selectedCustomizations || []),
        ]
      );
    }
    console.log('[POST /orders] all items inserted, updating table status...');

    // Mark table occupied
    await query(
      `UPDATE tables SET status = 'occupied', active_order_id = $1 WHERE id = $2`,
      [orderId, orderData.tableId]
    );
    console.log('[POST /orders] table updated, fetching full order...');

    const created = await fetchFullOrders('WHERE id = $1', [orderId]);
    console.log('[POST /orders] success, responding with order:', created[0]?.id);
    res.json(created[0]);
  } catch (err: any) {
    console.error('[POST /orders Error]:', err);
    res.status(500).json({
      error: err.message,
      detail: err.detail || undefined,
      hint: err.hint || undefined,
      code: err.code || undefined,
      where: err.where || undefined,
    });
  }
});

apiRouter.patch('/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Update orders table
    const paymentStatus = status === 'served' ? 'paid' : undefined;
    if (paymentStatus) {
      await query(
        'UPDATE orders SET status = $1, payment_status = $2, updated_at = now() WHERE id = $3',
        [status, paymentStatus, id]
      );
    } else {
      await query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
    }

    // Update all rounds
    if (status === 'preparing') {
      await query(
        `UPDATE order_rounds SET status = 'preparing', preparing_started_at = COALESCE(preparing_started_at, now()) WHERE order_id = $1 AND status = 'received'`,
        [id]
      );
    } else if (status === 'ready') {
      await query(
        `UPDATE order_rounds SET status = 'ready', ready_at = COALESCE(ready_at, now()) WHERE order_id = $1 AND status IN ('received', 'preparing')`,
        [id]
      );
    } else if (status === 'served' || status === 'cancelled') {
      await query('UPDATE order_rounds SET status = $1 WHERE order_id = $2', [status, id]);

      // Release table if no other active orders exist
      const ordRes = await query('SELECT table_id FROM orders WHERE id = $1', [id]);
      if (ordRes.rows.length > 0) {
        const tableId = ordRes.rows[0].table_id;
        const otherRes = await query(
          `SELECT count(*) FROM orders WHERE table_id = $1 AND id != $2 AND status IN ('received', 'preparing', 'ready')`,
          [tableId, id]
        );
        if (parseInt(otherRes.rows[0].count, 10) === 0) {
          await query(
            `UPDATE tables SET status = 'available', active_order_id = NULL WHERE id = $1`,
            [tableId]
          );
        }
      }
    }

    const updated = await fetchFullOrders('WHERE id = $1', [id]);
    res.json(updated[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/orders/:id/rounds/:roundNumber/status', async (req: Request, res: Response) => {
  try {
    const { id, roundNumber } = req.params;
    const { status } = req.body;
    const rNum = parseInt(roundNumber, 10);

    if (status === 'preparing') {
      await query(
        `UPDATE order_rounds SET status = $1, preparing_started_at = COALESCE(preparing_started_at, now()) WHERE order_id = $2 AND round_number = $3`,
        [status, id, rNum]
      );
    } else if (status === 'ready') {
      await query(
        `UPDATE order_rounds SET status = $1, ready_at = COALESCE(ready_at, now()) WHERE order_id = $2 AND round_number = $3`,
        [status, id, rNum]
      );
    } else {
      await query(
        `UPDATE order_rounds SET status = $1 WHERE order_id = $2 AND round_number = $3`,
        [status, id, rNum]
      );
    }

    // Recompute overall order status
    const allRounds = await query(
      'SELECT status FROM order_rounds WHERE order_id = $1',
      [id]
    );
    const statuses = allRounds.rows.map((r) => r.status);
    let aggregate = 'preparing';
    if (statuses.every((s) => s === 'served')) aggregate = 'served';
    else if (statuses.every((s) => s === 'cancelled')) aggregate = 'cancelled';
    else if (statuses.every((s) => s === 'ready')) aggregate = 'ready';
    else if (statuses.every((s) => s === 'received')) aggregate = 'received';

    await query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [aggregate, id]);

    const updated = await fetchFullOrders('WHERE id = $1', [id]);
    res.json(updated[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/orders/:id/prep-time', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { additionalOrTotalMinutes, isAdjustment, roundNumber } = req.body;

    if (roundNumber) {
      if (isAdjustment) {
        await query(
          `UPDATE order_rounds SET estimated_prep_time_min = GREATEST(5, estimated_prep_time_min + $1) WHERE order_id = $2 AND round_number = $3`,
          [additionalOrTotalMinutes, id, roundNumber]
        );
      } else {
        await query(
          `UPDATE order_rounds SET estimated_prep_time_min = GREATEST(5, $1) WHERE order_id = $2 AND round_number = $3`,
          [additionalOrTotalMinutes, id, roundNumber]
        );
      }
    } else {
      // Update the active cooking round or last round
      if (isAdjustment) {
        await query(
          `UPDATE order_rounds SET estimated_prep_time_min = GREATEST(5, estimated_prep_time_min + $1) WHERE order_id = $2 AND status = 'preparing'`,
          [additionalOrTotalMinutes, id]
        );
      } else {
        await query(
          `UPDATE order_rounds SET estimated_prep_time_min = GREATEST(5, $1) WHERE order_id = $2 AND status = 'preparing'`,
          [additionalOrTotalMinutes, id]
        );
      }
    }

    const updated = await fetchFullOrders('WHERE id = $1', [id]);
    res.json(updated[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
