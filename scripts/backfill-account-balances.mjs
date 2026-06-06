import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function backfillAccountBalances() {
  const conn = await pool.getConnection();
  try {
    console.log('Backfilling account balances based on transactions...');
    
    // Get all transactions grouped by distributor and provider
    const [txnSummary] = await conn.execute(`
      SELECT 
        distributor_id, 
        provider_id, 
        SUM(CAST(amount AS DECIMAL(10,2))) as total_amount,
        SUM(CAST(commission_amount AS DECIMAL(10,2))) as total_commission
      FROM transactions
      GROUP BY distributor_id, provider_id
    `);
    
    console.log('Found', txnSummary.length, 'distributor-provider combinations with transactions');
    
    for (const summary of txnSummary) {
      const distributorId = summary.distributor_id;
      const providerId = summary.provider_id;
      const totalSpent = parseFloat(summary.total_amount) || 0;
      const totalCommission = parseFloat(summary.total_commission) || 0;
      
      // Get current account
      const [accounts] = await conn.execute(
        'SELECT id, balance, credit_line, used_credit FROM provider_distributor_accounts WHERE distributor_id = ? AND provider_id = ?',
        [distributorId, providerId]
      );
      
      if (accounts.length === 0) {
        console.log(`  No account found for distributor ${distributorId}, provider ${providerId}`);
        continue;
      }
      
      const account = accounts[0];
      const currentBalance = parseFloat(account.balance);
      const currentUsedCredit = parseFloat(account.used_credit);
      
      // Calculate new balance and used credit
      const newUsedCredit = currentUsedCredit + totalSpent;
      const newBalance = currentBalance - totalSpent;
      
      // Update account
      await conn.execute(
        'UPDATE provider_distributor_accounts SET balance = ?, used_credit = ? WHERE distributor_id = ? AND provider_id = ?',
        [newBalance, newUsedCredit, distributorId, providerId]
      );
      
      console.log(`  Updated distributor ${distributorId}, provider ${providerId}:`);
      console.log(`    Spent: $${totalSpent.toFixed(2)}, Commission: $${totalCommission.toFixed(2)}`);
      console.log(`    New Balance: $${newBalance.toFixed(2)}, Used Credit: $${newUsedCredit.toFixed(2)}`);
    }
    
    console.log('Backfill complete!');
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

backfillAccountBalances().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
