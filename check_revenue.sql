-- Check provider ledger entries
SELECT 
  'LEDGER' as source,
  provider_id,
  reference_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM provider_distributor_ledger
WHERE reference_type = 'purchase_debit'
GROUP BY provider_id, reference_type;

-- Check transactions
SELECT 
  'TRANSACTIONS' as source,
  provider_id,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM transactions
WHERE status = 'SUCCEEDED'
GROUP BY provider_id, status;
