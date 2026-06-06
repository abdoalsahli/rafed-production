import { trpc } from '@/lib/trpc';
import { useCallback } from 'react';

export interface ConnectedProvider {
  id: number;
  relationshipId: number;
  name: string;
  code?: string;
  status: 'active' | 'suspended' | 'pending';
  commissionType?: string;
  commissionValue?: number;
  connectedAt?: Date;
  availableCredit?: number;
  usedCredit?: number;
  [key: string]: any;
}

/**
 * Hook to manage connected providers for a distributor.
 * Handles fetching and managing provider relationships.
 */
export function useConnectedProviders() {
  // Fetch connected providers from backend
  const { data, isLoading, error, refetch } = trpc.distributor.getConnectedProviders.useQuery();
  const providers: ConnectedProvider[] = data?.providers || [];

  const handleDisconnect = useCallback(async (providerId: number) => {
    // TODO: Implement disconnect logic
    console.log('Disconnect provider:', providerId);
    // After disconnect, refetch the list
    await refetch();
  }, [refetch]);

  return {
    providers,
    isLoading,
    error: error?.message || null,
    handleDisconnect,
  };
}
