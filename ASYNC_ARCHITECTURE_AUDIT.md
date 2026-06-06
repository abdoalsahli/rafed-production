# Frontend Audit: Async Architecture Alignment

## Executive Summary

The platform has evolved from a synchronous, polling-based purchase model to an asynchronous, webhook-driven architecture. This audit identifies all frontend pages that require revision to reflect the new operational model while maintaining financial safety and backward compatibility.

**Total Pages Audited**: 33  
**Pages Requiring Updates**: 12  
**Pages Unaffected**: 21  

---

## Architecture Evolution

### Old Model (Deprecated)
The original architecture followed a synchronous, polling-first pattern:
- Purchase request submitted
- Immediate response expected
- Client polls for card retrieval
- Blocking operation until card available

### New Model (Current)
The platform now operates as an asynchronous, webhook-enabled system:
- Purchase request submitted and queued
- Immediate acknowledgment with request ID
- Async processing in background
- Webhook delivery to distributor (primary)
- Polling available as fallback recovery mechanism
- Full observability and replay capabilities

---

## Pages Requiring Updates

### Tier 1: Critical (Must Update)

#### 1. **DistributorPurchase.tsx**
**Current State**: Synchronous purchase flow with immediate success/failure response  
**Required Changes**:
- Replace binary success/failure with lifecycle statuses (PENDING, PROCESSING, SUCCEEDED, FAILED)
- Display operational identifiers (requestId, correlationId, idempotencyKey)
- Add webhook-awareness messaging
- Implement processing timeline UI
- Show webhook delivery status
- Add replay awareness for failed deliveries

**Data Requirements**:
- `requestId` - Unique request identifier
- `correlationId` - For tracing across systems
- `idempotencyKey` - For retry safety
- `status` - Lifecycle status enum
- `webhookDeliveryStatus` - Delivery state (delivered, pending, failed, dead-lettered)
- `retryCount` - Number of retry attempts
- `lastDeliveryAttempt` - Timestamp of last attempt

**Affected Flows**: Primary purchase workflow for distributors

---

#### 2. **distributor/SettingsPage.tsx**
**Current State**: Basic settings without webhook management  
**Required Changes**:
- Add dedicated "Webhook Configuration" section
- Implement webhook URL management (editable, validated)
- Add webhook signing secret generation and rotation
- Display webhook status (active, failing, disabled)
- Show last delivery information (timestamp, HTTP status)
- Add replay failed deliveries functionality

**Data Requirements**:
- `webhookUrl` - Distributor's webhook endpoint
- `webhookSecret` - Signing secret (masked display)
- `webhookStatus` - Current status enum
- `lastDeliveryTimestamp` - When last webhook was sent
- `lastDeliveryHttpStatus` - HTTP response code
- `lastDeliverySuccess` - Boolean success indicator

**Affected Flows**: Distributor configuration and webhook setup

---

#### 3. **distributor/APIPage.tsx**
**Current State**: Polling-centric API documentation and testing  
**Required Changes**:
- Add webhook simulator for testing
- Implement webhook event viewer
- Add signature verification helper
- Visualize async flow (Request → Processing → Webhook → Delivered)
- Keep polling documented as fallback only
- Provide implementation examples (Node.js, Python)

**Data Requirements**:
- Event type, payload, delivery status
- Retry count and HTTP responses
- Timestamps for each stage
- Signature generation and verification data

**Affected Flows**: Developer testing and integration

---

#### 4. **distributor/TransactionsPage.tsx**
**Current State**: Basic transaction history without operational context  
**Required Changes**:
- Add requestId and correlationId columns
- Display webhook delivery status
- Show retry count and replay status
- Add processing duration metric
- Include webhook delivery timestamp
- Enhance search/filter by operational IDs

**Data Requirements**:
- `requestId` - For transaction tracing
- `correlationId` - For system tracing
- `webhookDeliveryStatus` - Current delivery state
- `retryCount` - Number of attempts
- `replayStatus` - If replayed
- `processingDuration` - Time from request to completion
- `webhookDeliveryTimestamp` - When webhook was delivered

**Affected Flows**: Transaction history and reconciliation

---

#### 5. **provider/DashboardPage.tsx**
**Current State**: Basic metrics without operational visibility  
**Required Changes**:
- Add webhook success rate metric
- Display failed deliveries count
- Show retry queue size
- Add dead-letter count indicator
- Display average processing latency
- Show queue backlog status

**Data Requirements**:
- `webhookSuccessRate` - Percentage of successful deliveries
- `failedDeliveries` - Count of failed webhook attempts
- `retryQueueSize` - Pending retries
- `deadLetterCount` - Permanently failed items
- `avgProcessingLatency` - Average time to process
- `queueBacklog` - Items waiting to be processed

**Affected Flows**: Provider operational monitoring

---

### Tier 2: Important (Should Update)

#### 6. **distributor/DashboardPage.tsx**
**Current State**: Financial overview without operational context  
**Required Changes**:
- Add operational status indicators
- Show recent webhook activity
- Display queue health status
- Add alerts for failed deliveries

**Data Requirements**:
- Recent webhook events
- Queue status summary
- Failed delivery alerts

---

#### 7. **distributor/ProvidersPage.tsx**
**Current State**: Provider list without operational status  
**Required Changes**:
- Add webhook status indicator per provider
- Show last delivery timestamp
- Display delivery success rate
- Add quick actions for webhook management

**Data Requirements**:
- Per-provider webhook status
- Last delivery info
- Success rate metrics

---

#### 8. **provider/DistributorsPage.tsx**
**Current State**: Distributor list without operational visibility  
**Required Changes**:
- Show distributor webhook status
- Display last purchase request timestamp
- Add queue status indicator

**Data Requirements**:
- Distributor webhook configuration status
- Recent activity timestamps

---

### Tier 3: Nice-to-Have (Consider)

#### 9. **QueueDashboard.tsx**
**Current State**: May exist for operational monitoring  
**Required Changes**:
- Enhance with detailed queue state visualization
- Add job status breakdown (pending, processing, failed, dead-lettered)
- Implement replay queue management
- Add stuck job detection

---

#### 10. **distributor/AlertsPageV2.tsx**
**Current State**: Alert system  
**Required Changes**:
- Add webhook delivery failure alerts
- Implement queue backlog alerts
- Add dead-letter queue alerts

---

#### 11. **provider/RequestsPage.tsx**
**Current State**: Request history  
**Required Changes**:
- Add webhook delivery status
- Show request lifecycle status
- Display operational IDs

---

#### 12. **distributor/ApiDocsPage.tsx**
**Current State**: API documentation  
**Required Changes**:
- Update all examples to show webhook-first approach
- Document polling as fallback only
- Add webhook implementation guides
- Include signature verification examples

---

## Pages Not Requiring Changes

The following pages operate independently of the purchase lifecycle and require no updates:

**Authentication & System**:
- LoginPage.tsx
- SignupPage.tsx
- NotFound.tsx
- UnauthorizedPage.tsx
- PendingActivationPage.tsx
- SuspendedPage.tsx

**Admin & Utilities**:
- admin/OrganizationsPage.tsx
- admin/UsersPage.tsx
- ComponentShowcase.tsx
- DashboardRedirect.tsx
- RuntimeHealth.tsx
- SandboxPage.tsx

**Provider Pages (No Changes)**:
- provider/InventoryPage.tsx
- provider/ProductsPage.tsx
- provider/UploadPage.tsx
- provider/SettingsPage.tsx
- provider/TransactionsPage.tsx

**Distributor Pages (No Changes)**:
- distributor/ConnectProviderPage.tsx
- distributor/ProviderAccountsPage.tsx

---

## Backend Data Requirements

### New Endpoints Needed

The following endpoints must be available to support the revised frontend:

#### 1. Webhook Management
```
GET /api/distributor/webhook/config
POST /api/distributor/webhook/config
PUT /api/distributor/webhook/config
POST /api/distributor/webhook/secret/rotate
GET /api/distributor/webhook/status
GET /api/distributor/webhook/last-delivery
```

#### 2. Webhook Event Viewer
```
GET /api/distributor/webhook/events
GET /api/distributor/webhook/events/:eventId
POST /api/distributor/webhook/events/:eventId/replay
```

#### 3. Purchase Lifecycle
```
GET /api/distributor/purchase/:requestId
GET /api/distributor/purchase/:requestId/status
GET /api/distributor/purchase/:requestId/webhook-status
```

#### 4. Queue Monitoring
```
GET /api/distributor/queue/status
GET /api/distributor/queue/pending
GET /api/distributor/queue/failed
GET /api/distributor/queue/dead-letter
POST /api/distributor/queue/replay/:jobId
```

#### 5. Provider Metrics
```
GET /api/provider/metrics/webhook-success-rate
GET /api/provider/metrics/failed-deliveries
GET /api/provider/metrics/queue-status
GET /api/provider/metrics/processing-latency
```

### Reusable Existing Endpoints

These endpoints should already exist and can be reused:

- `GET /api/trpc/financial.accountBalance` - Financial data
- `GET /api/trpc/financial.ledgerHistory` - Transaction history
- `GET /api/trpc/distributor.providers` - Provider list
- `GET /api/trpc/provider.distributors` - Distributor list

---

## Webhook UI Architecture

### Webhook Configuration Flow
1. User navigates to Settings → Webhook Configuration
2. Displays current webhook URL and status
3. User can edit URL with validation
4. System generates signing secret
5. User can rotate secret (with confirmation)
6. Last delivery information displayed
7. Replay failed deliveries option available

### Webhook Event Viewer
1. List of recent webhook events
2. Event details: type, payload, delivery status
3. Retry count and HTTP response code
4. Timestamps for each stage
5. Manual replay option for failed events

### Webhook Simulator (API Test Environment)
1. Configure test webhook URL
2. Trigger test events
3. Inspect incoming payloads
4. Verify signatures
5. Replay events
6. View delivery history

---

## Purchase Lifecycle UI Summary

### Old Flow (Deprecated)
```
Purchase Request
    ↓
Immediate Response (Success/Failure)
    ↓
Client Polls
    ↓
Card Retrieved
```

### New Flow (Current)
```
Purchase Request
    ↓
Request Accepted (PENDING)
    ↓
Async Processing (PROCESSING)
    ↓
Card Allocated (SUCCEEDED)
    ↓
Webhook Delivery (Primary)
    ↓
Polling Fallback (Secondary)
    ↓
Completed
```

### UI Display for Each Status
- **PENDING**: "Request submitted, waiting for processing"
- **PROCESSING**: "Processing your request, card allocation in progress"
- **SUCCEEDED**: "Card allocated successfully"
- **FAILED**: "Purchase failed, reason provided"

### Operational Identifiers Displayed
- **Request ID**: Unique identifier for this purchase request
- **Correlation ID**: For tracing across systems
- **Idempotency Key**: For safe retries

### Webhook Status Display
- **Delivered**: "Card delivered via webhook"
- **Pending Retry**: "Delivery pending, will retry"
- **Failed**: "Delivery failed, manual replay available"
- **Dead-Lettered**: "Delivery permanently failed"

---

## Operational Tooling Added

### 1. Queue Dashboard
- Pending jobs count
- Processing jobs count
- Failed jobs count
- Retry jobs count
- Dead-letter jobs count
- Stuck job detection

### 2. Webhook Monitoring
- Webhook success rate
- Failed deliveries
- Retry attempts
- Dead-letter count
- Last delivery timestamp

### 3. Replay Management
- View failed deliveries
- Trigger manual replay
- Track replay history
- Monitor replay success

### 4. Alerts & Notifications
- Failed delivery alerts
- Queue backlog alerts
- Dead-letter queue alerts
- Processing latency alerts

---

## Backward Compatibility Considerations

### Polling Support
- Polling remains available as fallback recovery mechanism
- Documented as secondary integration method
- Not removed, only de-emphasized
- Useful for clients without webhook capability

### Existing API Contracts
- All existing endpoints remain unchanged
- New endpoints added alongside existing ones
- No breaking changes to purchase API
- Idempotency key remains required

### Financial Calculations
- No changes to commission logic
- No changes to balance calculations
- No changes to ledger structure
- Purchase and commission remain separate entries

### Data Preservation
- All existing transaction data remains valid
- New fields are additive only
- Backward compatibility maintained
- Migration path clear for existing integrations

---

## Webhook-First UX Readiness Assessment

### Current Readiness: 30%

**What's Ready**:
- Backend webhook infrastructure implemented
- Queue system operational
- Replay mechanism available
- Observability in place

**What's Needed**:
- Frontend pages revised (Tier 1: 5 pages)
- Webhook management UI (Settings page)
- API testing tools (API page)
- Operational dashboards (Provider/Distributor)
- Queue monitoring tools
- Documentation updates

### Implementation Roadmap

| Phase | Pages | Effort | Timeline |
|-------|-------|--------|----------|
| Phase 1 | DistributorPurchase | High | 1-2 days |
| Phase 2 | SettingsPage | Medium | 1 day |
| Phase 3 | APIPage | High | 2-3 days |
| Phase 4 | TransactionsPage | Medium | 1 day |
| Phase 5 | Provider Dashboard | Medium | 1 day |
| Phase 6 | Queue Monitoring | High | 2 days |
| Phase 7 | Documentation | Medium | 1 day |

**Total Estimated Effort**: 9-11 days

---

## Conclusion

The frontend is currently misaligned with the new asynchronous, webhook-enabled architecture. Systematic revision of 12 pages across three tiers will bring the UI into alignment with the backend capabilities, providing users with operational visibility, reliability, and enterprise-grade experience.

The phased approach ensures stability, maintains backward compatibility, and protects financial data integrity throughout the transition.

**Next Step**: Proceed with Phase 1 - Revise Purchase Page for Async Lifecycle
