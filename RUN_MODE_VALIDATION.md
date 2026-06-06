# Run-Mode Data Visibility Validation Report

**Date:** 2026-04-30  
**Status:** ⚠️ BLOCKERS IDENTIFIED

---

## Executive Summary

Run-mode seed data exists in the database but **cannot be accessed through the UI** due to missing organization-user links. The system requires users to be linked to organizations via the `organization_users` table to access provider/distributor dashboards.

---

## Phase 1: Database Verification ✅

### Organizations
- ✅ 8 organizations created:
  - 5 Provider organizations: Libyana, Almadar, LTT, Connect, Giga
  - 3 Distributor organizations: Anis, iCard, Qareep

### Service Providers
- ✅ 5 seed providers with SEED_ prefixed codes
- ✅ All linked to organizations

### Distributors
- ✅ 3 seed distributors with SEED_ prefix
- ✅ All linked to organizations

### Data Volume
- ✅ 6,250 total cards (6,236 AVAILABLE, 14 SOLD)
- ✅ 30 transactions
- ✅ 40 ledger entries
- ✅ 11 provider-distributor accounts

---

## Phase 2: Critical Blocker Identified ❌

### Issue: Missing Organization-User Links

**Root Cause:**
The `auth.me` procedure determines user access level by querying:
```sql
SELECT DISTINCT o.type FROM organizations o 
INNER JOIN organization_users ou ON o.id = ou.organization_id 
WHERE ou.user_id = ?
```

**Current State:**
- ✅ Admin user exists: `abdogiydan2000@gmail.com` (role=admin)
- ❌ Only 1 organization_user link exists (demo-distributor)
- ❌ **0 links for seeded organizations**

**Impact:**
1. **Admin Dashboard**: ✅ Works (admin role bypasses organization check)
2. **Provider Dashboard**: ❌ Cannot access (no organization_user link)
3. **Distributor Dashboard**: ❌ Cannot access (no organization_user link)

---

## Phase 3: Data Access Flow Analysis

### How Provider Access Works
```
User Login → auth.me queries organization_users → 
  If found: organizationType = "provider" → 
    Redirect to /provider/dashboard → 
      provider.dashboard uses ctx.user.id as providerId → 
        Queries service_providers WHERE id = ctx.user.id
```

**Problem:** Seeded provider IDs (1154734-1154738) don't match any user IDs.

### How Distributor Access Works
```
User Login → auth.me queries organization_users → 
  If found: organizationType = "distributor" → 
    Redirect to /distributor/dashboard → 
      distributor.dashboard uses ctx.user.id as distributorId → 
        Queries distributors WHERE id = ctx.user.id
```

**Problem:** Seeded distributor IDs (1149510-1149512) don't match any user IDs.

---

## Phase 4: Required Fixes

### Option A: Link Admin to Seeded Organizations (Recommended for Testing)

Add organization_user links so admin can test all dashboards:

```sql
-- Link admin to all provider organizations
INSERT INTO organization_users (user_id, organization_id, role)
SELECT 1, id, 'admin' FROM organizations WHERE type = 'provider';

-- Link admin to all distributor organizations
INSERT INTO organization_users (user_id, organization_id, role)
SELECT 1, id, 'admin' FROM organizations WHERE type = 'distributor';
```

**Outcome:**
- Admin can access `/admin/organizations` ✅
- Admin can view provider dashboards (if provider router updated)
- Admin can view distributor dashboards (if distributor router updated)

### Option B: Create Demo Users for Each Organization

Create users linked to organizations:

```sql
-- Create provider demo user
INSERT INTO users (open_id, email, name, role, login_method)
VALUES ('provider-demo-1', 'provider@seed.local', 'Provider Demo', 'user', 'oauth');

-- Link to provider organization
INSERT INTO organization_users (user_id, organization_id, role)
VALUES (LAST_INSERT_ID(), <provider_org_id>, 'admin');
```

**Outcome:**
- Requires users to log in via Google OAuth (cannot use local demo users)
- More realistic but requires external OAuth setup

### Option C: Update Provider/Distributor Routers (Architecture Change)

Modify provider/distributor routers to:
1. Check organization_users table for user's organizations
2. Use first organization's provider/distributor ID instead of ctx.user.id

**Outcome:**
- Allows multiple organizations per user
- More flexible but requires code changes

---

## Recommended Action

**Implement Option A** (Link Admin to Organizations):

1. Admin can immediately test all seeded data through UI
2. No code changes required
3. Reversible (cleanup script already handles this)
4. Validates data visibility without adding new seed users

---

## Validation Checklist

- [x] Database contains seeded data
- [x] Organizations table populated
- [x] Service providers created
- [x] Distributors created
- [x] Cards and transactions exist
- [ ] Admin can view organizations page
- [ ] Admin can view provider data
- [ ] Admin can view distributor data
- [ ] Financial data reconciles
- [ ] API credentials accessible

---

## Next Steps

1. **Execute Fix**: Add organization_user links for admin
2. **Verify Admin View**: Test `/admin/organizations` page
3. **Verify Provider Data**: Check if provider dashboards accessible
4. **Verify Distributor Data**: Check if distributor dashboards accessible
5. **Validate Financials**: Confirm balances and ledger entries display
6. **Document Results**: Update this report with findings

---

## Files Affected

- `scripts/seed-run-mode.mjs` - Creates organizations but doesn't link users
- `scripts/cleanup-run-mode.mjs` - Cleans up organization_users links
- `server/routers.ts` - auth.me procedure (line 37-68)
- `server/routers/provider.router.ts` - Uses ctx.user.id as provider ID
- `server/routers/distributor.router.ts` - Uses ctx.user.id as distributor ID
