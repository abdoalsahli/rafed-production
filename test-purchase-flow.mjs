import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL);

async function testPurchaseFlow() {
  const conn = await pool.getConnection();
  try {
    console.log('\n=== END-TO-END PURCHASE FLOW TEST ===\n');

    // 1. Get test distributor
    const [distRows] = await conn.execute(
      `SELECT id, name FROM distributors WHERE name LIKE 'SEED_Anis%' LIMIT 1`
    );
    if (!distRows || distRows.length === 0) {
      console.log('❌ No test distributor found');
      return;
    }
    const distributorId = distRows[0].id;
    const distributorName = distRows[0].name;
    console.log(`✓ Found distributor: ${distributorName} (ID: ${distributorId})`);

    // 2. Get provider relationships
    const [providerRows] = await conn.execute(
      `SELECT pdr.id, pdr.provider_id, sp.name as provider_name, pdr.commission_percentage
       FROM provider_distributor_relationships pdr
       JOIN service_providers sp ON pdr.provider_id = sp.id
       WHERE pdr.distributor_id = ? LIMIT 1`,
      [distributorId]
    );
    if (!providerRows || providerRows.length === 0) {
      console.log('❌ No provider relationships found');
      return;
    }
    const providerId = providerRows[0].provider_id;
    const providerName = providerRows[0].provider_name;
    const commissionRate = parseFloat(providerRows[0].commission_percentage);
    console.log(`✓ Found provider: ${providerName} (ID: ${providerId}, Commission: ${commissionRate}%)`);

    // 3. Get account before purchase
    const [accountBefore] = await conn.execute(
      `SELECT balance, used_credit FROM provider_distributor_accounts 
       WHERE distributor_id = ? AND provider_id = ?`,
      [distributorId, providerId]
    );
    const balanceBefore = accountBefore && accountBefore.length > 0 
      ? parseFloat(accountBefore[0].balance) 
      : 0;
    const usedCreditBefore = accountBefore && accountBefore.length > 0 
      ? parseFloat(accountBefore[0].used_credit) 
      : 0;
    console.log(`\n📊 Account Before Purchase:`);
    console.log(`   Balance: $${balanceBefore.toFixed(2)}`);
    console.log(`   Used Credit: $${usedCreditBefore.toFixed(2)}`);

    // 4. Get available products
    const [productRows] = await conn.execute(
      `SELECT id, name, price FROM products 
       WHERE provider_id = ? AND status = 'active' LIMIT 1`,
      [providerId]
    );
    if (!productRows || productRows.length === 0) {
      console.log('❌ No active products found');
      return;
    }
    const productId = productRows[0].id;
    const productName = productRows[0].name;
    const productPrice = parseFloat(productRows[0].price);
    console.log(`\n📦 Product: ${productName} (ID: ${productId}, Price: $${productPrice.toFixed(2)})`);

    // 5. Simulate purchase (just query the data, don't actually insert)
    const purchaseAmount = productPrice;
    const commission = (purchaseAmount * commissionRate) / 100;
    const expectedBalanceAfter = balanceBefore - purchaseAmount + commission;
    const expectedUsedCreditAfter = usedCreditBefore;

    console.log(`\n💰 Purchase Simulation:`);
    console.log(`   Purchase Amount: $${purchaseAmount.toFixed(2)}`);
    console.log(`   Commission (${commissionRate}%): $${commission.toFixed(2)}`);
    console.log(`   Net Impact: -$${(purchaseAmount - commission).toFixed(2)}`);

    console.log(`\n📊 Expected Account After Purchase:`);
    console.log(`   Balance: $${expectedBalanceAfter.toFixed(2)}`);
    console.log(`   Used Credit: $${expectedUsedCreditAfter.toFixed(2)}`);

    // 6. Check ledger entries
    const [ledgerRows] = await conn.execute(
      `SELECT COUNT(*) as count, SUM(amount) as total_amount 
       FROM provider_distributor_ledger 
       WHERE distributor_id = ? AND provider_id = ?`,
      [distributorId, providerId]
    );
    const ledgerCount = ledgerRows[0].count;
    const ledgerTotal = ledgerRows[0].total_amount ? parseFloat(ledgerRows[0].total_amount) : 0;
    console.log(`\n📋 Ledger Status:`);
    console.log(`   Total Entries: ${ledgerCount}`);
    console.log(`   Total Amount: $${ledgerTotal.toFixed(2)}`);

    // 7. Check recent transactions
    const [transactionRows] = await conn.execute(
      `SELECT id, type, amount, status, created_at 
       FROM transactions 
       WHERE distributor_id = ? AND provider_id = ? 
       ORDER BY created_at DESC LIMIT 3`,
      [distributorId, providerId]
    );
    console.log(`\n📝 Recent Transactions:`);
    if (transactionRows && transactionRows.length > 0) {
      transactionRows.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ${tx.type} - $${parseFloat(tx.amount).toFixed(2)} (${tx.status})`);
      });
    } else {
      console.log(`   No transactions found`);
    }

    console.log(`\n✓ Test complete\n`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

testPurchaseFlow();
