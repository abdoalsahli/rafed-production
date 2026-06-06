import { trpc } from '@/lib/trpc';

export interface ProviderDistributor {
  relationshipId?: number;
  id?: number;
  distributorId: number;
  distributorName: string;
  name?: string;
  email?: string;
  status: string;
  commissionPercentage: number;
  creditLine: number;
  balance?: number;
  usedCredit?: number;
  availableToSpend?: number;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface UpdateDistributorInput {
  distributorId: number;
  commissionRate?: number;
  creditLine?: number;
}

/**
 * Hook to manage provider's distributor relationships.
 * Handles listing, updating, and managing distributor accounts.
 */
export function useProviderDistributors() {
  const { data: distributorsData, isLoading, refetch } = 
    trpc.provider.activeDistributors.useQuery();

  const suspendMutation = trpc.provider.suspendDistributor.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const reactivateMutation = trpc.provider.reactivateDistributor.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const topUpMutation = trpc.provider.topUpDistributorBalance.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const distributors: ProviderDistributor[] = distributorsData || [];

  const handleSuspend = async (relationshipId: number, reason?: string) => {
    return suspendMutation.mutateAsync({ relationshipId, reason: reason || '' });
  };

  const handleReactivate = async (relationshipId: number) => {
    return reactivateMutation.mutateAsync({ relationshipId });
  };

  const filterByStatus = (status: string) => {
    return distributors.filter((d: ProviderDistributor) => d.status === status);
  };

  return {
    distributors,
    isLoading,
    isSuspending: suspendMutation.isPending,
    isReactivating: reactivateMutation.isPending,
    suspendError: suspendMutation.error,
    reactivateError: reactivateMutation.error,
    handleSuspend,
    handleReactivate,
    filterByStatus,
    refetch,
    // top-up
    topUpMutation,
  };
}
