-- Get admin user info
SELECT id, email, name, role, status FROM users WHERE email = 'abdogiydan2000@gmail.com' LIMIT 1;

-- Get all users
SELECT id, email, name, role, status FROM users;

-- Count records per table
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'service_providers', COUNT(*) FROM service_providers
UNION ALL SELECT 'distributors', COUNT(*) FROM distributors
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'card_batches', COUNT(*) FROM card_batches
UNION ALL SELECT 'cards', COUNT(*) FROM cards
UNION ALL SELECT 'wallets', COUNT(*) FROM wallets
UNION ALL SELECT 'wallet_ledger', COUNT(*) FROM wallet_ledger
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'provider_distributor_commission', COUNT(*) FROM provider_distributor_commission
UNION ALL SELECT 'provider_distributor_relationships', COUNT(*) FROM provider_distributor_relationships
UNION ALL SELECT 'provider_distributor_accounts', COUNT(*) FROM provider_distributor_accounts
UNION ALL SELECT 'provider_distributor_ledger', COUNT(*) FROM provider_distributor_ledger
UNION ALL SELECT 'purchase_requests', COUNT(*) FROM purchase_requests
UNION ALL SELECT 'access_requests', COUNT(*) FROM access_requests
UNION ALL SELECT 'api_logs', COUNT(*) FROM api_logs
UNION ALL SELECT 'distributor_api_credentials', COUNT(*) FROM distributor_api_credentials
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'organization_users', COUNT(*) FROM organization_users
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'monitoring_alerts', COUNT(*) FROM monitoring_alerts
UNION ALL SELECT 'users_extended', COUNT(*) FROM users_extended;
