# Prepaid Card Platform - System Design Document

**Version:** 1.0  
**Last Updated:** March 27, 2026  
**Status:** Active  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Access Request & Approval System](#access-request--approval-system)
4. [Provider-Distributor Configuration Model](#provider-distributor-configuration-model)
5. [Credit Limit System](#credit-limit-system)
6. [Idempotency Handling in API Layer](#idempotency-handling-in-api-layer)
7. [Concurrency Control for Card Allocation](#concurrency-control-for-card-allocation)
8. [Audit Logging System](#audit-logging-system)
9. [One-Time PIN Access Policy](#one-time-pin-access-policy)
10. [Async Card Batch Processing](#async-card-batch-processing)
11. [Settlement System](#settlement-system)
12. [API Contract Definitions](#api-contract-definitions)
13. [Data Models](#data-models)
14. [Error Handling](#error-handling)

---

## System Overview

The Prepaid Card Platform is a multi-tenant financial system enabling distributors to manage prepaid card issuance, activation, and transactions through service providers. The system maintains strict separation of concerns between role-based access, financial controls, and operational workflows.

**Key Principles:**
- **Multi-tenancy:** Isolated data per distributor with role-based access control
- **Financial Accuracy:** Credit limits, settlement reconciliation, and audit trails
- **Operational Resilience:** Idempotent APIs, concurrency safety, and async processing
- **Security:** One-time PIN policies, encrypted sensitive data, comprehensive audit logging

---

## Core Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                        │
│  (Request validation, authentication, rate limiting)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼────┐  ┌──────▼──────┐  ┌───▼────────┐
│  Business  │  │  Financial  │  │  Operational
│   Logic    │  │  Services   │  │  Services
│  (tRPC)    │  │  (Ledger,   │  │  (Batch,
│            │  │  Settlement)│  │  Audit)
└────────────┘  └─────────────┘  └────────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼────┐  ┌──────▼──────┐  ┌───▼────────┐
│ PostgreSQL │  │   Redis     │  │  Message   │
│ (Primary)  │  │   (Cache)   │  │   Queue    │
└────────────┘  └─────────────┘  └────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| API | tRPC 11 + Express 4 | Type-safe RPC procedures |
| Frontend | React 19 + Tailwind 4 | Dashboard UI |
| Database | PostgreSQL/TiDB | Primary data store |
| Cache | Redis | Session, rate limiting |
| Queue | Bull/RabbitMQ | Async batch processing |
| Auth | Manus OAuth | Identity management |

---

## Access Request & Approval System

### Overview

The access request system enables role-based access provisioning with approval workflows. Distributors can request access to features, and admins approve/deny requests with audit trails.

### Data Model

```sql
CREATE TABLE access_requests (
  id UUID PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  requested_by UUID NOT NULL REFERENCES users(id),
  access_type VARCHAR(50) NOT NULL, -- 'feature', 'provider', 'report'
  resource_id UUID,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, denied, revoked
  reason TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  denial_reason TEXT,
  denied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_distributor_status (distributor_id, status),
  INDEX idx_requested_by (requested_by)
);

CREATE TABLE access_grants (
  id UUID PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  user_id UUID NOT NULL REFERENCES users(id),
  access_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(distributor_id, user_id, access_type, resource_id),
  INDEX idx_user_access (user_id, access_type)
);
```

### Request Workflow

**State Transitions:**
```
pending → approved → active
       ↘ denied → denied
       ↘ revoked → revoked
```

**Approval Process:**

1. **Request Creation:** User submits access request with justification
2. **Admin Review:** Admin views pending requests with audit context
3. **Approval:** Admin approves with optional conditions (expiration date)
4. **Grant Creation:** System creates access_grant record
5. **Revocation:** Admin can revoke access at any time with reason

### API Procedures

```typescript
// Request access
trpc.access.requestAccess.useMutation({
  accessType: 'provider' | 'feature' | 'report',
  resourceId?: string,
  reason: string,
});

// List pending requests (admin only)
trpc.admin.access.listPending.useQuery({
  distributorId?: string,
  status: 'pending' | 'approved' | 'denied',
});

// Approve/deny request
trpc.admin.access.approveRequest.useMutation({
  requestId: string,
  expiresAt?: Date,
});

trpc.admin.access.denyRequest.useMutation({
  requestId: string,
  reason: string,
});

// Revoke access
trpc.admin.access.revokeAccess.useMutation({
  grantId: string,
  reason: string,
});
```

---

## Provider-Distributor Configuration Model

### Overview

The configuration model defines the relationship between providers and distributors, including commission structures, volume limits, and operational parameters.

### Data Model

```sql
CREATE TABLE provider_distributor_configs (
  id UUID PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES service_providers(id),
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
  
  -- Commission structure
  commission_type VARCHAR(20), -- 'percentage', 'fixed', 'tiered'
  commission_value DECIMAL(10, 4),
  commission_tier_config JSONB, -- For tiered commissions
  
  -- Volume constraints
  daily_volume_limit DECIMAL(15, 2),
  monthly_volume_limit DECIMAL(15, 2),
  daily_transaction_count_limit INT,
  
  -- Card allocation
  card_allocation_limit INT,
  auto_replenish_threshold INT,
  auto_replenish_quantity INT,
  
  -- Settlement
  settlement_frequency VARCHAR(20), -- 'daily', 'weekly', 'monthly'
  settlement_day INT, -- 1-31 for monthly, 1-7 for weekly
  settlement_currency VARCHAR(3) DEFAULT 'USD',
  
  -- Features
  features_enabled JSONB, -- ['batch_upload', 'api_access', 'reporting']
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, distributor_id),
  INDEX idx_distributor_provider (distributor_id, provider_id)
);

CREATE TABLE provider_distributor_metrics (
  id UUID PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES provider_distributor_configs(id),
  date DATE NOT NULL,
  
  -- Daily metrics
  total_volume DECIMAL(15, 2),
  transaction_count INT,
  active_cards INT,
  
  -- Commission tracking
  commission_earned DECIMAL(15, 2),
  commission_paid DECIMAL(15, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(config_id, date),
  INDEX idx_config_date (config_id, date)
);
```

### Configuration Hierarchy

```
Provider
├── Distributor 1
│   ├── Commission: 2.5% per transaction
│   ├── Daily Limit: $50,000
│   ├── Card Allocation: 1,000 cards
│   └── Settlement: Weekly (Fridays)
├── Distributor 2
│   ├── Commission: Tiered (1% < $10k, 2% >= $10k)
│   ├── Daily Limit: $100,000
│   ├── Card Allocation: 5,000 cards
│   └── Settlement: Monthly (15th)
```

### Configuration API

```typescript
// Create provider-distributor config
trpc.admin.config.createProviderDistributorConfig.useMutation({
  providerId: string,
  distributorId: string,
  commissionType: 'percentage' | 'fixed' | 'tiered',
  commissionValue: number,
  dailyVolumeLimit: number,
  cardAllocationLimit: number,
  settlementFrequency: 'daily' | 'weekly' | 'monthly',
});

// Update configuration
trpc.admin.config.updateProviderDistributorConfig.useMutation({
  configId: string,
  updates: Partial<ProviderDistributorConfig>,
});

// Get metrics
trpc.admin.config.getMetrics.useQuery({
  configId: string,
  dateRange: { from: Date, to: Date },
});
```

---

## Credit Limit System

### Overview

The credit limit system replaces simple balance checks with sophisticated credit management, including credit allocation, utilization tracking, and limit enforcement.

### Data Model

```sql
CREATE TABLE credit_limits (
  id UUID PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  provider_id UUID NOT NULL REFERENCES service_providers(id),
  
  -- Credit allocation
  total_credit_limit DECIMAL(15, 2) NOT NULL,
  available_credit DECIMAL(15, 2) NOT NULL,
  reserved_credit DECIMAL(15, 2) DEFAULT 0, -- For pending transactions
  utilized_credit DECIMAL(15, 2) DEFAULT 0, -- For completed transactions
  
  -- Limits
  transaction_limit DECIMAL(15, 2), -- Max per transaction
  daily_transaction_limit DECIMAL(15, 2),
  daily_transaction_count_limit INT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, exceeded
  suspension_reason TEXT,
  suspended_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(distributor_id, provider_id),
  INDEX idx_distributor_credit (distributor_id, status)
);

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  credit_limit_id UUID NOT NULL REFERENCES credit_limits(id),
  transaction_id UUID,
  
  -- Credit movement
  amount DECIMAL(15, 2) NOT NULL,
  transaction_type VARCHAR(20), -- 'reserve', 'utilize', 'release', 'refund'
  status VARCHAR(20), -- 'pending', 'completed', 'failed', 'reversed'
  
  -- Idempotency
  idempotency_key VARCHAR(255) UNIQUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  INDEX idx_credit_limit_type (credit_limit_id, transaction_type),
  INDEX idx_idempotency (idempotency_key)
);

CREATE TABLE credit_limit_history (
  id UUID PRIMARY KEY,
  credit_limit_id UUID NOT NULL REFERENCES credit_limits(id),
  previous_limit DECIMAL(15, 2),
  new_limit DECIMAL(15, 2),
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_credit_limit (credit_limit_id)
);
```

### Credit Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Total Credit Limit                        │
│                        $100,000                              │
└──────────────┬──────────────────────────────────────────────┘
               │
        ┌──────┴──────┬──────────────┬──────────────┐
        │             │              │              │
   Reserved      Utilized       Available      Suspended
   $10,000       $30,000        $60,000            $0
   (Pending)     (Completed)    (Unused)       (Over-limit)
```

### Credit Operations

```typescript
// Reserve credit for transaction
async function reserveCredit(
  creditLimitId: string,
  amount: number,
  idempotencyKey: string
): Promise<{ reserved: boolean; availableCredit: number }> {
  // Check available credit
  // Create reservation record
  // Update available_credit
  // Return result
}

// Utilize reserved credit (on transaction completion)
async function utilizeCredit(
  creditLimitId: string,
  amount: number,
  transactionId: string
): Promise<void> {
  // Move from reserved to utilized
  // Update credit_transactions record
  // Emit audit event
}

// Release reserved credit (on transaction failure)
async function releaseCredit(
  creditLimitId: string,
  amount: number,
  reason: string
): Promise<void> {
  // Move from reserved back to available
  // Create credit_transaction record
  // Emit audit event
}

// Refund utilized credit (on transaction reversal)
async function refundCredit(
  creditLimitId: string,
  amount: number,
  transactionId: string,
  reason: string
): Promise<void> {
  // Move from utilized back to available
  // Create credit_transaction record
  // Emit audit event
}

// Adjust credit limit
async function adjustCreditLimit(
  creditLimitId: string,
  newLimit: number,
  reason: string,
  changedBy: string
): Promise<void> {
  // Validate new limit >= utilized credit
  // Update credit_limits record
  // Create history entry
  // Emit audit event
}
```

### Credit Enforcement

**Transaction Validation:**

```typescript
async function validateCreditForTransaction(
  distributorId: string,
  providerId: string,
  amount: number
): Promise<{ valid: boolean; reason?: string }> {
  const creditLimit = await getCreditLimit(distributorId, providerId);
  
  // Check 1: Limit not suspended
  if (creditLimit.status === 'suspended') {
    return { valid: false, reason: 'Credit limit suspended' };
  }
  
  // Check 2: Transaction amount within limit
  if (amount > creditLimit.transactionLimit) {
    return { valid: false, reason: 'Transaction exceeds limit' };
  }
  
  // Check 3: Daily transaction limit not exceeded
  const dailyUtilized = await getDailyUtilization(creditLimit.id);
  if (dailyUtilized + amount > creditLimit.dailyTransactionLimit) {
    return { valid: false, reason: 'Daily limit exceeded' };
  }
  
  // Check 4: Available credit sufficient
  if (amount > creditLimit.availableCredit) {
    return { valid: false, reason: 'Insufficient credit' };
  }
  
  return { valid: true };
}
```

---

## Idempotency Handling in API Layer

### Overview

Idempotency ensures that repeated API calls with the same parameters produce the same result without side effects. This is critical for financial transactions where network failures may cause retries.

### Implementation Strategy

**Idempotency Key Header:**

```
POST /api/trpc/transaction.create
Idempotency-Key: "txn_20260327_dist1_prov1_12345"
Content-Type: application/json

{
  "distributorId": "dist1",
  "providerId": "prov1",
  "amount": 100.00,
  "cardId": "card123"
}
```

### Data Model

```sql
CREATE TABLE idempotency_records (
  id UUID PRIMARY KEY,
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  procedure_name VARCHAR(255) NOT NULL,
  
  -- Request
  request_hash VARCHAR(64), -- SHA256 of request body
  
  -- Response
  response_status VARCHAR(20), -- 'pending', 'success', 'failure'
  response_body JSONB,
  response_error TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  
  INDEX idx_idempotency_key (idempotency_key),
  INDEX idx_expires_at (expires_at)
);
```

### Middleware Implementation

```typescript
// Idempotency middleware for tRPC
export const idempotencyMiddleware = t.middleware(async ({ ctx, next, input }) => {
  const idempotencyKey = ctx.headers['idempotency-key'];
  
  if (!idempotencyKey) {
    // Non-idempotent request
    return next();
  }
  
  // Check if request already processed
  const existing = await db.idempotencyRecords.findUnique({
    where: { idempotencyKey },
  });
  
  if (existing) {
    if (existing.responseStatus === 'pending') {
      // Request still processing
      throw new Error('Request is still being processed');
    }
    
    if (existing.responseStatus === 'success') {
      // Return cached response
      return existing.responseBody;
    }
    
    if (existing.responseStatus === 'failure') {
      // Return cached error
      throw new Error(existing.responseError);
    }
  }
  
  // Create pending record
  const record = await db.idempotencyRecords.create({
    data: {
      idempotencyKey,
      procedureName: ctx.procedure,
      requestHash: hashRequest(input),
      responseStatus: 'pending',
    },
  });
  
  try {
    // Execute procedure
    const result = await next();
    
    // Update record with success
    await db.idempotencyRecords.update({
      where: { id: record.id },
      data: {
        responseStatus: 'success',
        responseBody: result,
      },
    });
    
    return result;
  } catch (error) {
    // Update record with failure
    await db.idempotencyRecords.update({
      where: { id: record.id },
      data: {
        responseStatus: 'failure',
        responseError: error.message,
      },
    });
    
    throw error;
  }
});

// Protected procedure with idempotency
export const idempotentProcedure = protectedProcedure.use(idempotencyMiddleware);
```

### Usage in Procedures

```typescript
export const transactionRouter = router({
  create: idempotentProcedure
    .input(z.object({
      distributorId: z.string().uuid(),
      providerId: z.string().uuid(),
      amount: z.number().positive(),
      cardId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Procedure implementation
      // Will be idempotent due to middleware
    }),
});
```

### Idempotency Key Format

**Recommended Format:**
```
{service}_{timestamp}_{distributor}_{provider}_{sequence}

Example: txn_20260327_dist1_prov1_00001
```

**Components:**
- `service`: API service identifier (txn, card, settlement)
- `timestamp`: ISO 8601 date (YYYYMMDD)
- `distributor`: Distributor ID (first 8 chars)
- `provider`: Provider ID (first 8 chars)
- `sequence`: Sequential number (5 digits)

---

## Concurrency Control for Card Allocation

### Overview

Concurrency control prevents race conditions when multiple requests attempt to allocate cards simultaneously, ensuring accurate inventory management.

### Problem Statement

**Scenario:** Two concurrent requests attempt to allocate the last 10 cards from a batch of 100.

```
Request 1: Allocate 10 cards
  ├─ Check available: 100 ✓
  ├─ [PAUSE - context switch]
  
Request 2: Allocate 10 cards (concurrent)
  ├─ Check available: 100 ✓
  ├─ Allocate 10 cards → 90 remaining
  
Request 1: [RESUME]
  ├─ Allocate 10 cards → 80 remaining
  
Result: 20 cards allocated, but only 100 existed (RACE CONDITION)
```

### Solution: Pessimistic Locking

```sql
CREATE TABLE card_batches (
  id UUID PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  provider_id UUID NOT NULL REFERENCES service_providers(id),
  
  total_cards INT NOT NULL,
  allocated_cards INT DEFAULT 0,
  available_cards INT GENERATED ALWAYS AS (total_cards - allocated_cards) STORED,
  
  status VARCHAR(20) DEFAULT 'active', -- active, depleted, archived
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Optimistic locking
  version INT DEFAULT 1,
  
  INDEX idx_distributor_available (distributor_id, status, available_cards)
);

CREATE TABLE card_allocations (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES card_batches(id),
  allocation_id UUID NOT NULL UNIQUE, -- Idempotency key
  
  quantity INT NOT NULL,
  allocated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_batch_allocation (batch_id, allocated_at)
);
```

### Allocation Implementation

```typescript
// Pessimistic locking approach
async function allocateCardsWithLock(
  batchId: string,
  quantity: number,
  allocationId: string
): Promise<{ success: boolean; remainingCards: number }> {
  return await db.$transaction(async (tx) => {
    // Lock the batch row for update
    const batch = await tx.cardBatches.findUnique({
      where: { id: batchId },
      // This acquires a FOR UPDATE lock in PostgreSQL
    });
    
    if (!batch) {
      throw new Error('Batch not found');
    }
    
    if (batch.availableCards < quantity) {
      throw new Error('Insufficient cards available');
    }
    
    // Check idempotency
    const existing = await tx.cardAllocations.findUnique({
      where: { allocationId },
    });
    
    if (existing) {
      // Already allocated, return cached result
      const updatedBatch = await tx.cardBatches.findUnique({
        where: { id: batchId },
      });
      return {
        success: true,
        remainingCards: updatedBatch!.availableCards,
      };
    }
    
    // Allocate cards
    await tx.cardBatches.update({
      where: { id: batchId },
      data: {
        allocatedCards: {
          increment: quantity,
        },
        version: {
          increment: 1,
        },
      },
    });
    
    // Record allocation
    await tx.cardAllocations.create({
      data: {
        batchId,
        allocationId,
        quantity,
      },
    });
    
    // Get updated batch
    const updated = await tx.cardBatches.findUnique({
      where: { id: batchId },
    });
    
    return {
      success: true,
      remainingCards: updated!.availableCards,
    };
  });
}

// Optimistic locking approach (alternative)
async function allocateCardsOptimistic(
  batchId: string,
  quantity: number,
  allocationId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; remainingCards: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const batch = await db.cardBatches.findUnique({
        where: { id: batchId },
      });
      
      if (!batch || batch.availableCards < quantity) {
        throw new Error('Insufficient cards');
      }
      
      // Check idempotency
      const existing = await db.cardAllocations.findUnique({
        where: { allocationId },
      });
      
      if (existing) {
        return {
          success: true,
          remainingCards: batch.availableCards - quantity,
        };
      }
      
      // Update with version check
      const updated = await db.cardBatches.update({
        where: {
          id_version: {
            id: batchId,
            version: batch.version,
          },
        },
        data: {
          allocatedCards: {
            increment: quantity,
          },
          version: {
            increment: 1,
          },
        },
      });
      
      // Record allocation
      await db.cardAllocations.create({
        data: {
          batchId,
          allocationId,
          quantity,
        },
      });
      
      return {
        success: true,
        remainingCards: updated.availableCards,
      };
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 100)
      );
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

### API Procedure

```typescript
export const cardRouter = router({
  allocate: idempotentProcedure
    .input(z.object({
      batchId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const allocationId = ctx.headers['idempotency-key'];
      
      return await allocateCardsWithLock(
        input.batchId,
        input.quantity,
        allocationId
      );
    }),
});
```

---

## Audit Logging System

### Overview

Comprehensive audit logging tracks all sensitive operations including PIN access, transactions, configuration changes, and access control modifications.

### Data Model

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  
  -- Actor
  user_id UUID REFERENCES users(id),
  service_account_id UUID REFERENCES service_accounts(id),
  actor_type VARCHAR(20), -- 'user', 'service', 'system'
  actor_name VARCHAR(255),
  
  -- Action
  action VARCHAR(50) NOT NULL, -- 'pin_access', 'transaction_create', 'config_update'
  resource_type VARCHAR(50), -- 'card', 'transaction', 'config'
  resource_id UUID,
  
  -- Context
  distributor_id UUID REFERENCES distributors(id),
  provider_id UUID REFERENCES service_providers(id),
  
  -- Details
  details JSONB, -- Action-specific details
  changes JSONB, -- Before/after for updates
  
  -- Status
  status VARCHAR(20), -- 'success', 'failure', 'denied'
  error_message TEXT,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_actor (user_id, service_account_id),
  INDEX idx_action (action, created_at),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_distributor (distributor_id, created_at),
  INDEX idx_timestamp (created_at)
);

CREATE TABLE audit_log_archives (
  id UUID PRIMARY KEY,
  audit_log_id UUID NOT NULL REFERENCES audit_logs(id),
  
  -- Archive metadata
  archived_at TIMESTAMP DEFAULT NOW(),
  archive_location VARCHAR(255), -- S3 path, etc.
  
  INDEX idx_audit_log (audit_log_id)
);
```

### Audit Events

| Event | Resource | Details | Sensitivity |
|-------|----------|---------|-------------|
| `pin_access` | Card | PIN access attempt, result | **CRITICAL** |
| `pin_change` | Card | PIN change request, result | **CRITICAL** |
| `transaction_create` | Transaction | Amount, provider, status | **HIGH** |
| `transaction_reverse` | Transaction | Reason, amount refunded | **HIGH** |
| `card_activate` | Card | Activation details | **HIGH** |
| `card_deactivate` | Card | Deactivation reason | **HIGH** |
| `credit_limit_adjust` | Credit Limit | Old/new limit, reason | **HIGH** |
| `config_update` | Config | Old/new values | **MEDIUM** |
| `access_grant` | Access | Type, resource, expiration | **MEDIUM** |
| `access_revoke` | Access | Type, reason | **MEDIUM** |
| `report_download` | Report | Type, date range | **MEDIUM** |
| `batch_upload` | Batch | File name, record count | **MEDIUM** |

### Logging Implementation

```typescript
// Audit logger service
export class AuditLogger {
  async logPINAccess(
    cardId: string,
    userId: string,
    success: boolean,
    ipAddress: string
  ): Promise<void> {
    await db.auditLogs.create({
      data: {
        userId,
        action: 'pin_access',
        resourceType: 'card',
        resourceId: cardId,
        status: success ? 'success' : 'failure',
        details: {
          cardId,
          timestamp: new Date().toISOString(),
        },
        ipAddress,
        createdAt: new Date(),
      },
    });
  }

  async logTransaction(
    transactionId: string,
    userId: string,
    distributorId: string,
    providerId: string,
    amount: number,
    status: 'success' | 'failure'
  ): Promise<void> {
    await db.auditLogs.create({
      data: {
        userId,
        action: 'transaction_create',
        resourceType: 'transaction',
        resourceId: transactionId,
        distributorId,
        providerId,
        status,
        details: {
          amount,
          timestamp: new Date().toISOString(),
        },
        createdAt: new Date(),
      },
    });
  }

  async logConfigUpdate(
    configId: string,
    userId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ): Promise<void> {
    await db.auditLogs.create({
      data: {
        userId,
        action: 'config_update',
        resourceType: 'config',
        resourceId: configId,
        status: 'success',
        changes: {
          before: oldValues,
          after: newValues,
        },
        createdAt: new Date(),
      },
    });
  }
}

// Usage in procedures
export const cardRouter = router({
  getPIN: protectedProcedure
    .input(z.object({ cardId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const pin = await getCardPIN(input.cardId);
        
        // Log successful access
        await auditLogger.logPINAccess(
          input.cardId,
          ctx.user.id,
          true,
          ctx.ip
        );
        
        return pin;
      } catch (error) {
        // Log failed access
        await auditLogger.logPINAccess(
          input.cardId,
          ctx.user.id,
          false,
          ctx.ip
        );
        
        throw error;
      }
    }),
});
```

### Audit Log Retention

**Retention Policy:**
- **Active Logs:** 90 days in primary database
- **Archive:** 7 years in cold storage (S3)
- **Deletion:** After 7 years (regulatory compliance)

**Archival Process:**
```typescript
async function archiveOldLogs(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  const logsToArchive = await db.auditLogs.findMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
    take: 10000,
  });
  
  for (const log of logsToArchive) {
    // Upload to S3
    const s3Path = `audit-logs/${log.createdAt.getFullYear()}/${log.createdAt.getMonth()}/${log.id}.json`;
    await s3.putObject({
      Bucket: 'audit-archive',
      Key: s3Path,
      Body: JSON.stringify(log),
    });
    
    // Record archive
    await db.auditLogArchives.create({
      data: {
        auditLogId: log.id,
        archiveLocation: s3Path,
      },
    });
    
    // Delete from primary
    await db.auditLogs.delete({
      where: { id: log.id },
    });
  }
}
```

---

## One-Time PIN Access Policy

### Overview

One-time PIN (OTP) policy enforces security constraints on PIN access, including rate limiting, time windows, and verification requirements.

### Policy Rules

**Access Constraints:**

| Constraint | Value | Rationale |
|-----------|-------|-----------|
| Max attempts per hour | 3 | Prevent brute force |
| Max attempts per day | 10 | Prevent systematic attacks |
| OTP validity window | 5 minutes | Reduce exposure window |
| OTP length | 6 digits | Balance security/usability |
| Resend cooldown | 30 seconds | Prevent spam |
| Account lockout threshold | 5 failed attempts | Trigger security review |
| Lockout duration | 1 hour | Allow recovery |

### Data Model

```sql
CREATE TABLE pin_access_policies (
  id UUID PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  
  -- Rate limiting
  max_attempts_per_hour INT DEFAULT 3,
  max_attempts_per_day INT DEFAULT 10,
  
  -- OTP configuration
  otp_length INT DEFAULT 6,
  otp_validity_minutes INT DEFAULT 5,
  resend_cooldown_seconds INT DEFAULT 30,
  
  -- Lockout
  lockout_threshold INT DEFAULT 5,
  lockout_duration_minutes INT DEFAULT 60,
  
  -- Verification
  require_email_verification BOOLEAN DEFAULT TRUE,
  require_sms_verification BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(distributor_id)
);

CREATE TABLE pin_access_attempts (
  id UUID PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES cards(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Attempt details
  attempt_number INT,
  otp_sent_at TIMESTAMP,
  otp_verified_at TIMESTAMP,
  verification_method VARCHAR(20), -- 'email', 'sms', 'app'
  
  -- Status
  status VARCHAR(20), -- 'pending', 'verified', 'failed', 'expired'
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_card_user (card_id, user_id),
  INDEX idx_status_created (status, created_at)
);

CREATE TABLE pin_access_lockouts (
  id UUID PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES cards(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Lockout details
  reason VARCHAR(50), -- 'max_attempts', 'suspicious_activity'
  locked_at TIMESTAMP DEFAULT NOW(),
  locked_until TIMESTAMP,
  
  -- Resolution
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  resolution_note TEXT,
  
  INDEX idx_card_user_locked (card_id, user_id, locked_until)
);
```

### Access Flow

```
1. User requests PIN access
   ├─ Check if card exists
   ├─ Check if user authorized
   ├─ Check if account locked
   └─ Check rate limits

2. Generate OTP
   ├─ Create 6-digit random code
   ├─ Set 5-minute expiration
   └─ Record attempt

3. Send OTP
   ├─ Send via email (primary)
   ├─ Send via SMS (if configured)
   └─ Log delivery

4. User verifies OTP
   ├─ Check OTP validity
   ├─ Check expiration
   ├─ Verify against stored OTP
   └─ Mark as verified

5. Grant PIN access
   ├─ Return encrypted PIN
   ├─ Log successful access
   └─ Clear attempt counter

6. On failure
   ├─ Increment attempt counter
   ├─ Check lockout threshold
   ├─ Lock account if exceeded
   └─ Log failed attempt
```

### Implementation

```typescript
export class PINAccessService {
  async requestPINAccess(
    cardId: string,
    userId: string,
    ipAddress: string
  ): Promise<{ otpSent: boolean; verificationMethod: string }> {
    // Get policy
    const card = await db.cards.findUnique({ where: { id: cardId } });
    const policy = await db.pinAccessPolicies.findUnique({
      where: { distributorId: card.distributorId },
    });
    
    // Check lockout
    const lockout = await db.pinAccessLockouts.findFirst({
      where: {
        cardId,
        userId,
        lockedUntil: { gt: new Date() },
      },
    });
    
    if (lockout) {
      throw new Error('Account locked due to too many attempts');
    }
    
    // Check rate limits
    const hourAttempts = await db.pinAccessAttempts.count({
      where: {
        cardId,
        userId,
        createdAt: {
          gte: new Date(Date.now() - 3600000), // Last hour
        },
      },
    });
    
    if (hourAttempts >= policy.maxAttemptsPerHour) {
      throw new Error('Too many attempts this hour');
    }
    
    const dayAttempts = await db.pinAccessAttempts.count({
      where: {
        cardId,
        userId,
        createdAt: {
          gte: new Date(Date.now() - 86400000), // Last day
        },
      },
    });
    
    if (dayAttempts >= policy.maxAttemptsPerDay) {
      throw new Error('Too many attempts today');
    }
    
    // Generate OTP
    const otp = generateOTP(policy.otpLength);
    const expiresAt = new Date(Date.now() + policy.otpValidityMinutes * 60000);
    
    // Create attempt record
    const attempt = await db.pinAccessAttempts.create({
      data: {
        cardId,
        userId,
        attemptNumber: hourAttempts + 1,
        otpSentAt: new Date(),
        status: 'pending',
        ipAddress,
        userAgent: userAgent,
      },
    });
    
    // Send OTP
    const verificationMethod = policy.requireEmailVerification ? 'email' : 'sms';
    
    if (verificationMethod === 'email') {
      await sendEmailOTP(card.user.email, otp, expiresAt);
    } else {
      await sendSMSOTP(card.user.phone, otp, expiresAt);
    }
    
    // Store OTP (encrypted)
    await redis.setex(
      `otp:${attempt.id}`,
      policy.otpValidityMinutes * 60,
      encrypt(otp)
    );
    
    return {
      otpSent: true,
      verificationMethod,
    };
  }

  async verifyOTP(
    attemptId: string,
    userProvidedOTP: string
  ): Promise<{ verified: boolean; pin?: string }> {
    const attempt = await db.pinAccessAttempts.findUnique({
      where: { id: attemptId },
    });
    
    if (!attempt) {
      throw new Error('Attempt not found');
    }
    
    if (attempt.status !== 'pending') {
      throw new Error('Attempt already processed');
    }
    
    // Check expiration
    const expirationTime = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - attempt.otpSentAt.getTime() > expirationTime) {
      await db.pinAccessAttempts.update({
        where: { id: attemptId },
        data: { status: 'expired' },
      });
      throw new Error('OTP expired');
    }
    
    // Get stored OTP
    const storedOTP = await redis.get(`otp:${attemptId}`);
    if (!storedOTP) {
      throw new Error('OTP not found');
    }
    
    const decryptedOTP = decrypt(storedOTP);
    
    if (decryptedOTP !== userProvidedOTP) {
      // Failed attempt
      await db.pinAccessAttempts.update({
        where: { id: attemptId },
        data: { status: 'failed' },
      });
      
      // Check lockout threshold
      const policy = await db.pinAccessPolicies.findUnique({
        where: { distributorId: attempt.card.distributorId },
      });
      
      const failedCount = await db.pinAccessAttempts.count({
        where: {
          cardId: attempt.cardId,
          userId: attempt.userId,
          status: 'failed',
          createdAt: {
            gte: new Date(Date.now() - 3600000),
          },
        },
      });
      
      if (failedCount >= policy.lockoutThreshold) {
        await db.pinAccessLockouts.create({
          data: {
            cardId: attempt.cardId,
            userId: attempt.userId,
            reason: 'max_attempts',
            lockedUntil: new Date(Date.now() + policy.lockoutDurationMinutes * 60000),
          },
        });
      }
      
      throw new Error('Invalid OTP');
    }
    
    // Successful verification
    const pin = await getCardPIN(attempt.cardId);
    
    await db.pinAccessAttempts.update({
      where: { id: attemptId },
      data: {
        status: 'verified',
        otpVerifiedAt: new Date(),
      },
    });
    
    // Clear OTP from cache
    await redis.del(`otp:${attemptId}`);
    
    return {
      verified: true,
      pin,
    };
  }
}
```

---

## Async Card Batch Processing

### Overview

Async batch processing enables efficient handling of large-scale card operations (upload, activation, deactivation) without blocking API responses.

### Batch Processing Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    Batch Upload (CSV)                        │
│                    1,000 cards to activate                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Parse & Validate    │
            │  - Check format      │
            │  - Validate data     │
            │  - Check duplicates  │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Queue to Job Queue  │
            │  (Bull/RabbitMQ)     │
            └──────────┬───────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    Worker 1      Worker 2      Worker 3
    Process       Process       Process
    333 cards     333 cards     334 cards
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Aggregate Results   │
            │  - Success count     │
            │  - Failure count     │
            │  - Error details     │
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Generate Report     │
            │  - Send to user      │
            │  - Store in DB       │
            └──────────────────────┘
```

### Data Model

```sql
CREATE TABLE batch_jobs (
  id UUID PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  
  -- Job metadata
  job_type VARCHAR(50), -- 'card_activation', 'card_deactivation', 'card_upload'
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Input
  file_name VARCHAR(255),
  file_size INT,
  file_url VARCHAR(512),
  
  -- Progress
  total_records INT,
  processed_records INT DEFAULT 0,
  successful_records INT DEFAULT 0,
  failed_records INT DEFAULT 0,
  
  -- Results
  result_file_url VARCHAR(512),
  error_summary JSONB,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX idx_distributor_status (distributor_id, status),
  INDEX idx_created_at (created_at)
);

CREATE TABLE batch_job_records (
  id UUID PRIMARY KEY,
  batch_job_id UUID NOT NULL REFERENCES batch_jobs(id),
  
  -- Record data
  record_number INT,
  record_data JSONB,
  
  -- Processing
  status VARCHAR(20), -- 'pending', 'processing', 'success', 'failed'
  result JSONB,
  error_message TEXT,
  
  -- Metadata
  processed_at TIMESTAMP,
  
  INDEX idx_batch_job_status (batch_job_id, status)
);
```

### Job Queue Implementation

```typescript
import Bull from 'bull';

// Create job queue
const cardBatchQueue = new Bull('card-batch', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

// Process batch activation jobs
cardBatchQueue.process('activate', 5, async (job) => {
  const { batchJobId } = job.data;
  
  try {
    // Get batch job
    const batchJob = await db.batchJobs.findUnique({
      where: { id: batchJobId },
    });
    
    // Update status
    await db.batchJobs.update({
      where: { id: batchJobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });
    
    // Get records
    const records = await db.batchJobRecords.findMany({
      where: {
        batchJobId,
        status: 'pending',
      },
    });
    
    let successCount = 0;
    let failureCount = 0;
    const errors: Record<number, string> = {};
    
    // Process each record
    for (const record of records) {
      try {
        // Update record status
        await db.batchJobRecords.update({
          where: { id: record.id },
          data: { status: 'processing' },
        });
        
        // Process record
        const result = await processCardActivation(record.recordData);
        
        // Update record with result
        await db.batchJobRecords.update({
          where: { id: record.id },
          data: {
            status: 'success',
            result,
            processedAt: new Date(),
          },
        });
        
        successCount++;
        
        // Report progress
        job.progress((successCount + failureCount) / records.length * 100);
      } catch (error) {
        failureCount++;
        errors[record.recordNumber] = error.message;
        
        await db.batchJobRecords.update({
          where: { id: record.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            processedAt: new Date(),
          },
        });
      }
    }
    
    // Generate result file
    const resultFile = await generateResultFile(batchJob, successCount, failureCount, errors);
    
    // Update batch job
    await db.batchJobs.update({
      where: { id: batchJobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        successfulRecords: successCount,
        failedRecords: failureCount,
        resultFileUrl: resultFile.url,
        errorSummary: {
          totalErrors: failureCount,
          errors,
        },
      },
    });
    
    return {
      success: true,
      successCount,
      failureCount,
    };
  } catch (error) {
    // Mark batch as failed
    await db.batchJobs.update({
      where: { id: batchJobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorSummary: {
          error: error.message,
        },
      },
    });
    
    throw error;
  }
});

// Handle job completion
cardBatchQueue.on('completed', async (job) => {
  const { batchJobId } = job.data;
  
  // Send notification to user
  await notifyOwner({
    title: 'Batch job completed',
    content: `Batch job ${batchJobId} completed successfully`,
  });
});

// Handle job failure
cardBatchQueue.on('failed', async (job, error) => {
  const { batchJobId } = job.data;
  
  // Send notification
  await notifyOwner({
    title: 'Batch job failed',
    content: `Batch job ${batchJobId} failed: ${error.message}`,
  });
});
```

### API Procedures

```typescript
export const batchRouter = router({
  uploadBatch: protectedProcedure
    .input(z.object({
      jobType: z.enum(['card_activation', 'card_deactivation', 'card_upload']),
      fileUrl: z.string().url(),
      fileName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create batch job
      const batchJob = await db.batchJobs.create({
        data: {
          distributorId: ctx.user.distributorId,
          jobType: input.jobType,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          status: 'pending',
        },
      });
      
      // Parse file and create records
      const records = await parseAndValidateFile(input.fileUrl);
      
      for (const record of records) {
        await db.batchJobRecords.create({
          data: {
            batchJobId: batchJob.id,
            recordNumber: record.number,
            recordData: record.data,
            status: 'pending',
          },
        });
      }
      
      // Queue job
      await cardBatchQueue.add(input.jobType, {
        batchJobId: batchJob.id,
      });
      
      return {
        batchJobId: batchJob.id,
        status: 'queued',
      };
    }),

  getBatchStatus: protectedProcedure
    .input(z.object({
      batchJobId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const batchJob = await db.batchJobs.findUnique({
        where: { id: input.batchJobId },
      });
      
      if (!batchJob) {
        throw new Error('Batch job not found');
      }
      
      return {
        id: batchJob.id,
        status: batchJob.status,
        progress: (batchJob.processedRecords / batchJob.totalRecords) * 100,
        successCount: batchJob.successfulRecords,
        failureCount: batchJob.failedRecords,
        resultFileUrl: batchJob.resultFileUrl,
      };
    }),
});
```

---

## Settlement System

### Overview

The settlement system reconciles transactions, calculates commissions, and processes payouts to providers and distributors.

### Settlement Workflow

```
Day 1-30: Transaction Processing
├─ Cards activated
├─ Transactions processed
├─ Commissions calculated
└─ Ledger entries recorded

Settlement Date (e.g., End of Month):
├─ Aggregate transactions
├─ Calculate commissions
├─ Reconcile with provider
├─ Generate settlement report
└─ Process payout

Post-Settlement:
├─ Archive records
├─ Update ledger
└─ Notify stakeholders
```

### Data Model

```sql
CREATE TABLE settlements (
  id UUID PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES service_providers(id),
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  
  -- Period
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  settlement_date DATE NOT NULL,
  
  -- Transactions
  transaction_count INT,
  total_transaction_volume DECIMAL(15, 2),
  
  -- Commission
  commission_rate DECIMAL(5, 4),
  total_commission DECIMAL(15, 2),
  
  -- Adjustments
  adjustments JSONB, -- Array of adjustments with reasons
  total_adjustments DECIMAL(15, 2) DEFAULT 0,
  
  -- Final amount
  net_settlement_amount DECIMAL(15, 2),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, processed, failed
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  -- Payout
  payout_method VARCHAR(50), -- 'bank_transfer', 'check', 'credit'
  payout_reference VARCHAR(255),
  payout_date TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_provider_period (provider_id, settlement_period_start),
  INDEX idx_status (status),
  INDEX idx_settlement_date (settlement_date)
);

CREATE TABLE settlement_transactions (
  id UUID PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES settlements(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  
  -- Transaction details
  amount DECIMAL(15, 2),
  commission DECIMAL(15, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_settlement_transaction (settlement_id, transaction_id)
);

CREATE TABLE settlement_adjustments (
  id UUID PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES settlements(id),
  
  -- Adjustment
  adjustment_type VARCHAR(50), -- 'chargeback', 'refund', 'fee', 'bonus'
  amount DECIMAL(15, 2),
  reason TEXT,
  
  -- Approval
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_settlement_adjustments (settlement_id)
);
```

### Settlement Calculation

```typescript
export class SettlementService {
  async calculateSettlement(
    providerId: string,
    distributorId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Settlement> {
    // Get config
    const config = await db.providerDistributorConfigs.findUnique({
      where: {
        provider_id_distributor_id: {
          providerId,
          distributorId,
        },
      },
    });
    
    // Get transactions in period
    const transactions = await db.transactions.findMany({
      where: {
        providerId,
        distributorId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: 'completed',
      },
    });
    
    // Calculate totals
    const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = transactions.length;
    
    // Calculate commission
    let totalCommission = 0;
    
    if (config.commissionType === 'percentage') {
      totalCommission = totalVolume * (config.commissionValue / 100);
    } else if (config.commissionType === 'fixed') {
      totalCommission = transactionCount * config.commissionValue;
    } else if (config.commissionType === 'tiered') {
      // Apply tiered commission
      totalCommission = this.calculateTieredCommission(
        totalVolume,
        config.commissionTierConfig
      );
    }
    
    // Get adjustments
    const adjustments = await db.settlementAdjustments.findMany({
      where: {
        settlement: {
          providerId,
          distributorId,
          settlementPeriodStart: periodStart,
          settlementPeriodEnd: periodEnd,
        },
        approvedAt: { not: null },
      },
    });
    
    const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
    
    // Calculate net settlement
    const netSettlement = totalCommission + totalAdjustments;
    
    // Create settlement record
    const settlement = await db.settlements.create({
      data: {
        providerId,
        distributorId,
        settlementPeriodStart: periodStart,
        settlementPeriodEnd: periodEnd,
        settlementDate: new Date(),
        transactionCount,
        totalTransactionVolume: totalVolume,
        commissionRate: config.commissionValue,
        totalCommission,
        totalAdjustments,
        netSettlementAmount: netSettlement,
        status: 'pending',
      },
    });
    
    // Link transactions
    for (const transaction of transactions) {
      await db.settlementTransactions.create({
        data: {
          settlementId: settlement.id,
          transactionId: transaction.id,
          amount: transaction.amount,
          commission: transaction.amount * (config.commissionValue / 100),
        },
      });
    }
    
    return settlement;
  }

  async approveSettlement(
    settlementId: string,
    approvedBy: string
  ): Promise<void> {
    await db.settlements.update({
      where: { id: settlementId },
      data: {
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  async processSettlement(
    settlementId: string,
    payoutMethod: string,
    payoutReference: string
  ): Promise<void> {
    const settlement = await db.settlements.findUnique({
      where: { id: settlementId },
    });
    
    if (settlement.status !== 'approved') {
      throw new Error('Settlement must be approved before processing');
    }
    
    // Process payout (bank transfer, check, etc.)
    // Implementation depends on payout method
    
    // Update settlement
    await db.settlements.update({
      where: { id: settlementId },
      data: {
        status: 'processed',
        payoutMethod,
        payoutReference,
        payoutDate: new Date(),
      },
    });
    
    // Create ledger entry
    await createLedgerEntry({
      type: 'settlement_payout',
      amount: settlement.netSettlementAmount,
      settlementId,
      description: `Settlement payout for ${settlement.settlementPeriodStart} to ${settlement.settlementPeriodEnd}`,
    });
  }

  private calculateTieredCommission(
    volume: number,
    tierConfig: TierConfig[]
  ): number {
    let commission = 0;
    let previousThreshold = 0;
    
    for (const tier of tierConfig) {
      if (volume > previousThreshold) {
        const tierVolume = Math.min(
          volume,
          tier.threshold
        ) - previousThreshold;
        commission += tierVolume * (tier.rate / 100);
        previousThreshold = tier.threshold;
      }
    }
    
    return commission;
  }
}
```

---

## API Contract Definitions

### Overview

API contracts define the request/response schemas, error codes, and behavior expectations for all tRPC procedures.

### Base Response Format

All API responses follow a consistent format:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}
```

### Error Codes

| Code | HTTP | Description | Retry |
|------|------|-------------|-------|
| `INVALID_INPUT` | 400 | Request validation failed | No |
| `UNAUTHORIZED` | 401 | Authentication required | No |
| `FORBIDDEN` | 403 | Insufficient permissions | No |
| `NOT_FOUND` | 404 | Resource not found | No |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) | No |
| `RATE_LIMITED` | 429 | Rate limit exceeded | Yes |
| `INTERNAL_ERROR` | 500 | Server error | Yes |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Yes |
| `INSUFFICIENT_CREDIT` | 402 | Credit limit exceeded | No |
| `CARD_INACTIVE` | 400 | Card not active | No |
| `TRANSACTION_FAILED` | 400 | Transaction processing failed | Yes |

### Procedure Contracts

#### Transaction Create

**Request:**
```typescript
{
  distributorId: string (UUID),
  providerId: string (UUID),
  cardId: string (UUID),
  amount: number (> 0, <= transaction_limit),
  description: string (optional),
  metadata: Record<string, any> (optional),
}
```

**Response:**
```typescript
{
  transactionId: string (UUID),
  status: 'pending' | 'completed' | 'failed',
  amount: number,
  fee: number,
  netAmount: number,
  timestamp: string (ISO 8601),
  reference: string,
}
```

**Errors:**
- `INSUFFICIENT_CREDIT`: Available credit < amount
- `CARD_INACTIVE`: Card not active
- `TRANSACTION_FAILED`: Processing error
- `RATE_LIMITED`: Too many transactions

#### Card Activate

**Request:**
```typescript
{
  batchId: string (UUID),
  quantity: number (> 0),
}
```

**Response:**
```typescript
{
  allocationId: string (UUID),
  quantity: number,
  cardsAllocated: number,
  remainingInBatch: number,
  timestamp: string (ISO 8601),
}
```

**Errors:**
- `INSUFFICIENT_CARDS`: Not enough cards in batch
- `BATCH_NOT_FOUND`: Batch doesn't exist
- `BATCH_DEPLETED`: Batch has no available cards

#### PIN Access

**Request:**
```typescript
{
  cardId: string (UUID),
}
```

**Response:**
```typescript
{
  attemptId: string (UUID),
  otpSent: boolean,
  verificationMethod: 'email' | 'sms',
  expiresAt: string (ISO 8601),
}
```

**Errors:**
- `CARD_NOT_FOUND`: Card doesn't exist
- `ACCOUNT_LOCKED`: Too many failed attempts
- `RATE_LIMITED`: Too many PIN access requests

#### Verify OTP

**Request:**
```typescript
{
  attemptId: string (UUID),
  otp: string (6 digits),
}
```

**Response:**
```typescript
{
  verified: boolean,
  pin: string (encrypted),
  expiresAt: string (ISO 8601),
}
```

**Errors:**
- `INVALID_OTP`: OTP doesn't match
- `OTP_EXPIRED`: OTP validity window expired
- `ATTEMPT_NOT_FOUND`: Attempt doesn't exist

#### Batch Upload

**Request:**
```typescript
{
  jobType: 'card_activation' | 'card_deactivation' | 'card_upload',
  fileUrl: string (S3 URL),
  fileName: string,
}
```

**Response:**
```typescript
{
  batchJobId: string (UUID),
  status: 'queued',
  totalRecords: number,
  estimatedCompletionTime: number (seconds),
}
```

**Errors:**
- `INVALID_FILE`: File format invalid
- `FILE_TOO_LARGE`: File exceeds size limit
- `INVALID_JOB_TYPE`: Job type not supported

### Rate Limiting

**Global Limits:**
- 1,000 requests per minute per API key
- 10,000 requests per hour per API key

**Endpoint-Specific Limits:**

| Endpoint | Limit | Window |
|----------|-------|--------|
| `transaction.create` | 100 | 1 minute |
| `card.allocate` | 50 | 1 minute |
| `pin.requestAccess` | 3 | 1 hour |
| `batch.upload` | 10 | 1 day |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1648382400
```

### Versioning

**Current Version:** `v1`

**Version Header:**
```
Accept: application/json; version=v1
```

**Deprecation Policy:**
- Announce deprecation 6 months in advance
- Maintain deprecated version for 12 months
- Include deprecation warning in response headers

---

## Data Models

### Core Entities

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  open_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Distributors
CREATE TABLE distributors (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Service Providers
CREATE TABLE service_providers (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  classification VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cards
CREATE TABLE cards (
  id UUID PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  provider_id UUID NOT NULL REFERENCES service_providers(id),
  card_number VARCHAR(20) UNIQUE NOT NULL,
  pin_encrypted VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'inactive',
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES cards(id),
  distributor_id UUID NOT NULL REFERENCES distributors(id),
  provider_id UUID NOT NULL REFERENCES service_providers(id),
  amount DECIMAL(15, 2) NOT NULL,
  fee DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  reference VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  code: string;
  message: string;
  details?: {
    field?: string;
    constraint?: string;
    value?: any;
  };
  requestId: string;
  timestamp: string;
}
```

### Error Handling Strategy

1. **Validation Errors:** Return 400 with field-level details
2. **Authentication Errors:** Return 401 with challenge
3. **Authorization Errors:** Return 403 without details
4. **Not Found Errors:** Return 404 without revealing existence
5. **Conflict Errors:** Return 409 with conflict details
6. **Rate Limit Errors:** Return 429 with retry-after header
7. **Server Errors:** Return 500 with request ID for tracking

### Retry Logic

**Retryable Errors:**
- 429 (Rate Limited)
- 503 (Service Unavailable)
- 504 (Gateway Timeout)

**Retry Strategy:**
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxRetries - 1) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Conclusion

This System Design Document provides comprehensive specifications for enhancing the Prepaid Card Platform with production-grade features including access control, credit management, financial reconciliation, and operational resilience. All components maintain the existing core architecture while adding sophisticated layers for security, compliance, and scalability.

**Key Takeaways:**

1. **Access Control:** Multi-level approval workflows with audit trails
2. **Financial Controls:** Credit limits with reservation/utilization tracking
3. **API Resilience:** Idempotency and concurrency safety
4. **Security:** One-time PIN policies and comprehensive audit logging
5. **Operations:** Async batch processing and settlement reconciliation
6. **Contracts:** Clear API specifications with error handling

All systems are designed for production deployment with high availability, fault tolerance, and regulatory compliance.

