import { trpc } from '@/lib/trpc';

export interface CatalogProduct {
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
  [key: string]: any;
}

export interface CatalogFilter {
  providerId?: number;
  status?: 'active' | 'inactive';
  priceRange?: { min: number; max: number };
  searchTerm?: string;
}

/**
 * Hook to manage distributor product catalog.
 * Handles fetching products from connected providers.
 */
export function useDistributorCatalog(filter?: CatalogFilter) {
  // Placeholder: In full implementation, would fetch from backend
  const products: CatalogProduct[] = [];
  const isLoading = false;
  const error = null;

  const handleFilterChange = (newFilter: CatalogFilter) => {
    // Placeholder for filter logic
    console.log('Filter changed:', newFilter);
  };

  return {
    products,
    isLoading,
    error,
    handleFilterChange,
  };
}
