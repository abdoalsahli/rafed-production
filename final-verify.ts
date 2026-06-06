import { getRawDb } from "./server/db";

async function finalVerify() {
  const pool = await getRawDb();
  if (!pool) {
    console.error("Database not available");
    process.exit(1);
  }

  const conn = await pool.getConnection();

  try {
    console.log("\n=== QUERY 1: Card Status Distribution (Batch 60007) ===");
    const [q1] = await conn.execute(`
      SELECT status, COUNT(*) AS count
      FROM cards
      WHERE batch_id = 60007
      GROUP BY status
    `);
    console.log(JSON.stringify(q1, null, 2));

    console.log("\n=== QUERY 2: Recent Transactions (Product 150005) ===");
    const [q2] = await conn.execute(`
      SELECT 
        id,
        distributor_id,
        provider_id,
        product_id,
        card_id,
        amount,
        commission_amount,
        transaction_type,
        status,
        idempotency_key,
        created_at
      FROM transactions
      WHERE product_id = 150005
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log(JSON.stringify(q2, null, 2));

    console.log("\n=== QUERY 3: Account Balance (Libyana + SEED_Anis) ===");
    const [q3] = await conn.execute(`
      SELECT 
        pda.id,
        pda.balance,
        pda.credit_line,
        pda.used_credit,
        (pda.balance + (pda.credit_line - pda.used_credit)) AS available_to_spend,
        pda.version
      FROM provider_distributor_accounts pda
      JOIN service_providers sp ON sp.id = pda.provider_id
      JOIN distributors d ON d.id = pda.distributor_id
      WHERE sp.name = 'Libyana Telecom'
        AND d.name = 'SEED_Anis Distribution'
    `);
    console.log(JSON.stringify(q3, null, 2));

    console.log("\n=== QUERY 4: Ledger Entries ===");
    const [q4] = await conn.execute(`
      SELECT 
        type,
        amount,
        balance_after_transaction,
        used_credit_after_transaction,
        reference_type,
        reference_id,
        created_at
      FROM provider_distributor_ledger
      WHERE provider_id = (
        SELECT id FROM service_providers WHERE name = 'Libyana Telecom'
      )
      AND distributor_id = (
        SELECT id FROM distributors WHERE name = 'SEED_Anis Distribution'
      )
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log(JSON.stringify(q4, null, 2));

    console.log("\n=== QUERY 5: Purchase Requests ===");
    const [q5] = await conn.execute(`
      SELECT 
        id,
        idempotency_key,
        status,
        card_id,
        failure_reason,
        created_at,
        updated_at
      FROM purchase_requests
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log(JSON.stringify(q5, null, 2));

    conn.release();
  } catch (error: any) {
    console.error("Error:", error.message);
    conn.release();
    process.exit(1);
  }
}

finalVerify();
