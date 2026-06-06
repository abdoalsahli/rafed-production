import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

export interface DashboardMetrics {
  totalProducts: number;
  totalDistributors: number;
  totalSales: number;
  pendingRequests: number;
  lowInventoryCount: number;
  [key: string]: any;
}

export interface InventoryAlert {
  productId: number;
  productName: string;
  currentStock?: number;
  availableCards?: number;
  threshold?: number;
  lowStockThreshold?: number;
  status?: string;
  [key: string]: any;
}

export interface PendingRequest {
  id?: number;
  requestId?: number;
  distributorId: number;
  distributorName: string;
  requestType?: string;
  status: string;
  requestedCommission?: number;
  requestedCreditLine?: number;
  createdAt: Date;
  [key: string]: any;
}

export interface ProviderCode {
  providerCode: string;
  [key: string]: any;
}

/**
 * Hook to fetch provider dashboard data.
 * Handles metrics, alerts, requests, and provider code.
 */
export function useProviderDashboard() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Fetch dashboard metrics
  const { data: dashboardData, isLoading: isLoadingDashboard, error: dashboardError } = 
    trpc.provider.dashboard.useQuery(
      undefined,
      { enabled: isAuthenticated && !authLoading }
    );

  // Fetch low inventory alerts
  const { data: inventoryAlerts, isLoading: isLoadingInventory } = 
    trpc.provider.lowInventoryAlerts.useQuery(
      undefined,
      { enabled: isAuthenticated && !authLoading }
    );

  // Fetch pending requests
  const { data: pendingRequests, isLoading: isLoadingRequests } = 
    trpc.provider.pendingRequests.useQuery(
      undefined,
      { enabled: isAuthenticated && !authLoading }
    );

  // Fetch provider code
  const { data: providerCodeData, isLoading: isLoadingCode } = 
    trpc.provider.getProviderCode.useQuery(
      undefined,
      { enabled: isAuthenticated && !authLoading }
    );

  const isLoading = authLoading || isLoadingDashboard || isLoadingInventory || isLoadingRequests || isLoadingCode;

  return {
    dashboardData: dashboardData || {},
    inventoryAlerts: inventoryAlerts || [],
    pendingRequests: pendingRequests || [],
    providerCode: providerCodeData?.providerCode || 'XXXX-XXXX',
    isLoading,
    isLoadingDashboard,
    isLoadingInventory,
    isLoadingRequests,
    isLoadingCode,
    dashboardError,
  };
}
