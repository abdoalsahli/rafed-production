import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export interface Provider {
  id: number;
  name: string;
  providerCode: string;
  status: string;
  createdAt?: Date;
  [key: string]: any;
}

export interface ConnectionRequest {
  providerCode: string;
  requestedCommission: number;
  requestedCreditLine: number;
}

/**
 * Hook to manage provider connection flow.
 * Handles finding providers by code and requesting connections.
 */
export function useConnectionFlow() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const utils = trpc.useUtils();

  const requestConnectionMutation = trpc.distributor.requestConnection.useMutation({
    onSuccess: () => {
      setConnectionError(null);
      setSelectedProvider(null);
    },
    onError: (error) => {
      setConnectionError(error.message);
    },
  });

  const handleFindProvider = async (providerCode: string) => {
    if (!providerCode || providerCode.trim() === '') {
      setConnectionError('Please enter a provider code');
      return null;
    }
    setIsSearching(true);
    setConnectionError(null);
    try {
      const provider = await utils.distributor.findProviderByCode.fetch({
        providerCode: providerCode.toUpperCase(),
      });
      setSelectedProvider(provider);
      return provider;
    } catch (err: any) {
      setConnectionError(err.message || 'Failed to find provider');
      return null;
    } finally {
      setIsSearching(false);
    }
  };

  const handleRequestConnection = async (input: ConnectionRequest) => {
    return requestConnectionMutation.mutateAsync(input);
  };

  return {
    selectedProvider,
    connectionError,
    isSearching,
    isRequesting: requestConnectionMutation.isPending,
    handleFindProvider,
    handleRequestConnection,
    clearError: () => setConnectionError(null),
    clearProvider: () => setSelectedProvider(null),
  };
}
