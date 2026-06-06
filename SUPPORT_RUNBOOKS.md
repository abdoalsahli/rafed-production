# Support Runbooks (Phases 12-19)

## Quick Reference

| Issue | Severity | Resolution Time | Page |
|-------|----------|-----------------|------|
| High error rate | CRITICAL | 5 min | [Link](#high-error-rate) |
| Dead letter queue spike | HIGH | 15 min | [Link](#dead-letter-queue-spike) |
| Rate limit violations | MEDIUM | 10 min | [Link](#rate-limit-violations) |
| High latency | MEDIUM | 20 min | [Link](#high-latency) |
| Database connection pool full | CRITICAL | 5 min | [Link](#database-connection-pool-full) |
| Webhook delivery failures | HIGH | 15 min | [Link](#webhook-delivery-failures) |

---

## High Error Rate

**Symptoms**:
- Error rate > 1%
- Alert: `HIGH_ERROR_RATE`
- Users reporting failures

**Immediate Actions** (0-5 min):
```bash
# 1. Check recent errors
SELECT level, message, COUNT(*) as count 
FROM structured_logs 
WHERE timestamp > NOW() - INTERVAL 5 MINUTE 
AND level = 'ERROR' 
GROUP BY level, message 
ORDER BY count DESC LIMIT 10;

# 2. Check if specific distributor affected
SELECT distributor_id, COUNT(*) as error_count 
FROM structured_logs 
WHERE timestamp > NOW() - INTERVAL 5 MINUTE 
AND level = 'ERROR' 
GROUP BY distributor_id 
ORDER BY error_count DESC;

# 3. Check database health
SELECT 
  COUNT(*) as total_connections,
  SUM(CASE WHEN command = 'Sleep' THEN 1 ELSE 0 END) as idle_connections
FROM information_schema.PROCESSLIST;
```

**Diagnosis** (5-10 min):
```bash
# Check for specific error patterns
SELECT message, COUNT(*) as count 
FROM structured_logs 
WHERE timestamp > NOW() - INTERVAL 10 MINUTE 
AND level = 'ERROR' 
GROUP BY message 
ORDER BY count DESC;

# Check if rate limiting is causing errors
SELECT COUNT(*) as rate_limit_errors 
FROM structured_logs 
WHERE timestamp > NOW() - INTERVAL 10 MINUTE 
AND message LIKE '%RATE_LIMITED%';

# Check database performance
SHOW PROCESSLIST;
SHOW ENGINE INNODB STATUS;
```

**Resolution**:
- **If database connection pool full**: Increase `connectionLimit` in `server/_core/db.ts`
- **If specific distributor causing errors**: Contact distributor to optimize API usage
- **If rate limiting causing errors**: Verify rate limits are appropriate
- **If provider unavailable**: Check provider status and webhook endpoints

**Escalation**:
- If error rate remains > 1% after 15 min: Page on-call engineer
- If database is down: Failover to backup database

---

## Dead Letter Queue Spike

**Symptoms**:
- DLQ size > 100
- Alert: `DEAD_LETTER_SPIKE`
- Webhooks not being delivered

**Immediate Actions** (0-5 min):
```bash
# 1. Check DLQ size
SELECT COUNT(*) as dlq_size 
FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND updated_at > NOW() - INTERVAL 1 HOUR;

# 2. Check which providers have failures
SELECT provider_id, COUNT(*) as failure_count 
FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND updated_at > NOW() - INTERVAL 1 HOUR 
GROUP BY provider_id 
ORDER BY failure_count DESC;

# 3. Check webhook endpoint status
SELECT webhook_url, COUNT(*) as failure_count 
FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND updated_at > NOW() - INTERVAL 1 HOUR 
GROUP BY webhook_url 
ORDER BY failure_count DESC LIMIT 5;
```

**Diagnosis** (5-10 min):
```bash
# Check error messages from failed deliveries
SELECT 
  webhook_url,
  response_status_code,
  response_body,
  COUNT(*) as count 
FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND updated_at > NOW() - INTERVAL 1 HOUR 
GROUP BY webhook_url, response_status_code 
ORDER BY count DESC;

# Check if provider webhooks are accessible
curl -I https://provider-webhook-endpoint.com/webhooks

# Check network connectivity
ping provider-webhook-endpoint.com
```

**Resolution**:
1. **If provider endpoint is down**:
   - Contact provider to restore endpoint
   - Use manual replay once endpoint is back online

2. **If network connectivity issue**:
   - Check firewall rules
   - Verify DNS resolution
   - Check proxy configuration

3. **If provider rejecting webhooks**:
   - Verify webhook signature (HMAC-SHA256)
   - Check webhook payload format
   - Review provider webhook logs

**Manual Replay**:
```bash
# Get failed webhook IDs
SELECT id FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND updated_at > NOW() - INTERVAL 1 HOUR 
LIMIT 10;

# Replay webhooks via tRPC
curl -X POST http://localhost:3000/api/trpc/webhookResilience.replayWebhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"webhookDeliveryId": 123}'
```

**Escalation**:
- If DLQ > 1000: Page on-call engineer
- If provider endpoint down > 1 hour: Escalate to provider support

---

## Rate Limit Violations

**Symptoms**:
- Clients receiving 429 responses
- Alert: `RATE_LIMIT_VIOLATIONS`
- Requests: `${endpoint} rate limited`

**Immediate Actions** (0-5 min):
```bash
# 1. Check rate limit violations
SELECT 
  endpoint,
  COUNT(*) as violation_count,
  COUNT(DISTINCT distributor_id) as affected_distributors
FROM rate_limit_events 
WHERE timestamp > NOW() - INTERVAL 1 HOUR 
GROUP BY endpoint 
ORDER BY violation_count DESC;

# 2. Identify top violators
SELECT 
  distributor_id,
  endpoint,
  COUNT(*) as violation_count 
FROM rate_limit_events 
WHERE timestamp > NOW() - INTERVAL 1 HOUR 
GROUP BY distributor_id, endpoint 
ORDER BY violation_count DESC LIMIT 10;

# 3. Check if legitimate traffic
SELECT 
  distributor_id,
  endpoint,
  COUNT(*) as request_count,
  MIN(timestamp) as first_request,
  MAX(timestamp) as last_request
FROM rate_limit_events 
WHERE timestamp > NOW() - INTERVAL 1 HOUR 
GROUP BY distributor_id, endpoint 
ORDER BY request_count DESC;
```

**Diagnosis** (5-10 min):
```bash
# Check if distributor has legitimate high volume
SELECT 
  d.id,
  d.name,
  COUNT(p.id) as purchase_count
FROM distributors d 
LEFT JOIN purchase_requests p ON d.id = p.distributor_id 
WHERE p.created_at > NOW() - INTERVAL 1 DAY 
GROUP BY d.id, d.name 
ORDER BY purchase_count DESC;

# Check if rate limit is too strict
SELECT 
  endpoint,
  COUNT(*) as requests_per_minute
FROM rate_limit_events 
WHERE timestamp > NOW() - INTERVAL 1 MINUTE 
GROUP BY endpoint;
```

**Resolution**:
1. **If distributor has legitimate high volume**:
   - Increase rate limit for that distributor
   - Implement request batching on client side
   - Optimize API usage patterns

2. **If rate limit is too strict**:
   - Increase rate limit globally
   - Implement tiered rate limits based on distributor tier

3. **If distributor is abusing API**:
   - Contact distributor to optimize usage
   - Implement IP-based rate limiting
   - Consider temporary suspension

**Increase Rate Limit**:
```bash
# Update rate limit in RateLimiterService
# In server/services/rate-limiter.service.ts, modify:
const RATE_LIMITS = {
  products: 120,      // Increased from 60
  purchases: 120,     // Increased from 60
  polling: 240,       // Increased from 120
  webhook_replay: 60, // Increased from 30
};
```

**Escalation**:
- If violations > 10,000/hour: Page on-call engineer
- If distributor abusing API: Escalate to account management

---

## High Latency

**Symptoms**:
- P95 latency > 1000ms
- P99 latency > 5000ms
- Alert: `HIGH_LATENCY`
- Users reporting slow responses

**Immediate Actions** (0-5 min):
```bash
# 1. Check current latency
SELECT 
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_ms
FROM metrics_purchase_latency 
WHERE timestamp > NOW() - INTERVAL 5 MINUTE;

# 2. Check if specific distributor affected
SELECT 
  distributor_id,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_ms,
  COUNT(*) as request_count
FROM metrics_purchase_latency 
WHERE timestamp > NOW() - INTERVAL 5 MINUTE 
GROUP BY distributor_id 
ORDER BY p95_ms DESC LIMIT 5;

# 3. Check database query performance
SHOW PROCESSLIST;
SELECT * FROM information_schema.INNODB_TRX;
```

**Diagnosis** (5-10 min):
```bash
# Check for slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;

# Check database lock contention
SELECT * FROM information_schema.INNODB_LOCKS;

# Check connection pool utilization
SELECT 
  COUNT(*) as total_connections,
  SUM(CASE WHEN command = 'Sleep' THEN 1 ELSE 0 END) as idle_connections,
  SUM(CASE WHEN command != 'Sleep' THEN 1 ELSE 0 END) as active_connections
FROM information_schema.PROCESSLIST;

# Check if specific queries are slow
SELECT 
  endpoint,
  AVG(latency_ms) as avg_latency_ms,
  MAX(latency_ms) as max_latency_ms,
  COUNT(*) as request_count
FROM metrics_purchase_latency 
WHERE timestamp > NOW() - INTERVAL 10 MINUTE 
GROUP BY endpoint 
ORDER BY avg_latency_ms DESC;
```

**Resolution**:
1. **If database is slow**:
   - Check for table locks: `SHOW OPEN TABLES WHERE In_use > 0;`
   - Kill long-running queries: `KILL <query_id>;`
   - Optimize slow queries with EXPLAIN
   - Add missing indexes

2. **If connection pool exhausted**:
   - Increase `connectionLimit` in `server/_core/db.ts`
   - Restart application to apply changes
   - Monitor connection usage

3. **If specific endpoint slow**:
   - Profile endpoint with `EXPLAIN`
   - Add caching if applicable
   - Optimize query or consider pagination

**Optimize Query**:
```bash
# Example: Slow purchase query
EXPLAIN SELECT * FROM purchase_requests 
WHERE distributor_id = 1 
AND created_at > NOW() - INTERVAL 1 DAY;

# Add index if missing
ALTER TABLE purchase_requests 
ADD INDEX idx_distributor_created (distributor_id, created_at);
```

**Escalation**:
- If P99 > 10,000ms: Page on-call engineer
- If database unresponsive: Failover to backup database

---

## Database Connection Pool Full

**Symptoms**:
- Errors: "No connections available"
- Alert: `CONNECTION_POOL_EXHAUSTED`
- All requests failing

**Immediate Actions** (0-5 min):
```bash
# 1. Check connection pool status
SELECT 
  COUNT(*) as total_connections,
  SUM(CASE WHEN command = 'Sleep' THEN 1 ELSE 0 END) as idle_connections,
  SUM(CASE WHEN command != 'Sleep' THEN 1 ELSE 0 END) as active_connections
FROM information_schema.PROCESSLIST;

# 2. Kill idle connections
SELECT CONCAT('KILL ', id, ';') 
FROM information_schema.PROCESSLIST 
WHERE command = 'Sleep' 
AND time > 300;

# 3. Restart application
pkill -f "node dist/index.js"
NODE_ENV=production node dist/index.js
```

**Diagnosis** (5-10 min):
```bash
# Check for connection leaks
SELECT * FROM information_schema.PROCESSLIST 
WHERE command != 'Sleep' 
ORDER BY time DESC;

# Check if specific query is holding connections
SELECT * FROM information_schema.INNODB_TRX;

# Check application logs for connection errors
tail -f logs/server.log | grep -i "connection"
```

**Resolution**:
1. **Increase connection pool size**:
   ```typescript
   // In server/_core/db.ts
   const pool = mysql.createPool({
     connectionLimit: 20, // Increased from 10
     waitForConnections: true,
   });
   ```

2. **Fix connection leaks**:
   - Ensure all database queries release connections
   - Check for unclosed transactions
   - Review error handling in services

3. **Implement connection monitoring**:
   ```bash
   # Monitor connection usage
   SELECT 
     COUNT(*) as connections,
     SUM(CASE WHEN command = 'Sleep' THEN 1 ELSE 0 END) as idle
   FROM information_schema.PROCESSLIST;
   ```

**Escalation**:
- If connection pool full > 5 min: Page on-call engineer
- If application unresponsive: Failover to backup instance

---

## Webhook Delivery Failures

**Symptoms**:
- Webhooks not being delivered
- Alert: `WEBHOOK_DELIVERY_FAILED`
- Distributor reports missing updates

**Immediate Actions** (0-5 min):
```bash
# 1. Check webhook delivery status
SELECT 
  delivery_status,
  COUNT(*) as count
FROM webhook_events 
WHERE created_at > NOW() - INTERVAL 1 HOUR 
GROUP BY delivery_status;

# 2. Check failed webhooks
SELECT 
  id,
  webhook_url,
  response_status_code,
  response_body,
  created_at
FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND created_at > NOW() - INTERVAL 1 HOUR 
ORDER BY created_at DESC LIMIT 10;

# 3. Check webhook configuration
SELECT 
  d.id,
  d.name,
  d.webhook_url,
  COUNT(we.id) as webhook_count
FROM distributors d 
LEFT JOIN webhook_events we ON d.id = we.distributor_id 
WHERE we.created_at > NOW() - INTERVAL 1 HOUR 
GROUP BY d.id, d.name, d.webhook_url;
```

**Diagnosis** (5-10 min):
```bash
# Test webhook endpoint
curl -X POST https://distributor-webhook.com/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=..." \
  -d '{
    "event": "purchase.completed",
    "data": {"purchaseId": "test"}
  }'

# Check webhook signature verification
SELECT 
  webhook_url,
  response_status_code,
  COUNT(*) as count
FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND created_at > NOW() - INTERVAL 1 HOUR 
GROUP BY webhook_url, response_status_code;

# Check if distributor webhook URL is correct
SELECT * FROM distributors WHERE id = <distributor_id>;
```

**Resolution**:
1. **If webhook endpoint is down**:
   - Contact distributor to restore endpoint
   - Use manual replay once restored

2. **If webhook signature verification failing**:
   - Verify webhook signing key is correct
   - Check HMAC-SHA256 implementation
   - Review webhook signature format

3. **If distributor webhook URL incorrect**:
   - Update webhook URL in database
   - Retry failed webhooks

**Manual Replay Failed Webhooks**:
```bash
# Get failed webhook IDs
SELECT id FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND created_at > NOW() - INTERVAL 1 HOUR 
LIMIT 10;

# Replay via API
for webhook_id in $(mysql -N -e "SELECT id FROM webhook_events WHERE delivery_status = 'FAILED_DELIVERY' LIMIT 10;"); do
  curl -X POST http://localhost:3000/api/trpc/webhookResilience.replayWebhook \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{\"webhookDeliveryId\": $webhook_id}"
done
```

**Escalation**:
- If webhooks failing > 1 hour: Page on-call engineer
- If distributor endpoint down > 4 hours: Escalate to provider support

---

## Contact Information

- **On-Call Engineer**: [PagerDuty Link]
- **Database Team**: [Slack Channel]
- **Provider Support**: [Support Portal]
- **Customer Support**: support@manus.im

---

**Last Updated**: May 19, 2026
**Version**: 1.0.0
