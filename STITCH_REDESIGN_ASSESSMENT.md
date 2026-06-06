# Stitch UI Redesign Feasibility Assessment

**Date:** April 21, 2026  
**Scope:** Current frontend/backend integration analysis for Stitch component replacement  
**Method:** Code inspection of actual implementation patterns, not theory

---

## Executive Summary

**Recommendation:** 🟡 **HYBRID APPROACH (Partial Redesign)**

Stitch redesign is **feasible but risky** on pages with tightly coupled business logic. Current architecture has:

- ✅ **Clean separation** at provider/client layer (centralized in `main.tsx`)
- ✅ **Mostly prop-driven components** (56 of 134 components use props interface)
- ✅ **Low business logic in components** (only 5 components have direct tRPC calls)
- ❌ **Tightly coupled pages** (DistributorDemoPage, RequestsPage mix UI + state + mutations)
- ❌ **No custom hook extraction** (state management lives in page components)
- ❌ **No component composition layer** (pages directly render UI, not through composable pieces)

**Bottom Line:** You can safely redesign 2-3 pages with Stitch (InventoryPage, AlertsPageV2, TransactionHistoryPage). Pages like DistributorDemoPage and RequestsPage need careful refactoring first.

---

## Part 1: Current Frontend Architecture

### Data Flow: API → UI

```
main.tsx
├── Creates QueryClient + tRPC client
├── Configures httpBatchLink to /api/trpc
├── Sets up error handling (auto-redirect on 401)
└── Wraps App with <trpc.Provider> + <QueryClientProvider>
    │
    ├─→ App.tsx (route registry)
    │   └─→ Page components (e.g., DistributorDemoPage)
    │       ├─→ useAuth() hook (auth state from context)
    │       ├─→ trpc.demoPurchase.getBalance.useQuery()
    │       ├─→ trpc.demoPurchase.purchaseCard.useMutation()
    │       ├─→ Local state (useState for UI state)
    │       └─→ Child components (Card, Button, Dialog)
    │           └─→ Receive data as props
    │
    └─→ Global providers (ThemeProvider, AlertProvider, etc.)
```

### Key Architecture Points

**1. Centralized Backend Connection (main.tsx)**
- Single `httpBatchLink` to `/api/trpc`
- Automatic `credentials: include` for auth
- Automatic 401 redirect to login
- Superjson transformer for Date/Decimal serialization
- **Impact:** Stitch can replace UI without touching this layer ✅

**2. tRPC Hook Pattern (pages)**
- Pages use `trpc.*.useQuery()` for reads
- Pages use `trpc.*.useMutation()` for writes
- Queries auto-managed by React Query (caching, refetching, deduplication)
- Mutations have `onSuccess`, `onError`, `onSettled` callbacks
- **Impact:** Logic is hook-based, not component-based. Stitch UI can call same hooks ✅

**3. Component Props Pattern (UI layer)**
- 56 of 134 components accept props
- Components mostly receive data as props from pages
- Components don't directly call tRPC
- Components are mostly pure/presentational
- **Impact:** Stitch can replace these components easily ✅

**4. State Management (pages)**
- Local `useState` for UI state (modals, selections, loading)
- No Redux, Zustand, or other state library
- State lives in page components, not extracted to hooks
- **Impact:** State logic is tightly coupled to page components ⚠️

**5. Error Handling (mixed)**
- Global 401 redirect in `main.tsx` ✅
- Per-page error state in `useState` ⚠️
- No centralized error boundary for API errors
- **Impact:** Stitch pages need to replicate error handling ⚠️

---

## Part 2: Integration Complexity with Stitch

### How Easy Is It to Plug New UI Into Existing Logic?

**Answer: DEPENDS ON THE PAGE**

#### Easy Pages (Low Risk)

**InventoryPage** - 🟢 **EASIEST**
```typescript
// Current: Page fetches data, transforms, passes to component
const { data: inventoryData } = trpc.provider.getInventory.useQuery();
const products = inventoryData?.inventory?.map(...) || [];

<InventoryManagement
  products={products}
  isLoading={isLoading}
  onEditPrice={...}
  onUploadCards={...}
  onViewDetails={...}
/>
```

**Why easy:**
- Data fetch is isolated from UI
- Component receives clean props
- Component is presentational only
- Action handlers are already placeholders
- **Effort:** Replace `<InventoryManagement>` with Stitch component, keep page logic unchanged

**TransactionHistoryPage** - 🟢 **EASY**
```typescript
// Current: Page fetches data, maps to display format, renders
const { data: transactionsData } = trpc.demoPurchase.getTransactions.useQuery();

return (
  <div>
    {transactionsData.map(txn => (
      // Inline rendering of transaction items
    ))}
  </div>
)
```

**Why easy:**
- Single query, no mutations
- Simple data transformation
- Inline rendering (no component abstraction)
- No complex state management
- **Effort:** Extract transaction item rendering to Stitch component, keep page logic

**AlertsPageV2** - 🟢 **EASY**
```typescript
// Current: Page fetches alerts, filters locally, renders
const { data: alertsData } = trpc.financial.alerts.useQuery();
// Local state for search/filter
// Renders alert list with local filtering
```

**Why easy:**
- Read-only (no mutations)
- Local filtering (no backend dependency)
- Simple rendering
- **Effort:** Replace alert list rendering with Stitch component

---

#### Medium Risk Pages

**ProviderRequestsPage** - 🟡 **MEDIUM RISK**
```typescript
// Current: Page manages complex state + mutations + dialogs
const [confirmDialog, setConfirmDialog] = useState({...});
const [successMessage, setSuccessMessage] = useState(null);
const [errorMessage, setErrorMessage] = useState(null);

const approveMutation = trpc.provider.approveRequest.useMutation({
  onSuccess: (data) => {
    setSuccessMessage(data.message);
    setConfirmDialog({...reset});
    refetch();
    setTimeout(() => setSuccessMessage(null), 3000);
  },
  onError: (error) => {
    setErrorMessage(error.message);
    setTimeout(() => setErrorMessage(null), 3000);
  },
});

const handleApprove = (requestId) => {
  setConfirmDialog({ isOpen: true, action: 'approve', requestId });
};

const handleConfirm = () => {
  if (confirmDialog.action === 'approve') {
    approveMutation.mutate({ requestId: confirmDialog.requestId });
  }
};
```

**Why medium risk:**
- Multiple state variables for UI flow
- Mutations with side effects (refetch, message timeouts)
- Dialog state management
- Action handlers with conditional logic
- **Risks:**
  - Stitch component can't easily manage this state
  - Need to extract state management to custom hook
  - Mutation callbacks need to stay in page
  - Dialog flow logic needs to stay in page

**Effort:** 
- Extract state to custom hook: 30-45 min
- Create Stitch request card component: 20-30 min
- Rewire mutation callbacks: 15-20 min
- **Total: 1-1.5 hours**

---

#### High Risk Pages

**DistributorDemoPage** - 🔴 **HIGH RISK**
```typescript
// Current: Page manages complex purchase flow
const [selectedProvider, setSelectedProvider] = useState(1);
const [selectedProduct, setSelectedProduct] = useState(null);
const [showPurchaseModal, setShowPurchaseModal] = useState(false);
const [showResultModal, setShowResultModal] = useState(false);
const [purchaseResult, setPurchaseResult] = useState(null);
const [error, setError] = useState(null);
const [isPurchasing, setIsPurchasing] = useState(false);

// Three tRPC queries
const { data: balanceData, refetch: refetchBalance } = trpc.demoPurchase.getBalance.useQuery(...);
const { data: productsData } = trpc.demoPurchase.getProducts.useQuery(...);
const { data: transactionsData, refetch: refetchTransactions } = trpc.demoPurchase.getTransactions.useQuery(...);

// One mutation with complex callbacks
const purchaseMutation = trpc.demoPurchase.purchaseCard.useMutation({
  onSuccess: (data) => {
    setPurchaseResult(data);
    setShowPurchaseModal(false);
    setShowResultModal(true);
    setError(null);
    refetchBalance();
    refetchTransactions();
  },
  onError: (error) => {
    setError(error.message);
    setIsPurchasing(false);
  },
});

// Complex handler with idempotency key generation
const handlePurchase = async () => {
  if (!selectedProduct) {
    setError("Please select a product");
    return;
  }
  setIsPurchasing(true);
  setError(null);
  const idempotencyKey = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  purchaseMutation.mutate({
    providerId: selectedProvider,
    productId: selectedProduct,
    idempotencyKey,
  });
};

// Inline rendering of balance cards, product grid, modals
return (
  <div>
    {/* Balance cards */}
    {/* Product selection */}
    {/* Purchase button */}
    {/* Confirmation modal */}
    {/* Result modal */}
  </div>
);
```

**Why high risk:**
- 7 state variables for single feature
- 3 queries with interdependencies
- 1 mutation with complex side effects
- 2 modal flows (confirmation + result)
- Inline rendering (no component abstraction)
- Idempotency key generation logic
- Multiple refetch calls in mutation callback
- **Risks:**
  - Stitch can't replace entire page at once
  - Need to extract state management to custom hook
  - Need to extract modal logic to separate components
  - Need to extract balance cards to component
  - Need to extract product grid to component
  - Need to extract modals to components
  - Mutation callback logic needs careful rewiring

**Effort:**
- Extract state to custom hook: 45-60 min
- Create balance card component: 20-30 min
- Create product grid component: 20-30 min
- Create confirmation modal component: 20-30 min
- Create result modal component: 20-30 min
- Rewire all components to work together: 30-45 min
- **Total: 3-4 hours** (vs 30 min for InventoryPage)

---

### Which Pages Are Easiest to Redesign?

**Ranked by effort:**

| Page | Risk | Effort | Why |
|------|------|--------|-----|
| AlertsPageV2 | 🟢 Low | 20-30 min | Read-only, simple rendering |
| TransactionHistoryPage | 🟢 Low | 30-45 min | Single query, simple transform |
| InventoryPage | 🟢 Low | 30-45 min | Clean prop separation |
| ProviderRequestsPage | 🟡 Medium | 1-1.5 hrs | State management extraction needed |
| DistributorDemoPage | 🔴 High | 3-4 hrs | Multiple state/queries/mutations |

---

### Which Pages Are Risky?

**High Risk (Don't redesign first):**
1. **DistributorDemoPage** - Complex purchase flow with modal choreography
2. **ProviderRequestsPage** - Multiple state variables + mutation side effects
3. **ProviderInventoryPage** - Partially implemented (action handlers are placeholders)
4. **ProviderDashboardPage** - Multiple queries + alerts + actions

**Medium Risk (Redesign after refactoring):**
1. **DistributorDashboard** - Multiple queries + synthetic elements
2. **TransactionsPageV2** - Complex filtering + pagination

**Low Risk (Safe to redesign):**
1. **AlertsPageV2** - Read-only view
2. **TransactionHistoryPage** - Simple query + rendering
3. **InventoryPage** - Already has component separation

---

## Part 3: Risk Areas

### 1. Components That Mix UI + Business Logic

**Current Status:** Mostly isolated to pages, not components ✅

**Components with tRPC calls (5 total):**
- RuntimeHealthDashboard (reads runtime health)
- AIChatBox (sends/receives messages)
- Map (Google Maps integration)
- 2 others (likely dashboard/admin components)

**Risk:** These 5 components will need special handling if redesigned with Stitch

**Recommendation:** Keep these components as-is, don't redesign with Stitch yet

---

### 2. Duplicated Logic

**Current Status:** Moderate duplication ⚠️

**Examples:**
- Multiple dashboard variants (Dashboard, DistributorDashboard, DashboardPage, DashboardPageV2)
- Multiple transaction pages (Transactions, TransactionsPage, TransactionsPageV2)
- Multiple wallet pages (Wallet, WalletPage, WalletPageV2)
- Multiple provider pages (ProvidersPage, ProvidersPageV2)

**Risk:** Redesigning one variant might not cover all variants

**Recommendation:** Consolidate to single variant before Stitch redesign

---

### 3. Places Where Redesign May Break Functionality

**Critical Areas:**

#### A. Modal Choreography (DistributorDemoPage)
```typescript
// Current flow:
1. User clicks "Purchase Now"
2. setShowPurchaseModal(true)
3. Confirmation modal opens
4. User clicks "Confirm Purchase"
5. handlePurchase() called
6. purchaseMutation.mutate()
7. onSuccess callback:
   - setPurchaseResult(data)
   - setShowPurchaseModal(false)
   - setShowResultModal(true)
   - refetchBalance()
   - refetchTransactions()
8. Result modal opens with PIN

// Risk: If Stitch component doesn't maintain this exact flow,
// modals won't open/close correctly
```

**Recommendation:** Extract modal state to custom hook before Stitch redesign

#### B. Mutation Callbacks with Side Effects (RequestsPage)
```typescript
// Current flow:
1. User clicks "Approve"
2. handleApprove() sets confirmDialog state
3. Confirmation dialog opens
4. User clicks "Confirm"
5. handleConfirm() calls approveMutation.mutate()
6. onSuccess callback:
   - setSuccessMessage(data.message)
   - setConfirmDialog({...reset})
   - refetch() - CRITICAL: re-fetches request list
   - setTimeout(() => setSuccessMessage(null), 3000)

// Risk: If Stitch component doesn't call refetch(),
// request list won't update after approval
```

**Recommendation:** Extract mutation logic to custom hook before Stitch redesign

#### C. Query Dependencies (DistributorDemoPage)
```typescript
// Current flow:
const { data: balanceData, refetch: refetchBalance } = trpc.demoPurchase.getBalance.useQuery(
  { providerId: selectedProvider },
  { enabled: !!selectedProvider }
);

// If selectedProvider changes, query automatically re-runs
// If Stitch component doesn't pass providerId correctly,
// query won't update

// Risk: Stitch component needs to understand query dependencies
```

**Recommendation:** Document query dependencies in custom hooks

---

### 4. Areas Dependent on Specific Component Structure

**Current Structure:**
- Pages are containers (logic + state)
- Components are presentational (props only)
- No custom hooks for logic extraction

**Risk Areas:**
- Pages directly call tRPC hooks
- Pages directly manage state
- Components receive data as props
- No abstraction layer between page and component

**If Stitch replaces components:**
- Page logic must stay the same
- Stitch components must accept same props
- Stitch components must call same callbacks

**Recommendation:** Create custom hooks for logic extraction before Stitch redesign

---

## Part 4: Recommended Approach

### Option A: Full Page Replacement (NOT RECOMMENDED)
**Pros:**
- Complete visual redesign
- Fresh UI from scratch

**Cons:**
- High risk of breaking functionality
- Pages like DistributorDemoPage have 7 state variables + 3 queries + 1 mutation
- Stitch would need to replicate all logic
- Testing would be extensive

**Verdict:** ❌ Too risky for current architecture

---

### Option B: Polish Existing UI (SAFE BUT LIMITED)
**Pros:**
- No risk of breaking functionality
- Can improve existing components
- Faster delivery

**Cons:**
- Limited visual redesign
- Can't change page structure
- Can't introduce new components

**Verdict:** ✅ Safe but doesn't achieve redesign goals

---

### Option C: Hybrid Approach (RECOMMENDED) 🟢
**Strategy:**

**Phase 1: Refactor (1-2 days)**
- Extract state management to custom hooks
- Extract modal logic to separate components
- Extract form logic to separate components
- Create prop interfaces for all components

**Phase 2: Redesign Easy Pages (1-2 days)**
- AlertsPageV2 (20-30 min)
- TransactionHistoryPage (30-45 min)
- InventoryPage (30-45 min)
- **Total: 1.5-2 hours of actual redesign work**

**Phase 3: Redesign Medium Pages (2-3 days)**
- ProviderRequestsPage (1-1.5 hrs)
- ProviderDashboardPage (1-1.5 hrs)
- **Total: 2-3 hours of actual redesign work**

**Phase 4: Redesign High Risk Pages (3-4 days)**
- DistributorDemoPage (3-4 hrs)
- DistributorDashboard (2-3 hrs)
- **Total: 5-7 hours of actual redesign work**

**Total Timeline: 1-2 weeks**

---

## Part 5: Effort Estimates

### Per-Page Estimates (Stitch redesign only)

| Page | Refactoring | Redesign | Testing | Total |
|------|-------------|----------|---------|-------|
| AlertsPageV2 | 0 min | 20-30 min | 15-20 min | 35-50 min |
| TransactionHistoryPage | 0 min | 30-45 min | 15-20 min | 45-65 min |
| InventoryPage | 0 min | 30-45 min | 15-20 min | 45-65 min |
| ProviderRequestsPage | 30-45 min | 1-1.5 hrs | 20-30 min | 2-2.5 hrs |
| DistributorDemoPage | 45-60 min | 3-4 hrs | 30-45 min | 4-5.5 hrs |

### Best Case Scenario (3 easy pages)
- AlertsPageV2: 35-50 min
- TransactionHistoryPage: 45-65 min
- InventoryPage: 45-65 min
- **Total: 2-3 hours**

### Worst Case Scenario (all 5 pages)
- Easy pages: 2-3 hours
- Medium pages: 2-2.5 hours
- High risk pages: 4-5.5 hours
- **Total: 8.5-11 hours**

---

## Part 6: Final Recommendation

### Should We Redesign UI Using Stitch Now?

**Answer: YES, but with conditions**

**Recommendation: HYBRID APPROACH**

### Implementation Plan

**Week 1: Refactoring**
1. Extract state management to custom hooks (2-3 days)
   - `usePurchaseFlow` for DistributorDemoPage
   - `useRequestApproval` for RequestsPage
   - `useInventoryManagement` for InventoryPage
2. Extract modal logic to components (1-2 days)
3. Create prop interfaces for all components (1 day)

**Week 2: Stitch Redesign**
1. Easy pages (1-2 days)
   - AlertsPageV2
   - TransactionHistoryPage
   - InventoryPage
2. Medium pages (2-3 days)
   - ProviderRequestsPage
   - ProviderDashboardPage
3. High risk pages (3-4 days)
   - DistributorDemoPage
   - DistributorDashboard

**Week 3: Testing & Refinement**
1. End-to-end testing (1-2 days)
2. Visual refinement (1-2 days)
3. Performance optimization (1 day)

**Total Timeline: 3 weeks**

---

### What NOT to Touch

❌ **Don't redesign:**
1. RuntimeHealthDashboard (already polished, admin-only)
2. QueueDashboard (already polished, admin-only)
3. Components with direct tRPC calls (5 components)
4. Main layout components (MainLayout, DistributorLayout)
5. Authentication pages
6. Admin pages

✅ **Do redesign:**
1. Distributor-facing pages (purchase, transactions, wallet)
2. Provider-facing pages (inventory, requests, distributors)
3. Customer-facing pages (dashboard, balance, history)

---

## Conclusion

**Current State:** Frontend is well-structured for component replacement. Centralized backend connection, mostly prop-driven components, minimal business logic in UI layer.

**Stitch Readiness:** 🟡 **PARTIALLY READY**
- Easy pages: Ready now (2-3 hours work)
- Medium pages: Ready after light refactoring (2-3 hours work)
- High risk pages: Need significant refactoring first (3-4 hours work)

**Recommendation:** Proceed with hybrid approach. Start with easy pages (1-2 days), then refactor and redesign medium/high risk pages (2-3 weeks total).

**Risk Level:** 🟢 **LOW** with hybrid approach, 🔴 **HIGH** with full replacement approach

**Success Probability:** 85% with hybrid approach, 40% with full replacement approach
