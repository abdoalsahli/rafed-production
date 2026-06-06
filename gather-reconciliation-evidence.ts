/**
 * Gather Reconciliation Evidence
 * 
 * Collects current account state and valid transactions for the affected test account:
 * SEED_Anis Distribution + Libyana Telecom
 */

import { getDb } from './server/db';
import { providerDistributorAccounts, purchaseRequests, transactions, providerDistributorLedger } from './drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

async function gatherEvidence() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  console.log('=== RECONCILIATION EVIDENCE GATHERING ===\n');

  // Known IDs from test data
  const providerId = 1214740; // Libyana Telecom
  const distributorId = 1179498; // SEED_Anis Distribution

  // Query 1: Current account state
  console.log('QUERY 1: Current Account State');
  console.log('Provider: 1214740 (Libyana Telecom)');
  console.log('Distributor: 1179498 (SEED_Anis Distribution)\n');

  const accountRows = await db
    .select()
    .from(providerDistributorAccounts)
    .where(
      and(
        eq(providerDistributorAccounts.providerId, providerId),
        eq(providerDistributorAccounts.distributorId, distributorId)
      )
    );

  const account = accountRows[0];

  if (!account) {
    console.log('ERROR: Account not found!');
    process.exit(1);
  }

  console.log('Current Account Row:');
  console.log(JSON.stringify(account, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    return value;
  }, 2));

  const currentBalance = parseFloat((account as any).balance);
  const currentCreditLine = parseFloat((account as any).creditLine);
  const currentUsedCredit = parseFloat((account as any).usedCredit);
  const currentAvailable = currentBalance + (currentCreditLine - currentUsedCredit);

  console.log(`\nCalculated Available: ${currentAvailable.toFixed(2)}`);
  console.log(`  = ${currentBalance.toFixed(2)} + (${currentCreditLine.toFixed(2)} - ${currentUsedCredit.toFixed(2)})`);

  // Query 2: All SUCCEEDED purchase requests for this provider/distributor
  console.log('\n\nQUERY 2: All SUCCEEDED Purchase Requests');

  const purchaseRows = await db
    .select({
      id: purchaseRequests.id,
      idempotencyKey: purchaseRequests.idempotencyKey,
      status: purchaseRequests.status,
      cardId: purchaseRequests.cardId,
      createdAt: purchaseRequests.createdAt,
      updatedAt: purchaseRequests.updatedAt,
    })
    .from(purchaseRequests)
    .where(
      and(
        eq(purchaseRequests.providerId, providerId),
        eq(purchaseRequests.distributorId, distributorId),
        eq(purchaseRequests.status, 'SUCCEEDED')
      )
    );

  if (purchaseRows.length === 0) {
    console.log('No SUCCEEDED purchases found');
  } else {
    console.log(`Found ${purchaseRows.length} SUCCEEDED purchases:\n`);
    purchaseRows.forEach((p, idx) => {
      console.log(`Purchase ${idx + 1}:`);
      console.log(`  Request ID: ${p.id}`);
      console.log(`  Idempotency Key: ${p.idempotencyKey}`);
      console.log(`  Card ID: ${p.cardId}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  Created: ${p.createdAt}`);
      console.log();
    });
  }

  // Query 3: Ledger entries for this account
  console.log('\nQUERY 3: Ledger Entries (Recent)');

  const ledgerRows = await db
    .select()
    .from(providerDistributorLedger)
    .where(
      and(
        eq(providerDistributorLedger.providerId, providerId),
        eq(providerDistributorLedger.distributorId, distributorId)
      )
    )
    .orderBy(desc(providerDistributorLedger.createdAt))
    .limit(10);

  if (ledgerRows.length === 0) {
    console.log('No ledger entries found');
  } else {
    console.log(`Found ${ledgerRows.length} recent ledger entries:\n`);
    ledgerRows.forEach((l, idx) => {
      console.log(`Entry ${idx + 1}:`);
      console.log(`  Type: ${(l as any).type}`);
      console.log(`  Amount: ${(l as any).amount}`);
      console.log(`  Balance After: ${(l as any).balanceAfterTransaction}`);
      console.log(`  Used Credit After: ${(l as any).usedCreditAfterTransaction}`);
      console.log(`  Reference: ${(l as any).referenceType} / ${(l as any).referenceId}`);
      console.log(`  Created: ${(l as any).createdAt}`);
      console.log();
    });
  }

  // Calculate correct final state
  console.log('\n=== RECONCILIATION CALCULATION ===\n');
  console.log('Starting State (before any purchases):');
  console.log('  balance: 5000.00');
  console.log('  credit_line: 5000.00');
  console.log('  used_credit: 0.00');
  console.log('  available: 10000.00\n');

  let calculatedBalance = 5000.00;
  let calculatedUsedCredit = 0.00;

  console.log('Replaying purchases with CORRECT logic:\n');

  // Get transaction amounts
  const txnRows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.providerId, providerId),
        eq(transactions.distributorId, distributorId)
      )
    );

  txnRows.forEach((p, idx) => {
    const amount = parseFloat((p as any).amount);
    const availableBefore = calculatedBalance + (5000.00 - calculatedUsedCredit);

    console.log(`Purchase ${idx + 1}: ${amount.toFixed(2)} LYD`);
    console.log(`  Before: balance=${calculatedBalance.toFixed(2)}, used_credit=${calculatedUsedCredit.toFixed(2)}, available=${availableBefore.toFixed(2)}`);

    if (calculatedBalance >= amount) {
      // Use balance only
      calculatedBalance = calculatedBalance - amount;
      console.log(`  Action: Deduct from balance only`);
    } else {
      // Use balance + credit
      const creditUsed = amount - calculatedBalance;
      const oldBalance = calculatedBalance;
      calculatedBalance = 0;
      calculatedUsedCredit = calculatedUsedCredit + creditUsed;
      console.log(`  Action: Use balance (${oldBalance.toFixed(2)}) + credit (${creditUsed.toFixed(2)})`);
    }

    const availableAfter = calculatedBalance + (5000.00 - calculatedUsedCredit);
    console.log(`  After: balance=${calculatedBalance.toFixed(2)}, used_credit=${calculatedUsedCredit.toFixed(2)}, available=${availableAfter.toFixed(2)}`);
    console.log();
  });

  console.log('\n=== RECONCILIATION SUMMARY ===\n');
  console.log('Current (BUGGY) State:');
  console.log(`  balance: ${currentBalance.toFixed(2)}`);
  console.log(`  used_credit: ${currentUsedCredit.toFixed(2)}`);
  console.log(`  available: ${currentAvailable.toFixed(2)}`);

  console.log('\nCorrect (FIXED) State:');
  console.log(`  balance: ${calculatedBalance.toFixed(2)}`);
  console.log(`  used_credit: ${calculatedUsedCredit.toFixed(2)}`);
  const correctAvailable = calculatedBalance + (5000.00 - calculatedUsedCredit);
  console.log(`  available: ${correctAvailable.toFixed(2)}`);

  console.log('\nDifferences:');
  console.log(`  balance: ${currentBalance.toFixed(2)} → ${calculatedBalance.toFixed(2)} (diff: ${(calculatedBalance - currentBalance).toFixed(2)})`);
  console.log(`  used_credit: ${currentUsedCredit.toFixed(2)} → ${calculatedUsedCredit.toFixed(2)} (diff: ${(calculatedUsedCredit - currentUsedCredit).toFixed(2)})`);
  console.log(`  available: ${currentAvailable.toFixed(2)} → ${correctAvailable.toFixed(2)} (diff: ${(correctAvailable - currentAvailable).toFixed(2)})`);

  console.log('\n=== RECONCILIATION SQL (IF APPROVED) ===\n');
  console.log(`UPDATE provider_distributor_accounts`);
  console.log(`SET`);
  console.log(`  balance = '${calculatedBalance.toFixed(2)}',`);
  console.log(`  used_credit = '${calculatedUsedCredit.toFixed(2)}',`);
  console.log(`  version = version + 1`);
  console.log(`WHERE id = ${(account as any).id};`);

  process.exit(0);
}

gatherEvidence().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
