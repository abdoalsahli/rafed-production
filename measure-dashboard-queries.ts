/**
 * Phase 1: Measure dashboard query timings
 * Captures execution time, SQL, row counts, and EXPLAIN plans for each dashboard query
 */

import { getDb, getRawDb } from "./server/_core/db";
import { getDistributorIdFromUser } from "./server/db";

const DISTRIBUTOR_USER_ID = 1; // anis.demo@example.com

async function measureQueries() {
  const db = await getDb();
  const pool = await getRawDb();

  if (!db || !pool) {
    console.error("Database connection failed");
    process.exit(1);
  }

  const distributorId = await getDistributorIdFromUser(DISTRIBUTOR_USER_ID, db);
  console.log(`\n=== DASHBOARD QUERY MEASUREMENTS ===`);
  console.log(`Distributor ID: ${distributorId}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Query 1: auth.me (simulated - just user lookup)
  console.log("--- QUERY 1: auth.me ---");
  const q1Start = Date.now();
  const [authUser] = await pool.query(
    `SELECT id, email, name FROM users WHERE id = ?`,
    [DISTRIBUTOR_USER_ID]
  );
  const q1Time = Date.now() - q1Start;
  console.log(`Execution time: ${q1Time}ms`);
  console.log(`Row count: ${authUser?.length || 0}`);
  console.log(`SQL: SELECT id, email, name FROM users WHERE id = ?`);
  console.log();

  // Query 2: getConnectedProviders
  console.log("--- QUERY 2: getConnectedProviders ---");
  const q2Start = Date.now();
  const [providers] = await pool.query(
    `SELECT 
      pdr.id as relationship_id,
      sp.id as provider_id,
      sp.name as provider_name,
      sp.provider_code as provider_code,
      pdr.status,
      pdr.commission_percentage,
      pdr.credit_line,
      pdr.created_at as connected_at,
      pda.balance as available_credit,
      pda.used_credit as account_used_credit
    FROM provider_distributor_relationships pdr
    JOIN service_providers sp ON pdr.provider_id = sp.id
    LEFT JOIN provider_distributor_accounts pda ON pdr.provider_id = pda.provider_id AND pdr.distributor_id = pda.distributor_id
    WHERE pdr.distributor_id = ?
    ORDER BY pdr.created_at DESC`,
    [distributorId]
  );
  const q2Time = Date.now() - q2Start;
  console.log(`Execution time: ${q2Time}ms`);
  console.log(`Row count: ${providers?.length || 0}`);
  console.log(`SQL: 3-table JOIN with LEFT JOIN on accounts`);

  // EXPLAIN for Query 2
  const [explain2] = await pool.query(
    `EXPLAIN SELECT 
      pdr.id as relationship_id,
      sp.id as provider_id,
      sp.name as provider_name,
      sp.provider_code as provider_code,
      pdr.status,
      pdr.commission_percentage,
      pdr.credit_line,
      pdr.created_at as connected_at,
      pda.balance as available_credit,
      pda.used_credit as account_used_credit
    FROM provider_distributor_relationships pdr
    JOIN service_providers sp ON pdr.provider_id = sp.id
    LEFT JOIN provider_distributor_accounts pda ON pdr.provider_id = pda.provider_id AND pdr.distributor_id = pda.distributor_id
    WHERE pdr.distributor_id = ?
    ORDER BY pdr.created_at DESC`,
    [distributorId]
  );
  console.log(`EXPLAIN plan:`);
  console.log(JSON.stringify(explain2, null, 2));
  console.log();

  // Query 3: ledgerHistory (last 5 entries)
  console.log("--- QUERY 3: ledgerHistory ---");
  const q3Start = Date.now();
  const [ledger] = await pool.query(
    `SELECT 
      pdl.id,
      pdl.distributor_id,
      pdl.provider_id,
      pdl.amount,
      pdl.type,
      pdl.balance_after,
      pdl.used_credit_after_transaction,
      pdl.reference_type,
      pdl.reference_id,
      pdl.created_at
    FROM provider_distributor_ledger pdl
    WHERE pdl.distributor_id = ?
    ORDER BY pdl.created_at DESC
    LIMIT 5`,
    [distributorId]
  );
  const q3Time = Date.now() - q3Start;
  console.log(`Execution time: ${q3Time}ms`);
  console.log(`Row count: ${ledger?.length || 0}`);
  console.log(`SQL: SELECT from ledger with ORDER BY created_at DESC LIMIT 5`);

  // EXPLAIN for Query 3
  const [explain3] = await pool.query(
    `EXPLAIN SELECT 
      pdl.id,
      pdl.distributor_id,
      pdl.provider_id,
      pdl.amount,
      pdl.type,
      pdl.balance_after,
      pdl.used_credit_after_transaction,
      pdl.reference_type,
      pdl.reference_id,
      pdl.created_at
    FROM provider_distributor_ledger pdl
    WHERE pdl.distributor_id = ?
    ORDER BY pdl.created_at DESC
    LIMIT 5`,
    [distributorId]
  );
  console.log(`EXPLAIN plan:`);
  console.log(JSON.stringify(explain3, null, 2));
  console.log();

  // Query 4: accountBalance (aggregated)
  console.log("--- QUERY 4: accountBalance ---");
  const q4Start = Date.now();
  const [accounts] = await pool.query(
    `SELECT 
      pda.id,
      pda.provider_id,
      sp.name as provider_name,
      pda.balance,
      pda.credit_line,
      pda.used_credit,
      (pda.balance + (pda.credit_line - pda.used_credit)) as available_to_spend,
      pda.version
    FROM provider_distributor_accounts pda
    JOIN service_providers sp ON pda.provider_id = sp.id
    WHERE pda.distributor_id = ?`,
    [distributorId]
  );
  const q4Time = Date.now() - q4Start;
  console.log(`Execution time: ${q4Time}ms`);
  console.log(`Row count: ${accounts?.length || 0}`);
  console.log(`SQL: 2-table JOIN with calculated column`);

  // EXPLAIN for Query 4
  const [explain4] = await pool.query(
    `EXPLAIN SELECT 
      pda.id,
      pda.provider_id,
      sp.name as provider_name,
      pda.balance,
      pda.credit_line,
      pda.used_credit,
      (pda.balance + (pda.credit_line - pda.used_credit)) as available_to_spend,
      pda.version
    FROM provider_distributor_accounts pda
    JOIN service_providers sp ON pda.provider_id = sp.id
    WHERE pda.distributor_id = ?`,
    [distributorId]
  );
  console.log(`EXPLAIN plan:`);
  console.log(JSON.stringify(explain4, null, 2));
  console.log();

  // Query 5: getPendingAccessRequests
  console.log("--- QUERY 5: getPendingAccessRequests ---");
  const q5Start = Date.now();
  const [requests] = await pool.query(
    `SELECT 
      ar.id,
      ar.distributor_id,
      ar.provider_id,
      ar.status,
      ar.created_at,
      d.name as distributor_name,
      sp.name as provider_name
    FROM access_requests ar
    LEFT JOIN distributors d ON ar.distributor_id = d.id
    LEFT JOIN service_providers sp ON ar.provider_id = sp.id
    WHERE (ar.provider_id = ? OR ar.distributor_id = ?)
      AND ar.status = 'PENDING'
    ORDER BY ar.created_at DESC`,
    [distributorId, distributorId]
  );
  const q5Time = Date.now() - q5Start;
  console.log(`Execution time: ${q5Time}ms`);
  console.log(`Row count: ${requests?.length || 0}`);
  console.log(`SQL: 3-table LEFT JOIN with status filter`);

  // EXPLAIN for Query 5
  const [explain5] = await pool.query(
    `EXPLAIN SELECT 
      ar.id,
      ar.distributor_id,
      ar.provider_id,
      ar.status,
      ar.created_at,
      d.name as distributor_name,
      sp.name as provider_name
    FROM access_requests ar
    LEFT JOIN distributors d ON ar.distributor_id = d.id
    LEFT JOIN service_providers sp ON ar.provider_id = sp.id
    WHERE (ar.provider_id = ? OR ar.distributor_id = ?)
      AND ar.status = 'PENDING'
    ORDER BY ar.created_at DESC`,
    [distributorId, distributorId]
  );
  console.log(`EXPLAIN plan:`);
  console.log(JSON.stringify(explain5, null, 2));
  console.log();

  // Summary
  console.log("=== SUMMARY ===");
  console.log(`Query 1 (auth.me): ${q1Time}ms`);
  console.log(`Query 2 (getConnectedProviders): ${q2Time}ms [LIKELY BOTTLENECK]`);
  console.log(`Query 3 (ledgerHistory): ${q3Time}ms`);
  console.log(`Query 4 (accountBalance): ${q4Time}ms`);
  console.log(`Query 5 (getPendingAccessRequests): ${q5Time}ms`);
  console.log(`Total: ${q1Time + q2Time + q3Time + q4Time + q5Time}ms`);
  console.log();

  await pool.end();
  process.exit(0);
}

measureQueries().catch((err) => {
  console.error("Measurement failed:", err);
  process.exit(1);
});
