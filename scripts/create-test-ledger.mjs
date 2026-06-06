import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function createTestLedgerEntries() {
  const conn = await pool.getConnection();
  try {
    console.log('Creating test ledger entries for distributor 1179498...');
    
    // Get provider for this distributor
    const [providers] = await conn.execute(
      'SELECT provider_id FROM provider_distributor_relationships WHERE distributor_id = 1179498 LIMIT 1'
    );
    
    if (!providers || providers.length === 0) {
      console.log('No providers connected');
      process.exit(0);
    }
    
    const providerId = providers[0].provider_id;
    console.log('Using provider:', providerId);
    
    // Create 5 test ledger entries (DEBIT for purchases)
    for (let i = 0; i < 5; i++) {
      const requestId = 90100 + i;
      const amount = '5.00';
      const balance = (10000 - (i + 1) * 5).toFixed(2);
      const usedCredit = ((i + 1) * 5).toFixed(2);
      
      await conn.execute(
        `INSERT INTO ledger_entries (
          distributor_id, provider_id, type, amount, balance_after_transaction,
          used_credit_after_transaction, reference_id, reference_type, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [1179498, providerId, 'DEBIT', amount, balance, usedCredit, String(requestId), 'purchase', JSON.stringify({requestId})]
      );
      
      // Also create CREDIT entry for commission
      const commission = '0.25';
      const commissionBalance = (parseFloat(balance) + parseFloat(commission)).toFixed(2);
      
      await conn.execute(
        `INSERT INTO ledger_entries (
          distributor_id, provider_id, type, amount, balance_after_transaction,
          used_credit_after_transaction, reference_id, reference_type, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [1179498, providerId, 'CREDIT', commission, commissionBalance, usedCredit, String(requestId), 'commission_credit', JSON.stringify({requestId, rate: '5%'})]
      );
    }
    
    console.log('Created 10 test ledger entries (5 DEBIT + 5 CREDIT)');
    
    // Verify
    const [count] = await conn.execute(
      'SELECT COUNT(*) as cnt FROM ledger_entries WHERE distributor_id = 1179498'
    );
    console.log('Total ledger entries for distributor 1179498:', count[0].cnt);
    
  } finally {
    conn.release();
    process.exit(0);
  }
}

createTestLedgerEntries().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
