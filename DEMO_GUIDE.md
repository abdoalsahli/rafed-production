# Prepaid Card Platform - Demo Walkthrough Guide

## Overview

This guide provides a structured walkthrough for demonstrating the prepaid card platform to clients. The demo showcases the core financial and API management capabilities built on real database records.

---

## Demo Accounts

### Demo Distributors

Use these distributor IDs to log in and demonstrate different workflows:

| Distributor | ID | Purpose |
|---|---|---|
| Demo Distributor 1 - 1777406974897 | 1029516 | Primary demo account - full workflow |
| Demo Distributor 2 - 1777406974897 | 1029517 | Secondary account - multi-provider demo |
| Demo Distributor 3 - 1777406974897 | 1029518 | API credentials demo |

### Demo Providers

The following providers are seeded and available for transactions:

| Provider | ID | Products |
|---|---|---|
| Libyana | 1034745 | 5, 10, 20, 50, 75 LYD cards |
| Almadar | 1034746 | 5, 10, 20, 50, 75 LYD cards |
| LTT | 1034747 | 5, 10, 20, 50, 75 LYD cards |
| Connect | 1034748 | 5, 10, 20, 50, 75 LYD cards |
| Giga | 1034749 | 5, 10, 20, 50, 75 LYD cards |

---

## Demo Walkthrough (15-20 minutes)

### Phase 1: Platform Overview (2 minutes)

**Goal:** Introduce the distributor dashboard and navigation

1. **Navigate to Dashboard**
   - URL: `/distributor/dashboard`
   - Show: Overview cards, provider relationships summary
   - Highlight: Provider Accounts Overview section showing aggregate metrics

2. **Explain Navigation**
   - Sidebar shows all key sections
   - Provider Accounts is the primary financial view
   - API integration available for programmatic access

---

### Phase 2: Provider Accounts & Financial Management (5 minutes)

**Goal:** Demonstrate provider-specific account management

1. **Access Provider Accounts**
   - URL: `/distributor/provider-accounts` or `/distributor/wallet`
   - Show: List of active provider relationships
   - Highlight: Per-provider balance, credit line, used credit

2. **Explain Account Structure**
   - Each provider has a separate financial account
   - Balance: Available funds
   - Credit Line: Maximum credit available
   - Used Credit: Current credit utilization
   - Commission rates per provider

3. **Key Points**
   - Distributors manage relationships with multiple providers
   - Each relationship has independent financial tracking
   - Real-time balance updates after transactions

---

### Phase 3: Products & Inventory (3 minutes)

**Goal:** Show available products and card denominations

1. **Navigate to Products**
   - URL: `/distributor/products` (if available)
   - Show: All available card products by provider
   - Highlight: Denominations (5, 10, 20, 50, 75 LYD)

2. **Explain Product Catalog**
   - Products are provider-specific
   - Each denomination is a separate SKU
   - Prices include provider markup
   - Real-time availability

---

### Phase 4: Transactions & History (3 minutes)

**Goal:** Demonstrate transaction tracking and reporting

1. **Access Transactions**
   - URL: `/distributor/transactions`
   - Show: Transaction history with filters
   - Highlight: Provider filtering, date range, status

2. **Explain Transaction Data**
   - Transaction ID and idempotency key
   - Provider and product information
   - Amount and commission breakdown
   - Transaction status (pending, completed, failed)
   - Timestamp and audit trail

3. **Key Points**
   - All transactions are immutable (append-only ledger)
   - Commission calculations are transparent
   - Full audit trail for compliance

---

### Phase 5: API Integration (4 minutes)

**Goal:** Showcase programmatic access capabilities

1. **Navigate to API Page**
   - URL: `/distributor/api`
   - Show: API credentials management interface

2. **Demonstrate API Credentials**
   - View masked API key
   - Show webhook URL configuration
   - Explain credential rotation workflow

3. **API Key Management**
   - Generate new API key (button available)
   - Rotate existing key (for security)
   - Update webhook URL (for event delivery)
   - Last used timestamp

4. **Explain API-First Architecture**
   - All distributor operations available via API
   - Idempotency keys prevent duplicate processing
   - Real-time balance updates
   - Webhook events for critical operations

---

## Key Features to Highlight

### 1. Multi-Provider Support
- Distributors manage relationships with multiple providers
- Each provider has independent financial accounts
- Per-provider commission rates and credit lines

### 2. Financial Transparency
- Real-time balance tracking
- Commission calculations visible in transactions
- Append-only ledger for compliance
- Credit utilization monitoring

### 3. API-First Design
- RESTful API for all operations
- Idempotency keys for safe retries
- Webhook support for event notifications
- Real-time data access

### 4. Security & Compliance
- Role-based access control (admin/user)
- Audit logs for all sensitive operations
- PIN encryption for card data
- Immutable transaction records

---

## Demo Scenarios

### Scenario 1: New Distributor Onboarding
**Duration:** 5 minutes

1. Show distributor dashboard
2. Explain provider relationship setup
3. Demonstrate credit line configuration
4. Show commission structure

**Key Message:** "Onboarding is streamlined with pre-configured relationships and automatic balance tracking."

---

### Scenario 2: Daily Operations
**Duration:** 7 minutes

1. Access Provider Accounts to check balances
2. View available products
3. Show transaction history
4. Explain commission tracking

**Key Message:** "Distributors have complete visibility into their financial position across all providers in real-time."

---

### Scenario 3: API Integration
**Duration:** 5 minutes

1. Show API credentials page
2. Explain API key generation
3. Demonstrate webhook configuration
4. Discuss idempotency and retry logic

**Key Message:** "The API-first architecture enables seamless integration with POS systems and third-party platforms."

---

## Common Questions & Answers

**Q: How are commissions calculated?**
A: Commissions are calculated per transaction based on the provider-distributor relationship configuration. Each transaction shows both the purchase amount and commission earned. Commissions are credited to the distributor's account after transaction completion.

**Q: Can distributors manage multiple providers?**
A: Yes. Each distributor can have active relationships with multiple providers. Each relationship has independent financial tracking, commission rates, and credit lines.

**Q: How are API keys secured?**
A: API keys are generated with a masked display (showing only the last 12 characters). The full secret is shown only once during generation. Keys can be rotated at any time for security.

**Q: What happens if a transaction fails?**
A: Failed transactions are recorded in the ledger with a "failed" status. They do not affect account balances or credit utilization. The transaction can be retried using the same idempotency key.

**Q: How are refunds handled?**
A: Refunds are recorded as separate transactions with a "refund" type. They credit the distributor's account and reduce commission amounts accordingly. Full audit trail is maintained.

---

## Technical Details for Advanced Demos

### Database Schema Highlights

- **provider_distributor_accounts**: Per-provider financial accounts
- **provider_distributor_ledger**: Immutable append-only transaction ledger
- **transactions**: Purchase and refund records with idempotency keys
- **distributor_api_credentials**: API key management and webhook configuration
- **audit_logs**: Complete audit trail of sensitive operations

### API Endpoints (via tRPC)

- `distributorApi.getCredentials`: Retrieve current API credentials
- `distributorApi.generateApiKey`: Generate new API key
- `distributorApi.rotateApiKey`: Rotate existing key
- `distributorApi.updateWebhookUrl`: Update webhook endpoint
- `distributorApi.getApiLogs`: Retrieve recent API activity

---

## Troubleshooting

### Issue: Dashboard shows no provider accounts
**Solution:** Check that the distributor has active relationships with providers. Navigate to Provider Accounts page to verify relationships.

### Issue: API credentials page is empty
**Solution:** Generate new API credentials using the "Generate API Key" button on the API page.

### Issue: Transaction history is empty
**Solution:** Verify that transactions have been created in the database. Check transaction status and date range filters.

---

## Post-Demo Follow-Up

1. **Provide API Documentation**
   - Share API endpoint documentation
   - Provide example requests/responses
   - Include webhook event schemas

2. **Schedule Integration Session**
   - Discuss POS system integration
   - Review API requirements
   - Plan implementation timeline

3. **Address Questions**
   - Collect feedback on platform features
   - Discuss customization needs
   - Plan next steps

---

## Demo Checklist

- [ ] Verify all demo accounts are accessible
- [ ] Check provider relationships are active
- [ ] Confirm API credentials are generated
- [ ] Test dashboard loading and responsiveness
- [ ] Verify transaction history is visible
- [ ] Test API credential rotation
- [ ] Check webhook URL configuration
- [ ] Verify all navigation links work
- [ ] Test responsive design on mobile
- [ ] Prepare backup demo accounts

---

## Notes for Demo Lead

- **Timing:** Allocate 20-25 minutes for full walkthrough
- **Pacing:** Move quickly through familiar sections, spend time on differentiators
- **Engagement:** Ask questions to understand client priorities
- **Focus:** Emphasize multi-provider support and API-first architecture
- **Flexibility:** Be ready to dive deep into specific areas based on client interest

---

## Contact & Support

For questions about the demo or platform capabilities:
- Review this guide for common scenarios
- Check the platform README for technical details
- Contact the development team for advanced questions
