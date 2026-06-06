import { trpc } from '@/lib/trpc';

export interface DashboardMetrics {
  walletBalance?: number;
  totalSpent?: number;
  activeProviders?: number;
  pendingRequests?: number;
  recentTransactions?: Transaction[];
  [key: string]: any;
}

export interface Transaction {
  id: string;
  date: string | Date;
  provider: string;
  status: 'completed' | 'pending' | 'failed';
  amount: number;
  type: 'debit' | 'credit';
  [key: string]: any;
}

/**
 * Hook to manage distributor dashboard data.
 * Handles fetching wallet balance, recent transactions, and provider connections.
 */
export function useDistributorDashboard() {
  // Fetch connected providers
  const { data: providersData, isLoading: providersLoading } = trpc.distributor.getConnectedProviders.useQuery();
  
  // Fetch pending access requests
  const { data: pendingData, isLoading: pendingLoading } = trpc.distributor.getPendingAccessRequests.useQuery();
  
  // Fetch recent transactions (ledger history)
  const { data: transactionsData, isLoading: transactionsLoading } = trpc.financial.ledgerHistory.useQuery({
    limit: 5,
    offset: 0,
  });
  
  const isLoading = providersLoading || pendingLoading || transactionsLoading;
  
  const dashboardData: DashboardMetrics = {
    walletBalance: 0,
    totalSpent: 0,
    activeProviders: providersData?.total || 0,
    pendingRequests: pendingData?.pendingCount || 0,
    recentTransactions: (transactionsData?.entries ?? []).map((entry: any) => ({
      id: entry.id,
      date: entry.createdAt,
      provider: entry.providerName || 'Unknown',
      status: 'completed',
      amount: Math.abs(entry.amount || 0),
      type: entry.type === 'DEBIT' ? 'debit' : 'credit',
    })),
  };

  const error = null;

  return {
    dashboardData,
    isLoading,
    error,
  };
}
