import { getRawDb } from './server/db';

async function step6() {
  const pool = await getRawDb();
  if (!pool) throw new Error('Database not available');

  console.log('=== STEP 6: CLEAN POST-PATCH PURCHASE TEST ===\n');

  // Wait for queue processing
  console.log('Waiting for queue processing...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const distributorId = 1179498; // SEED_Anis Distribution
    const providerId = 1214740; // Libyana Telecom

    // Get account state AFTER purchase
    const [accRows] = await pool.query(`
SELECT
  pda.id,
  pda.balance,
  pda.credit_line,
  pda.used_credit,
  (pda.balance + (pda.credit_line - pda.used_credit)) AS available_to_spend,
  pda.version
FROM provider_distributor_accounts pda
WHERE pda.provider_id = ? AND pda.distributor_id = ?
    `, [providerId, distributorId]);

    const account = (accRows as any[])[0];
    console.log('POST-PURCHASE ACCOUNT STATE:');
    console.log(`  Balance: ${account.balance} (expected: 4990.00)`);
    console.log(`  Credit Line: ${account.credit_line}`);
    console.log(`  Used Credit: ${account.used_credit} (expected: 0.00)`);
    console.log(`  Available: ${account.available_to_spend} (expected: 9990.00)`);
    console.log(`  Version: ${account.version} (expected: 2)\n`);

    // Get latest transaction
    const [txnRows] = await pool.query(`
SELECT 
  t.id,
  t.amount,
  t.commission_amount,
  t.status,
  t.card_id,
  t.created_at
FROM transactions t
WHERE t.provider_id = ? AND t.distributor_id = ?
ORDER BY t.created_at DESC
LIMIT 1
    `, [providerId, distributorId]);

    const transaction = (txnRows as any[])[0];
    console.log('LATEST TRANSACTION:');
    console.log(`  ID: ${transaction.id}`);
    console.log(`  Amount: ${transaction.amount} (expected: 10.00)`);
    console.log(`  Commission: ${transaction.commission_amount} (expected: 0.50)`);
    console.log(`  Status: ${transaction.status} (expected: completed)`);
    console.log(`  Card ID: ${transaction.card_id}\n`);

    // Get card status
    const [cardRows] = await pool.query(`
SELECT status, COUNT(*) as count
FROM cards
WHERE batch_id = (
  SELECT batch_id FROM cards WHERE id = ?
)
GROUP BY status
    `, [transaction.card_id]);

    console.log('CARD STATUS DISTRIBUTION:');
    (cardRows as any[]).forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Get ledger entries
    const [ledgerRows] = await pool.query(`
SELECT 
  type,
  amount,
  balance_after_transaction,
  used_credit_after_transaction,
  reference_type,
  reference_id
FROM provider_distributor_ledger
WHERE provider_id = ? AND distributor_id = ?
ORDER BY created_at DESC
LIMIT 2
    `, [providerId, distributorId]);

    console.log(`\nLEDGER ENTRIES (latest 2):`);
    (ledgerRows as any[]).forEach((entry, idx) => {
      console.log(`  ${idx + 1}. Type: ${entry.type}, Amount: ${entry.amount}`);
      console.log(`     Balance After: ${entry.balance_after_transaction}`);
      console.log(`     Used Credit After: ${entry.used_credit_after_transaction}`);
      console.log(`     Reference: ${entry.reference_type} / ${entry.reference_id}\n`);
    });

    // Verify correctness
    console.log('=== VERIFICATION ===');
    const balanceCorrect = parseFloat(account.balance) === 4990.00;
    const usedCreditCorrect = parseFloat(account.used_credit) === 0.00;
    const availableCorrect = parseFloat(account.available_to_spend) === 9990.00;
    const versionCorrect = account.version === 2;
    const amountCorrect = parseFloat(transaction.amount) === 10.00;
    const commissionCorrect = parseFloat(transaction.commission_amount) === 0.50;
    const ledgerCount = (ledgerRows as any[]).length;

    console.log(`Balance correct (4990.00): ${balanceCorrect ? '✓' : '✗'}`);
    console.log(`Used credit correct (0.00): ${usedCreditCorrect ? '✓' : '✗'}`);
    console.log(`Available correct (9990.00): ${availableCorrect ? '✓' : '✗'}`);
    console.log(`Version correct (2): ${versionCorrect ? '✓' : '✗'}`);
    console.log(`Amount correct (10.00): ${amountCorrect ? '✓' : '✗'}`);
    console.log(`Commission correct (0.50): ${commissionCorrect ? '✓' : '✗'}`);
    console.log(`Ledger entries created (2): ${ledgerCount === 2 ? '✓' : '✗'}`);

    const allCorrect = balanceCorrect && usedCreditCorrect && availableCorrect && versionCorrect && amountCorrect && commissionCorrect && ledgerCount === 2;

    console.log(`\n=== RESULT ===`);
    if (allCorrect) {
      console.log('✓ PATCH VERIFIED - All assertions passed!');
      console.log('✓ ACCOUNTS BACKFILLED AND PATCH VERIFIED');
    } else {
      console.log('✗ PATCH VERIFICATION FAILED');
    }

  } catch (err) {
    console.error('Query error:', err);
  }

  process.exit(0);
}

step6().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
