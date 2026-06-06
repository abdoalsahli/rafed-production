import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export interface InventoryItem {
  id: number;
  name: string;
  description?: string | null;
  price: number | string;
  status?: 'active' | 'inactive';
  availableCards: number;
  soldCards: number;
  totalCards?: number;
  lowStock?: boolean;
  createdAt?: Date;
  [key: string]: any;
}

/**
 * Hook to manage provider inventory.
 * Handles fetching and refreshing inventory data.
 */
export function useInventory() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: inventoryData, isLoading, error, refetch } = trpc.provider.getInventory.useQuery(
    undefined,
    {
      refetchInterval: 30000, // Auto-refresh every 30 seconds
    }
  );

  const inventory: InventoryItem[] = inventoryData?.inventory || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    inventory,
    isLoading,
    isRefreshing,
    error,
    handleRefresh,
    refetch,
  };
}
