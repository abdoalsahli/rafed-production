# Deployment Guide

This guide covers deploying the Prepaid Card Platform to production, with emphasis on secure PIN encryption configuration.

## Pre-Deployment Requirements

### 1. Generate PIN Encryption Key

Before deploying, generate a cryptographically secure PIN encryption key:

```bash
# Generate 32-byte hex key
PIN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "PIN_ENCRYPTION_KEY=$PIN_ENCRYPTION_KEY"
```

**Store this key securely** in your secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.).

### 2. Prepare Database

Ensure your production database is:
- ✅ Accessible from the deployment environment
- ✅ Properly migrated with all schema changes
- ✅ Backed up before deployment
- ✅ Connection string available as DATABASE_URL

### 3. Configure OAuth

Obtain from Manus platform:
- ✅ VITE_APP_ID
- ✅ OAUTH_SERVER_URL
- ✅ VITE_OAUTH_PORTAL_URL

### 4. Generate JWT Secret

Generate a strong JWT secret:

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
echo "JWT_SECRET=$JWT_SECRET"
```

## Environment Variables Checklist

Before deployment, ensure these environment variables are set:

| Variable | Required | Format | Source |
|----------|----------|--------|--------|
| PIN_ENCRYPTION_KEY | ✅ Yes | 64-char hex | Generate (see above) |
| DATABASE_URL | ✅ Yes | mysql://... | Your database |
| JWT_SECRET | ✅ Yes | Random string | Generate (see above) |
| VITE_APP_ID | ✅ Yes | String | Manus platform |
| OAUTH_SERVER_URL | ✅ Yes | URL | Manus platform |
| VITE_OAUTH_PORTAL_URL | ✅ Yes | URL | Manus platform |
| NODE_ENV | ✅ Yes | "production" | Set to production |
| PORT | ❌ No | Number | Default: 3000 |

## Deployment Steps

### Step 1: Build Application

```bash
# Install dependencies
pnpm install

# Build frontend
pnpm build

# Build backend (if needed)
pnpm build:server
```

### Step 2: Set Environment Variables

Using your secrets manager, set all required variables:

```bash
# AWS Secrets Manager example
aws secretsmanager create-secret \
  --name prepaid-card-platform/production \
  --secret-string '{
    "PIN_ENCRYPTION_KEY": "...",
    "DATABASE_URL": "...",
    "JWT_SECRET": "...",
    "VITE_APP_ID": "...",
    "OAUTH_SERVER_URL": "...",
    "VITE_OAUTH_PORTAL_URL": "..."
  }'
```

### Step 3: Deploy Application

```bash
# Deploy to your platform (example: Manus)
# The application will automatically validate all configuration on startup

# Or deploy to your own infrastructure
docker build -t prepaid-card-platform .
docker run -e PIN_ENCRYPTION_KEY=$PIN_ENCRYPTION_KEY \
           -e DATABASE_URL=$DATABASE_URL \
           -e JWT_SECRET=$JWT_SECRET \
           -e NODE_ENV=production \
           prepaid-card-platform
```

### Step 4: Verify Startup

The application performs **strict validation** of PIN_ENCRYPTION_KEY at startup and will **exit immediately** (exit code 1) if validation fails.

**Successful startup output:**
```
✅ PIN_ENCRYPTION_KEY is properly configured
Server running on http://localhost:3000/
```

**Failed startup output (example):**
```
═══════════════════════════════════════════════════════════════
❌ STARTUP FAILED: PIN_ENCRYPTION_KEY VALIDATION ERROR
═══════════════════════════════════════════════════════════════

PIN_ENCRYPTION_KEY environment variable is not set.
This is a REQUIRED variable for production deployment.

To fix this:
1. Generate a new 32-byte hex key:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
2. Set the environment variable:
   export PIN_ENCRYPTION_KEY=<generated-key>
3. Restart the application
═══════════════════════════════════════════════════════════════
```

**Validation requirements:**
- PIN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)
- PIN_ENCRYPTION_KEY must contain only 0-9, a-f, A-F
- PIN_ENCRYPTION_KEY must not contain whitespace
- PIN_ENCRYPTION_KEY must be set before startup

If startup fails, check the error message and follow the guidance provided.

### Step 5: Verify Functionality

Test critical paths:
- ✅ Provider login
- ✅ Card inventory display
- ✅ Card upload and encryption
- ✅ Distributor purchase flow
- ✅ PIN decryption on purchase

## Secret Rotation

### PIN_ENCRYPTION_KEY Rotation

**Important:** Rotating PIN_ENCRYPTION_KEY requires re-encrypting all stored PINs.

1. Generate new PIN_ENCRYPTION_KEY
2. Create migration script to re-encrypt all PINs
3. Test migration on staging environment
4. Execute migration on production
5. Update PIN_ENCRYPTION_KEY environment variable
6. Verify all PINs decrypt correctly

### JWT_SECRET Rotation

JWT_SECRET rotation invalidates existing sessions:

1. Generate new JWT_SECRET
2. Update environment variable
3. Users will need to re-login
4. Old tokens will be invalid

## Monitoring & Alerts

### Setup Alerts For:

- ✅ Application startup failures
- ✅ PIN encryption/decryption errors
- ✅ Database connection failures
- ✅ High error rates
- ✅ Unusual transaction patterns

### Log Configuration

Ensure logs capture:
- ✅ Startup validation results
- ✅ PIN encryption operations (without exposing keys)
- ✅ Database errors
- ✅ Authentication failures
- ✅ Transaction processing

**Never log:**
- ❌ PIN_ENCRYPTION_KEY value
- ❌ JWT_SECRET value
- ❌ Decrypted PINs
- ❌ Database passwords

## Disaster Recovery

### Backup Strategy

1. **Database Backups**
   - Daily full backups
   - Point-in-time recovery enabled
   - Backups stored in secure location
   - Test restore procedures regularly

2. **Secret Backups**
   - PIN_ENCRYPTION_KEY backed up securely
   - Separate from application code
   - Encrypted backup storage
   - Document recovery procedure

3. **Application Backups**
   - Version control with tagged releases
   - Container images stored in registry
   - Configuration documented

### Recovery Procedures

**If PIN_ENCRYPTION_KEY is Lost:**
1. Rotate to new PIN_ENCRYPTION_KEY
2. Re-encrypt all PINs with new key
3. Verify all PINs decrypt correctly
4. Update monitoring

**If Database is Corrupted:**
1. Restore from latest backup
2. Verify PIN decryption works
3. Check transaction consistency
4. Resume operations

## Troubleshooting

### Application Won't Start

Check startup validation output:
```bash
# Look for error messages about PIN_ENCRYPTION_KEY, DATABASE_URL, or JWT_SECRET
# Follow the error message guidance to fix the issue
```

### PIN Encryption Failures

1. Verify PIN_ENCRYPTION_KEY is set correctly
2. Verify PIN_ENCRYPTION_KEY hasn't been rotated without re-encryption
3. Check database connectivity
4. Review application logs

### Database Connection Issues

1. Verify DATABASE_URL is correct
2. Check database is accessible from deployment environment
3. Verify firewall rules allow connection
4. Check database credentials

## Performance Considerations

- PIN encryption/decryption adds ~5-10ms per operation
- Use connection pooling for database
- Monitor PIN encryption performance
- Consider caching for frequently accessed data

## Security Best Practices

1. **Never commit secrets to version control**
   ```bash
   # .gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use secrets manager**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Secret Manager

3. **Rotate secrets regularly**
   - PIN_ENCRYPTION_KEY: Every 90 days
   - JWT_SECRET: Every 180 days
   - Database passwords: Every 90 days

4. **Audit secret access**
   - Log who accessed secrets
   - When secrets were accessed
   - What operations were performed

5. **Implement least privilege**
   - Only grant necessary permissions
   - Use service accounts with minimal scope
   - Regularly review access

## Compliance & Auditing

- ✅ Document all deployments
- ✅ Track secret rotations
- ✅ Maintain audit logs
- ✅ Regular security reviews
- ✅ Penetration testing
- ✅ Compliance certifications (PCI-DSS, SOC 2, etc.)

## Support

For deployment issues or questions, contact the platform team.


---

## API Hardening Deployment (Phases 12-19)

### New Database Tables

The following tables are created during Phase 12-19 deployment:

**Phase 12: Delivery Resilience**
- Uses existing `webhook_events` and `webhook_deliveries` tables

**Phase 13: Product Model Refinement**
- Adds `product_code` column to `products` table

**Phase 15: Rate Limiting & Abuse Protection**
- `rate_limit_events` - Tracks API requests per endpoint
- `idempotency_keys` - Prevents duplicate purchases
- `webhook_replay_tracking` - Prevents replay flooding

**Phase 16: Observability & Monitoring**
- `structured_logs` - Request-level logging with correlation IDs
- `metrics_purchase_latency` - Purchase operation latency metrics
- `metrics_webhook_latency` - Webhook delivery latency metrics
- `alerts` - Alert conditions and acknowledgments

### Deployment Verification

After deploying Phases 12-19, verify:

```bash
# 1. Check all new tables exist
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
  SELECT TABLE_NAME FROM information_schema.TABLES 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN (
    'rate_limit_events', 'idempotency_keys', 'webhook_replay_tracking',
    'structured_logs', 'metrics_purchase_latency', 'metrics_webhook_latency', 'alerts'
  );
"

# 2. Run security audit
node -e "
  import { SecurityAuditService } from './server/services/security-audit.service.ts';
  const results = await SecurityAuditService.runFullAudit();
  console.log(SecurityAuditService.generateReport(results));
"

# 3. Test rate limiting
for i in {1..65}; do
  curl -s http://localhost:3000/api/trpc/products.list \
    -H "Authorization: Bearer $TOKEN" | grep -q "RATE_LIMITED" && echo "✓ Rate limited at request $i" && break
done

# 4. Verify structured logging
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
  SELECT COUNT(*) as log_count FROM structured_logs 
  WHERE timestamp > NOW() - INTERVAL 5 MINUTE;
"

# 5. Check metrics collection
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
  SELECT COUNT(*) as metric_count FROM metrics_purchase_latency 
  WHERE timestamp > NOW() - INTERVAL 5 MINUTE;
"
```

### Monitoring Configuration

Set up monitoring for Phase 12-19 features:

```bash
# Monitor dead-letter queue
SELECT COUNT(*) as dlq_size FROM webhook_events 
WHERE delivery_status = 'FAILED_DELIVERY' 
AND updated_at > NOW() - INTERVAL 1 HOUR;

# Monitor rate limit violations
SELECT endpoint, COUNT(*) as violations FROM rate_limit_events 
WHERE timestamp > NOW() - INTERVAL 1 HOUR 
GROUP BY endpoint;

# Monitor high latency
SELECT 
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_ms
FROM metrics_purchase_latency 
WHERE timestamp > NOW() - INTERVAL 1 HOUR;

# Check active alerts
SELECT * FROM alerts WHERE acknowledged = FALSE ORDER BY timestamp DESC;
```

### API Version Migration

When deploying v2 API:

1. **Update clients** to use v2 endpoints
2. **Set deprecation date** for v1 (12 months from release)
3. **Monitor v1 usage** to track migration progress
4. **Provide migration guide** to clients

```bash
# Check v1 vs v2 usage
SELECT 
  api_version,
  COUNT(*) as request_count,
  AVG(latency_ms) as avg_latency_ms
FROM request_logs 
WHERE timestamp > NOW() - INTERVAL 1 DAY 
GROUP BY api_version;
```

### Rollback Procedure for Phases 12-19

If Phase 12-19 deployment fails:

```bash
# 1. Stop the application
pkill -f "node dist/index.js"

# 2. Restore database backup (if migrations failed)
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < backup_pre_phase12.sql

# 3. Revert code to previous version
git checkout previous_version
pnpm build

# 4. Restart application
NODE_ENV=production node dist/index.js

# 5. Verify rollback
curl http://localhost:3000/api/trpc/auth.me
```

### Performance Impact

Phase 12-19 adds minimal performance overhead:

- **Rate limiting**: ~1-2ms per request (database lookup)
- **Structured logging**: ~2-3ms per request (async write)
- **Metrics collection**: ~1ms per request (async write)
- **Total overhead**: ~4-6ms per request (negligible for most applications)

### Capacity Planning

Estimate database growth:

| Table | Rows/Day | Growth/Month | Retention |
|-------|----------|--------------|-----------|
| rate_limit_events | 100K | 3M | 1 hour |
| structured_logs | 50K | 1.5M | 90 days |
| metrics_purchase_latency | 10K | 300K | 30 days |
| metrics_webhook_latency | 5K | 150K | 30 days |
| alerts | 100 | 3K | 90 days |

**Total monthly growth**: ~5GB (with compression)

---

## Post-Deployment Checklist

- [ ] All 112+ tests passing
- [ ] Security audit score 100/100
- [ ] Rate limiting working (verified with 65 requests)
- [ ] Structured logs being recorded
- [ ] Metrics being collected
- [ ] Alerts configured and monitoring
- [ ] Dead-letter queue empty or low
- [ ] API response times < 500ms P95
- [ ] Error rate < 0.1%
- [ ] Database backup completed
- [ ] Monitoring dashboards set up
- [ ] Support team trained on new features
- [ ] Documentation updated for clients

---

**Last Updated**: May 19, 2026
**Phases Covered**: 12-19
**Status**: Production Ready ✅
