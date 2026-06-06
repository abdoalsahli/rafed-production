import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);

try {
  console.log('\n=== BACKFILL MISSING ACCOUNTS ===\n');
  
  // Get the distributor with missing accounts
  const [distributors] = await connection.execute(
    'SELECT id, name FROM distributors WHERE id = 1179501'
  );
  
  if (distributors.length === 0) {
    console.log('✗ Distributor 1179501 not found');
    process.exit(1);
  }
  
  const distributor = distributors[0];
  console.log(`Found distributor: ${distributor.name} (ID: ${distributor.id})`);
  
  // Get all providers this distributor has relationships with
  const [relationships] = await connection.execute(
    `SELECT DISTINCT provider_id FROM provider_distributor_relationships 
     WHERE distributor_id = ?`,
    [distributor.id]
  );
  
  console.log(`\nFound ${relationships.length} provider relationships`);
  
  // Get provider details
  const [providers] = await connection.execute(
    `SELECT id, name FROM service_providers WHERE id IN (${relationships.map(() => '?').join(',')})`,
    relationships.map(r => r.provider_id)
  );
  
  console.log(`Providers: ${providers.map(p => `${p.name} (${p.id})`).join(', ')}`);
  
  // Check which accounts are missing
  const [existingAccounts] = await connection.execute(
    `SELECT provider_id FROM provider_distributor_accounts 
     WHERE distributor_id = ? AND provider_id IN (${relationships.map(() => '?').join(',')})`,
    [distributor.id, ...relationships.map(r => r.provider_id)]
  );
  
  const existingProviderIds = new Set(existingAccounts.map(a => a.provider_id));
  const missingProviders = providers.filter(p => !existingProviderIds.has(p.id));
  
  console.log(`\nExisting accounts: ${existingAccounts.length}`);
  console.log(`Missing accounts: ${missingProviders.length}`);
  
  if (missingProviders.length === 0) {
    console.log('\n✓ All accounts already exist');
    process.exit(0);
  }
  
  // Create missing accounts with $5,000 balance and $5,000 credit line
  console.log('\nCreating missing accounts...');
  
  for (const provider of missingProviders) {
    const now = new Date();
    await connection.execute(
      `INSERT INTO provider_distributor_accounts 
       (provider_id, distributor_id, balance, credit_line, used_credit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [provider.id, distributor.id, 5000, 5000, 0, now, now]
    );
    console.log(`  ✓ Created account for ${provider.name} (${provider.id})`);
  }
  
  // Verify the backfill
  console.log('\n=== VERIFICATION ===');
  const [finalAccounts] = await connection.execute(
    `SELECT provider_id, balance, credit_line, used_credit FROM provider_distributor_accounts 
     WHERE distributor_id = ? ORDER BY provider_id`,
    [distributor.id]
  );
  
  console.log(`\nFinal account count: ${finalAccounts.length}`);
  finalAccounts.forEach(acc => {
    console.log(`  - Provider ${acc.provider_id}: Balance=$${acc.balance}, Credit=$${acc.credit_line}, Used=$${acc.used_credit}`);
  });
  
  console.log('\n✓ Backfill complete');
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
