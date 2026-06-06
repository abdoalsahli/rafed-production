import { trpc } from '@/lib/trpc';

export interface ProviderRequest {
  requestId?: number;
  id?: number;
  distributorId: number;
  distributorName: string;
  requestType?: string;
  status: string;
  requestedCommission?: number;
  requestedCreditLine?: number;
  details?: any;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface ApproveRequestInput {
  requestId: number;
  details?: any;
}

export interface RejectRequestInput {
  requestId: number;
  rejectionReason: string;
}

/**
 * Hook to manage provider requests (distributor requests, etc).
 * Handles fetching, approving, and rejecting requests.
 */
export function useProviderRequests() {
  const { data: requestsData, isLoading, refetch } = trpc.provider.pendingRequests.useQuery();

  const approveMutation = trpc.provider.approveRequest.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const rejectMutation = trpc.provider.rejectRequest.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const requests: ProviderRequest[] = requestsData || [];

  const handleApprove = async (input: ApproveRequestInput) => {
    return approveMutation.mutateAsync(input);
  };

  const handleReject = async (input: RejectRequestInput) => {
    return rejectMutation.mutateAsync({
      requestId: input.requestId,
      rejectionReason: input.rejectionReason,
    });
  };

  const filterByStatus = (status: string) => {
    return requests.filter((req: ProviderRequest) => req.status === status);
  };

  return {
    requests,
    isLoading,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    approveError: approveMutation.error,
    rejectError: rejectMutation.error,
    handleApprove,
    handleReject,
    filterByStatus,
    refetch,
  };
}
