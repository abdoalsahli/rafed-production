# Stitch Handoff Guide: Frontend Architecture Ready

**Status:** Frontend architecture fully refactored and ready for visual replacement. All business logic extracted into hooks. Presentation components are isolated and safe to replace.

---

## 1. SAFE REPLACEMENT ZONES

### ✓ Safe to Replace Visually
- All presentation components (UI only, no logic)
- Layout wrappers (UnifiedSidebar, AuthenticatedLayout)
- All page components (receive data from hooks)
- All modal/dialog components
- All table components
- All form components

### ⚠️ DO NOT MODIFY
- All hooks in `/client/src/hooks/data/` (business logic)
- All tRPC procedures in `server/routers/`
- All backend endpoints
- Authentication flow (`useAuth`, OAuth)
- Navigation logic (`useNavigationItems`, `useCurrentRoleContext`)

---

## 2. FOUNDATION LAYER

### UnifiedSidebar Component
**File:** `client/src/components/UnifiedSidebar.tsx`
**Status:** ✓ Safe to replace visually

**Props Contract:**
```typescript
interface UnifiedSidebarProps {
  navItems: NavItem[];           // Array of navigation items with label, path, icon
  currentPath: string;           // Current route path for active state
  userEmail: string | null;      // User email for display
  userRole: string | null;       // User role (admin/provider/distributor)
  onNavigate: (path: string) => void;  // Callback when nav item clicked
  onLogout: () => void;          // Callback for logout button
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;  // Lucide icon component
}
```

**Replacement Rules:**
- Keep all props exactly as defined
- Maintain active state styling based on `currentPath`
- Preserve mobile toggle functionality (hamburger menu)
- Keep logout button functionality
- Preserve role display in header

---

### AuthenticatedLayout Wrapper
**File:** `client/src/App.tsx` (inside App component)
**Status:** ✓ Safe to replace visually

**Props Contract:**
```typescript
interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  currentPath: string;
  userEmail: string | null;
  userRole: string | null;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}
```

**Replacement Rules:**
- Maintain two-column layout (sidebar + content)
- Keep responsive behavior (sidebar collapses on mobile)
- Preserve all callback handlers
- Keep children rendering in content area

---

## 3. ADMIN SECTION

### Pages Ready for Replacement
- `/admin/organizations` → `OrganizationsPage.tsx`
- `/admin/users` → `UsersPage.tsx`

### Presentation Components
All components in `client/src/components/admin/`:

#### OrganizationsTable
**Props:**
```typescript
interface OrganizationsTableProps {
  organizations: Organization[];
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (org: Organization) => void;
  onDelete?: (orgId: number) => void;
  onStatusChange?: (orgId: number, status: string) => void;
}

interface Organization {
  id: number;
  name: string;
  email?: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: Date;
  [key: string]: any;
}
```

#### OrganizationForm
**Props:**
```typescript
interface OrganizationFormProps {
  organization?: Organization | null;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (data: Organization) => Promise<void>;
  onCancel?: () => void;
}
```

#### UsersTable
**Props:**
```typescript
interface UsersTableProps {
  users: User[];
  isLoading?: boolean;
  error?: string | null;
  onActivate?: (userId: number) => void;
  onSuspend?: (userId: number) => void;
  onAssignRole?: (userId: number, role: string) => void;
}

interface User {
  id: number;
  email?: string;
  name?: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  createdAt?: Date;
  [key: string]: any;
}
```

#### ActivateUserModal / SuspendUserModal
**Props:**
```typescript
interface UserActionModalProps {
  isOpen: boolean;
  user: User | null;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}
```

**Hooks (DO NOT MODIFY):**
- `useOrganizations` - Handles all organization CRUD
- `useUsers` - Handles all user management

---

## 4. PROVIDER SECTION

### Pages Ready for Replacement
- `/provider/dashboard` → `DashboardPage.tsx`
- `/provider/products` → `ProductsPage.tsx`
- `/provider/inventory` → `InventoryPage.tsx`
- `/provider/upload` → `UploadPage.tsx`
- `/provider/requests` → `RequestsPage.tsx`
- `/provider/distributors` → `DistributorsPage.tsx`

### Presentation Components
All components in `client/src/components/provider/`:

#### ProviderDashboardView
**Props:**
```typescript
interface ProviderDashboardViewProps {
  totalProviders: number;
  activeDistributors: number;
  pendingRequests: number;
  recentActivity?: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
  }>;
  isLoading?: boolean;
}
```

#### ProductsTable
**Props:**
```typescript
interface ProductsTableProps {
  products: Product[];
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (product: Product) => void;
  onStatusChange?: (productId: number, status: string) => void;
  onDelete?: (productId: number) => void;
}

interface Product {
  id: number;
  name: string;
  displayName?: string;
  faceValue?: number;
  price: number;
  currency?: string;
  status: 'active' | 'inactive';
  [key: string]: any;
}
```

#### ProductForm
**Props:**
```typescript
interface ProductFormProps {
  product?: Product | null;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (data: Product) => Promise<void>;
  onCancel?: () => void;
}
```

#### InventoryTable
**Props:**
```typescript
interface InventoryTableProps {
  items: InventoryItem[];
  isLoading?: boolean;
  error?: string | null;
  onAdjust?: (itemId: number, quantity: number) => void;
}

interface InventoryItem {
  id: number;
  productName: string;
  quantity: number;
  lastUpdated?: Date;
  [key: string]: any;
}
```

#### UploadCardsForm
**Props:**
```typescript
interface UploadCardsFormProps {
  onUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}
```

#### UploadHistoryTable
**Props:**
```typescript
interface UploadHistoryTableProps {
  uploads: UploadRecord[];
  isLoading?: boolean;
}

interface UploadRecord {
  id: string;
  fileName: string;
  uploadedAt: Date;
  status: 'completed' | 'processing' | 'failed';
  recordCount: number;
}
```

#### ProviderRequestsTable
**Props:**
```typescript
interface ProviderRequestsTableProps {
  requests: ProviderRequest[];
  isLoading?: boolean;
  error?: string | null;
  onApprove?: (requestId: number) => void;
  onReject?: (requestId: number) => void;
}

interface ProviderRequest {
  id: number;
  distributorName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedCommission?: number;
  requestedCreditLine?: number;
  createdAt?: Date;
  [key: string]: any;
}
```

#### ProviderDistributorsTable
**Props:**
```typescript
interface ProviderDistributorsTableProps {
  distributors: ProviderDistributor[];
  isLoading?: boolean;
  error?: string | null;
  onSuspend?: (distributorId: number) => void;
  onReactivate?: (distributorId: number) => void;
}

interface ProviderDistributor {
  id: number;
  name: string;
  status: 'active' | 'suspended';
  commissionRate?: number;
  creditLine?: number;
  connectedAt?: Date;
  [key: string]: any;
}
```

**Hooks (DO NOT MODIFY):**
- `useProviderDashboard` - Dashboard metrics
- `useProducts` - Product CRUD and import
- `useInventory` - Inventory management
- `useInventoryUpload` - Card uploads
- `useProviderRequests` - Request approval workflow
- `useProviderDistributors` - Distributor relationships

---

## 5. DISTRIBUTOR SECTION

### Pages Ready for Replacement
- `/distributor/dashboard` → `DashboardPage.tsx`
- `/distributor/connect-provider` → `ConnectProviderPage.tsx`
- `/distributor/providers` → `ProvidersPage.tsx` (needs refactoring)
- `/distributor/products` → `ProductsPage.tsx` (needs refactoring)
- `/distributor/transactions` → `TransactionsPage.tsx` (needs refactoring)
- `/distributor/wallet` → `WalletPage.tsx` (needs refactoring)
- `/distributor/api` → `ApiPage.tsx` (needs refactoring)

### Presentation Components
All components in `client/src/components/distributor/`:

#### DistributorDashboardView
**Props:**
```typescript
interface DistributorDashboardViewProps {
  walletBalance: number;
  totalSpent: number;
  activeProviders: number;
  pendingRequests: number;
  recentTransactions?: Array<{
    id: string;
    date: string | Date;
    provider: string;
    amount: number;
    type: 'debit' | 'credit';
    status: 'completed' | 'pending' | 'failed';
  }>;
  lowBalanceAlert?: boolean;
  onConnectProvider?: () => void;
  isLoading?: boolean;
}
```

#### ConnectProviderForm
**Props:**
```typescript
interface ConnectProviderFormProps {
  onSearch: (providerCode: string) => Promise<Provider | null | undefined>;
  onConnect: (providerCode: string, commission: number, creditLine: number) => Promise<void>;
  isSearching?: boolean;
  isConnecting?: boolean;
  error?: string | null;
}

interface Provider {
  id: number;
  name: string;
  providerCode: string;
  status: string;
}
```

#### ConnectedProvidersTable
**Props:**
```typescript
interface ConnectedProvidersTableProps {
  providers: ConnectedProvider[];
  isLoading?: boolean;
  error?: string | null;
  onDisconnect?: (providerId: number) => void;
}

interface ConnectedProvider {
  id: number;
  name: string;
  status: 'active' | 'suspended' | 'pending';
  commissionRate?: number;
  creditLine?: number;
  availableCredit?: number;
  connectedAt?: Date;
}
```

#### ProductCatalogView
**Props:**
```typescript
interface ProductCatalogViewProps {
  products: CatalogProduct[];
  isLoading?: boolean;
  error?: string | null;
  onPurchase?: (productId: number) => void;
  onFilterChange?: (filter: { searchTerm?: string; providerId?: number }) => void;
}

interface CatalogProduct {
  id: number;
  name: string;
  displayName?: string;
  faceValue?: number;
  price: number;
  currency?: string;
  providerId: number;
  providerName: string;
  status: 'active' | 'inactive';
  stock?: number;
}
```

#### TransactionsTable
**Props:**
```typescript
interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  error?: string | null;
  totalCount?: number;
  onLoadMore?: () => void;
}

interface Transaction {
  id: string;
  date: string | Date;
  provider: string;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  type: 'debit' | 'credit';
  description?: string;
}
```

#### WalletSummary
**Props:**
```typescript
interface WalletSummaryProps {
  wallet: WalletData;
  isLoading?: boolean;
  error?: string | null;
  lowBalanceThreshold?: number;
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onRefresh?: () => void;
}

interface WalletData {
  balance: number;
  currency: string;
  totalSpent: number;
  totalEarned: number;
  lastUpdated?: Date;
}
```

#### ApiCredentialsView
**Props:**
```typescript
interface ApiCredentialsViewProps {
  credentials: ApiCredentials | null;
  isLoading?: boolean;
  error?: string | null;
  onGenerateKey?: () => Promise<void>;
  onRotateKey?: () => Promise<void>;
  onUpdateWebhook?: (url: string) => Promise<void>;
}

interface ApiCredentials {
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  isActive: boolean;
  createdAt?: Date;
  lastRotated?: Date;
}
```

#### NotificationsPanel
**Props:**
```typescript
interface NotificationsPanelProps {
  notifications: Notification[];
  isLoading?: boolean;
  error?: string | null;
  unreadCount?: number;
  onMarkAsRead?: (notificationId: string) => Promise<void>;
  onMarkAllAsRead?: () => Promise<void>;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
  relatedEntityId?: number;
  relatedEntityType?: string;
}
```

**Hooks (DO NOT MODIFY):**
- `useDistributorDashboard` - Dashboard metrics
- `useConnectionFlow` - Provider connection logic
- `useConnectedProviders` - Active provider relationships
- `useDistributorCatalog` - Product catalog
- `usePurchaseFlow` - Purchase validation and idempotency
- `useTransactions` - Transaction history
- `useWallet` - Wallet balance and operations
- `useDistributorNotifications` - Notification management
- `useApiIntegration` - API key and webhook management

---

## 6. CRITICAL PRESERVATION RULES

### ✓ MUST PRESERVE
1. **All prop interfaces** - Exact names and types
2. **All callback signatures** - onSubmit, onCancel, onEdit, etc.
3. **Loading and error states** - isLoading, error props
4. **Data types** - Date objects, enums, optional fields
5. **Form validation** - Required fields, constraints
6. **Mobile responsiveness** - Breakpoints, layout shifts
7. **Accessibility** - ARIA labels, keyboard navigation
8. **State management** - All state comes from hooks, not components

### ⚠️ WARNINGS BEFORE STITCH GENERATION

1. **No Business Logic in Components**
   - All data fetching, mutations, validation must stay in hooks
   - Components are presentation-only

2. **Hooks Are Immutable**
   - Do not modify hook signatures or return types
   - Do not add new hooks without updating all pages using them

3. **Backend Endpoints Unchanged**
   - All tRPC procedures remain as-is
   - No new endpoints needed for visual redesign

4. **Authentication Preserved**
   - OAuth flow unchanged
   - User context from `useAuth()` hook

5. **Navigation Preserved**
   - Route structure unchanged
   - Navigation items from `useNavigationItems()` hook

6. **Type Safety**
   - All components are fully typed
   - Stitch components must accept same prop types

---

## 7. STITCH REPLACEMENT WORKFLOW

### Step 1: Generate Stitch Screens
Create Stitch designs for each section:
- Foundation (Sidebar, Layout)
- Admin (Tables, Forms, Modals)
- Provider (Dashboard, Tables, Forms)
- Distributor (Dashboard, Tables, Forms, Modals)

### Step 2: Export Stitch Components
Export Stitch components with exact prop interfaces matching this guide.

### Step 3: Replace Components
For each presentation component:
1. Replace file content with Stitch component
2. Keep props interface identical
3. Keep all callbacks unchanged
4. Test with existing hooks

### Step 4: Validate Integration
- All pages load without errors
- All data displays correctly
- All buttons/forms work
- Mobile responsive
- No TypeScript errors

---

## 8. FILE STRUCTURE FOR REPLACEMENT

```
REPLACE VISUALLY:
├── client/src/components/
│   ├── UnifiedSidebar.tsx
│   ├── admin/
│   │   ├── OrganizationsTable.tsx
│   │   ├── OrganizationForm.tsx
│   │   ├── UsersTable.tsx
│   │   ├── ActivateUserModal.tsx
│   │   └── SuspendUserModal.tsx
│   ├── provider/
│   │   ├── ProviderDashboardView.tsx
│   │   ├── ProductsTable.tsx
│   │   ├── ProductForm.tsx
│   │   ├── InventoryTable.tsx
│   │   ├── UploadCardsForm.tsx
│   │   ├── UploadHistoryTable.tsx
│   │   ├── ProviderRequestsTable.tsx
│   │   └── ProviderDistributorsTable.tsx
│   └── distributor/
│       ├── DistributorDashboardView.tsx
│       ├── ConnectProviderForm.tsx
│       ├── ConnectedProvidersTable.tsx
│       ├── ProductCatalogView.tsx
│       ├── TransactionsTable.tsx
│       ├── WalletSummary.tsx
│       ├── ApiCredentialsView.tsx
│       └── NotificationsPanel.tsx

DO NOT MODIFY:
├── client/src/hooks/
│   ├── useNavigationItems.ts
│   ├── useCurrentRoleContext.ts
│   └── data/
│       ├── useOrganizations.ts
│       ├── useUsers.ts
│       ├── useProviderDashboard.ts
│       ├── useProducts.ts
│       ├── useInventory.ts
│       ├── useInventoryUpload.ts
│       ├── useProviderRequests.ts
│       ├── useProviderDistributors.ts
│       ├── useDistributorDashboard.ts
│       ├── useConnectionFlow.ts
│       ├── useConnectedProviders.ts
│       ├── useDistributorCatalog.ts
│       ├── usePurchaseFlow.ts
│       ├── useTransactions.ts
│       ├── useWallet.ts
│       ├── useDistributorNotifications.ts
│       └── useApiIntegration.ts
├── server/routers/ (all)
├── client/src/lib/trpc.ts
└── client/src/App.tsx (core logic)
```

---

## 9. QUICK REFERENCE: PAGES → HOOKS MAPPING

| Page | Hook | Component |
|------|------|-----------|
| /admin/organizations | useOrganizations | OrganizationsTable, OrganizationForm |
| /admin/users | useUsers | UsersTable, ActivateUserModal, SuspendUserModal |
| /provider/dashboard | useProviderDashboard | ProviderDashboardView |
| /provider/products | useProducts | ProductsTable, ProductForm |
| /provider/inventory | useInventory | InventoryTable |
| /provider/upload | useInventoryUpload | UploadCardsForm, UploadHistoryTable |
| /provider/requests | useProviderRequests | ProviderRequestsTable |
| /provider/distributors | useProviderDistributors | ProviderDistributorsTable |
| /distributor/dashboard | useDistributorDashboard | DistributorDashboardView |
| /distributor/connect-provider | useConnectionFlow | ConnectProviderForm |
| /distributor/providers | useConnectedProviders | ConnectedProvidersTable |
| /distributor/products | useDistributorCatalog | ProductCatalogView |
| /distributor/transactions | useTransactions | TransactionsTable |
| /distributor/wallet | useWallet | WalletSummary |
| /distributor/api | useApiIntegration | ApiCredentialsView |

---

## 10. INTEGRATION CHECKLIST

Before generating Stitch designs, confirm:

- [ ] All presentation components identified
- [ ] All prop interfaces documented
- [ ] All hooks preserved and untouched
- [ ] Backend endpoints unchanged
- [ ] Authentication flow preserved
- [ ] Navigation structure preserved
- [ ] Type safety maintained
- [ ] Mobile responsiveness planned
- [ ] Accessibility requirements understood
- [ ] No business logic in components

---

**Ready for Stitch Design Generation** ✓

Frontend architecture is fully prepared. All integration points documented. Business logic isolated in hooks. Presentation components ready for visual replacement.

Generate Stitch screens using this guide as the contract.
