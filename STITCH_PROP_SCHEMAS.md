# Stitch Prop Schemas: Quick Reference

This document provides TypeScript interfaces for all presentation components. Use these as the exact contract when creating Stitch components.

---

## FOUNDATION LAYER

### UnifiedSidebar
```typescript
interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
}

interface UnifiedSidebarProps {
  navItems: NavItem[];
  currentPath: string;
  userEmail: string | null;
  userRole: string | null;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}
```

**File to Replace:** `client/src/components/UnifiedSidebar.tsx`

---

## ADMIN SECTION

### OrganizationsTable
```typescript
interface Organization {
  id: number;
  name: string;
  email?: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt?: Date;
  [key: string]: any;
}

interface OrganizationsTableProps {
  organizations: Organization[];
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (org: Organization) => void;
  onDelete?: (orgId: number) => void;
  onStatusChange?: (orgId: number, status: string) => void;
}
```

**File to Replace:** `client/src/components/admin/OrganizationsTable.tsx`

---

### OrganizationForm
```typescript
interface OrganizationFormProps {
  organization?: Organization | null;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (data: Organization) => Promise<void>;
  onCancel?: () => void;
}
```

**File to Replace:** `client/src/components/admin/OrganizationForm.tsx`

---

### UsersTable
```typescript
interface User {
  id: number;
  email?: string;
  name?: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  createdAt?: Date;
  [key: string]: any;
}

interface UsersTableProps {
  users: User[];
  isLoading?: boolean;
  error?: string | null;
  onActivate?: (userId: number) => void;
  onSuspend?: (userId: number) => void;
  onAssignRole?: (userId: number, role: string) => void;
}
```

**File to Replace:** `client/src/components/admin/UsersTable.tsx`

---

### ActivateUserModal
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

**File to Replace:** `client/src/components/admin/ActivateUserModal.tsx`

---

### SuspendUserModal
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

**File to Replace:** `client/src/components/admin/SuspendUserModal.tsx`

---

## PROVIDER SECTION

### ProviderDashboardView
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

**File to Replace:** `client/src/components/provider/ProviderDashboardView.tsx`

---

### ProductsTable
```typescript
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

interface ProductsTableProps {
  products: Product[];
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (product: Product) => void;
  onStatusChange?: (productId: number, status: string) => void;
  onDelete?: (productId: number) => void;
}
```

**File to Replace:** `client/src/components/provider/ProductsTable.tsx`

---

### ProductForm
```typescript
interface ProductFormProps {
  product?: Product | null;
  isLoading?: boolean;
  error?: string | null;
  onSubmit: (data: Product) => Promise<void>;
  onCancel?: () => void;
}
```

**File to Replace:** `client/src/components/provider/ProductForm.tsx`

---

### InventoryTable
```typescript
interface InventoryItem {
  id: number;
  productName: string;
  quantity: number;
  lastUpdated?: Date;
  [key: string]: any;
}

interface InventoryTableProps {
  items: InventoryItem[];
  isLoading?: boolean;
  error?: string | null;
  onAdjust?: (itemId: number, quantity: number) => void;
}
```

**File to Replace:** `client/src/components/provider/InventoryTable.tsx`

---

### UploadCardsForm
```typescript
interface UploadCardsFormProps {
  onUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}
```

**File to Replace:** `client/src/components/provider/UploadCardsForm.tsx`

---

### UploadHistoryTable
```typescript
interface UploadRecord {
  id: string;
  fileName: string;
  uploadedAt: Date;
  status: 'completed' | 'processing' | 'failed';
  recordCount: number;
}

interface UploadHistoryTableProps {
  uploads: UploadRecord[];
  isLoading?: boolean;
}
```

**File to Replace:** `client/src/components/provider/UploadHistoryTable.tsx`

---

### ProviderRequestsTable
```typescript
interface ProviderRequest {
  id: number;
  distributorName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedCommission?: number;
  requestedCreditLine?: number;
  createdAt?: Date;
  [key: string]: any;
}

interface ProviderRequestsTableProps {
  requests: ProviderRequest[];
  isLoading?: boolean;
  error?: string | null;
  onApprove?: (requestId: number) => void;
  onReject?: (requestId: number) => void;
}
```

**File to Replace:** `client/src/components/provider/ProviderRequestsTable.tsx`

---

### ProviderDistributorsTable
```typescript
interface ProviderDistributor {
  id: number;
  name: string;
  status: 'active' | 'suspended';
  commissionRate?: number;
  creditLine?: number;
  connectedAt?: Date;
  [key: string]: any;
}

interface ProviderDistributorsTableProps {
  distributors: ProviderDistributor[];
  isLoading?: boolean;
  error?: string | null;
  onSuspend?: (distributorId: number) => void;
  onReactivate?: (distributorId: number) => void;
}
```

**File to Replace:** `client/src/components/provider/ProviderDistributorsTable.tsx`

---

## DISTRIBUTOR SECTION

### DistributorDashboardView
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

**File to Replace:** `client/src/components/distributor/DistributorDashboardView.tsx`

---

### ConnectProviderForm
```typescript
interface Provider {
  id: number;
  name: string;
  providerCode: string;
  status: string;
}

interface ConnectProviderFormProps {
  onSearch: (providerCode: string) => Promise<Provider | null | undefined>;
  onConnect: (providerCode: string, commission: number, creditLine: number) => Promise<void>;
  isSearching?: boolean;
  isConnecting?: boolean;
  error?: string | null;
}
```

**File to Replace:** `client/src/components/distributor/ConnectProviderForm.tsx`

---

### ConnectedProvidersTable
```typescript
interface ConnectedProvider {
  id: number;
  name: string;
  status: 'active' | 'suspended' | 'pending';
  commissionRate?: number;
  creditLine?: number;
  availableCredit?: number;
  connectedAt?: Date;
}

interface ConnectedProvidersTableProps {
  providers: ConnectedProvider[];
  isLoading?: boolean;
  error?: string | null;
  onDisconnect?: (providerId: number) => void;
}
```

**File to Replace:** `client/src/components/distributor/ConnectedProvidersTable.tsx`

---

### ProductCatalogView
```typescript
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

interface ProductCatalogViewProps {
  products: CatalogProduct[];
  isLoading?: boolean;
  error?: string | null;
  onPurchase?: (productId: number) => void;
  onFilterChange?: (filter: { searchTerm?: string; providerId?: number }) => void;
}
```

**File to Replace:** `client/src/components/distributor/ProductCatalogView.tsx`

---

### TransactionsTable
```typescript
interface Transaction {
  id: string;
  date: string | Date;
  provider: string;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  type: 'debit' | 'credit';
  description?: string;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  error?: string | null;
  totalCount?: number;
  onLoadMore?: () => void;
}
```

**File to Replace:** `client/src/components/distributor/TransactionsTable.tsx`

---

### WalletSummary
```typescript
interface WalletData {
  balance: number;
  currency: string;
  totalSpent: number;
  totalEarned: number;
  lastUpdated?: Date;
}

interface WalletSummaryProps {
  wallet: WalletData;
  isLoading?: boolean;
  error?: string | null;
  lowBalanceThreshold?: number;
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onRefresh?: () => void;
}
```

**File to Replace:** `client/src/components/distributor/WalletSummary.tsx`

---

### ApiCredentialsView
```typescript
interface ApiCredentials {
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  isActive: boolean;
  createdAt?: Date;
  lastRotated?: Date;
}

interface ApiCredentialsViewProps {
  credentials: ApiCredentials | null;
  isLoading?: boolean;
  error?: string | null;
  onGenerateKey?: () => Promise<void>;
  onRotateKey?: () => Promise<void>;
  onUpdateWebhook?: (url: string) => Promise<void>;
}
```

**File to Replace:** `client/src/components/distributor/ApiCredentialsView.tsx`

---

### NotificationsPanel
```typescript
interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
  relatedEntityId?: number;
  relatedEntityType?: string;
}

interface NotificationsPanelProps {
  notifications: Notification[];
  isLoading?: boolean;
  error?: string | null;
  unreadCount?: number;
  onMarkAsRead?: (notificationId: string) => Promise<void>;
  onMarkAllAsRead?: () => Promise<void>;
}
```

**File to Replace:** `client/src/components/distributor/NotificationsPanel.tsx`

---

## ENUM REFERENCE

### Status Values
```typescript
// Organization/User status
type Status = 'active' | 'inactive' | 'suspended';

// Product status
type ProductStatus = 'active' | 'inactive';

// Provider/Distributor status
type ProviderStatus = 'active' | 'suspended' | 'pending';

// Transaction status
type TransactionStatus = 'completed' | 'pending' | 'failed';

// Transaction type
type TransactionType = 'debit' | 'credit';

// User role
type UserRole = 'admin' | 'user';

// Request status
type RequestStatus = 'pending' | 'approved' | 'rejected';

// Upload status
type UploadStatus = 'completed' | 'processing' | 'failed';

// Notification type
type NotificationType = 'success' | 'warning' | 'error' | 'info';
```

---

## COMMON PATTERNS

### Loading State
```typescript
if (isLoading) {
  return <LoadingSkeleton />;
}
```

### Error State
```typescript
if (error) {
  return <ErrorMessage error={error} />;
}
```

### Empty State
```typescript
if (items.length === 0) {
  return <EmptyState message="No items found" />;
}
```

### Optional Callbacks
```typescript
// Callback is optional - check before calling
if (onEdit) {
  <button onClick={() => onEdit(item)}>Edit</button>
}
```

---

## VALIDATION RULES

### Before Stitch Component Creation
- [ ] All prop names match exactly
- [ ] All prop types match exactly
- [ ] All callbacks have correct signatures
- [ ] All enums match values
- [ ] All optional fields marked with `?`
- [ ] All Date objects are Date type (not string)

### Before Integration
- [ ] Component accepts all required props
- [ ] Component exports correct interface
- [ ] No prop renaming
- [ ] No type changes
- [ ] No callback signature changes

---

**Use this document as the definitive contract for Stitch component creation.**

All components must implement these interfaces exactly.
