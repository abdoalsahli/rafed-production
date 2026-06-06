import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/').pop() || 'prepaid_cards'
});

console.log('=== DATABASE STATE ANALYSIS ===\n');

const tables = [
  'users', 'organizations', 'organization_users', 'service_providers', 'distributors',
  'products', 'card_batches', 'cards', 'provider_distributor_relationships',
  'provider_distributor_accounts', 'provider_distributor_ledger', 'transactions',
  'notifications', 'api_credentials', 'api_logs'
];

console.log('TABLE RECORD COUNTS:');
console.log('='.repeat(50));

for (const table of tables) {
  try {
    const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`${table.padEnd(35)} : ${rows[0].count} records`);
  } catch (e) {
    console.log(`${table.padEnd(35)} : ERROR`);
  }
}

console.log('\n' + '='.repeat(50));
console.log('\nADMIN ACCOUNT CHECK:');
console.log('='.repeat(50));

try {
  const [rows] = await connection.execute(
    "SELECT id, email, name, role FROM users WHERE email = 'abdogiydan2000@gmail.com'"
  );
  if (rows.length > 0) {
    const user = rows[0];
    console.log(`✓ Admin account found:`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Name: ${user.name}`);
    console.log(`  - Role: ${user.role}`);
  } else {
    console.log(`✗ Admin account NOT found`);
  }
} catch (e) {
  console.log(`✗ Error checking admin account`);
}

console.log('\n' + '='.repeat(50));
console.log('\nDEMO USERS:');
console.log('='.repeat(50));

try {
  const [rows] = await connection.execute(
    "SELECT id, email, name, role FROM users WHERE email LIKE '%demo%' OR login_method = 'demo' ORDER BY email"
  );
  console.log(`Found ${rows.length} demo users:`);
  rows.forEach(user => {
    console.log(`  - ${user.email} (${user.role})`);
  });
} catch (e) {
  console.log(`Error checking demo users`);
}

await connection.end();
