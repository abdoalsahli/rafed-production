import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

try {
  const connection = await mysql.createConnection(url);
  
  const query = `
    SELECT 'users' as table_name, COUNT(*) as record_count FROM users
    UNION ALL
    SELECT 'serviceProviders', COUNT(*) FROM service_providers
    UNION ALL
    SELECT 'distributors', COUNT(*) FROM distributors
    UNION ALL
    SELECT 'products', COUNT(*) FROM products
    UNION ALL
    SELECT 'cardBatches', COUNT(*) FROM card_batches
    UNION ALL
    SELECT 'cards', COUNT(*) FROM cards
    UNION ALL
    SELECT 'wallets', COUNT(*) FROM wallets
    UNION ALL
    SELECT 'walletLedger', COUNT(*) FROM wallet_ledger
    UNION ALL
    SELECT 'transactions', COUNT(*) FROM transactions
    UNION ALL
    SELECT 'providerDistributorCommission', COUNT(*) FROM provider_distributor_commission
    UNION ALL
    SELECT 'providerDistributorRelationships', COUNT(*) FROM provider_distributor_relationships
    UNION ALL
    SELECT 'providerDistributorAccounts', COUNT(*) FROM provider_distributor_accounts
    UNION ALL
    SELECT 'providerDistributorLedger', COUNT(*) FROM provider_distributor_ledger
    UNION ALL
    SELECT 'purchaseRequests', COUNT(*) FROM purchase_requests
    UNION ALL
    SELECT 'accessRequests', COUNT(*) FROM access_requests
    UNION ALL
    SELECT 'apiLogs', COUNT(*) FROM api_logs
    UNION ALL
    SELECT 'distributorApiCredentials', COUNT(*) FROM distributor_api_credentials
    UNION ALL
    SELECT 'notifications', COUNT(*) FROM notifications
    UNION ALL
    SELECT 'organizations', COUNT(*) FROM organizations
    UNION ALL
    SELECT 'organizationUsers', COUNT(*) FROM organization_users
    UNION ALL
    SELECT 'auditLogs', COUNT(*) FROM audit_logs
    UNION ALL
    SELECT 'monitoringAlerts', COUNT(*) FROM monitoring_alerts
    UNION ALL
    SELECT 'usersExtended', COUNT(*) FROM users_extended
  `;
  
  const [rows] = await connection.execute(query);
  console.log(JSON.stringify(rows, null, 2));
  await connection.end();
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
