import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export interface Product {
  id: number;
  name: string;
  displayName: string | null;
  faceValue: string | null;
  currency: string | null;
  description?: string | null;
  status: 'active' | 'inactive';
  price?: string;
  isActive?: number;
  providerId?: number;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface CreateProductInput {
  name: string;
  price: number;
  displayName?: string;
  faceValue?: number;
  currency?: string;
  description?: string;
}

export interface UpdateProductInput {
  productId: number;
  name?: string;
  displayName?: string;
  faceValue?: number;
  currency?: string;
  price?: number;
  description?: string;
}

export interface UpdateProductStatusInput {
  id: number;
  status: 'active' | 'inactive';
}

/**
 * Hook to manage provider products.
 * Handles listing, creating, updating, and status changes.
 */
export function useProducts(statusFilter?: 'all' | 'active' | 'inactive') {
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  const { data: productsData, isLoading, refetch } = trpc.provider.listProducts.useQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
    }
  );

  const createMutation = trpc.provider.createProduct.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateMutation = trpc.provider.updateProduct.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const setStatusMutation = trpc.provider.setProductStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const deleteMutation = trpc.provider.deleteProduct.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const importMutation = trpc.provider.importProducts.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const products = productsData?.products || [];

  // Filter products client-side
  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch =
      searchTerm === '' ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesCurrency = currencyFilter === 'all' || product.currency === currencyFilter;

    return matchesSearch && matchesCurrency;
  });

  const handleCreate = async (input: CreateProductInput) => {
    return createMutation.mutateAsync(input);
  };

  const handleUpdate = async (input: UpdateProductInput) => {
    return updateMutation.mutateAsync(input);
  };

  const handleStatusChange = async (productId: number, isActive: boolean) => {
    return setStatusMutation.mutateAsync({ productId, isActive });
  };

  const handleDelete = async (productId: number) => {
    return deleteMutation.mutateAsync({ productId });
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return importMutation.mutateAsync(formData as any);
  };



  const getCurrencies = () => {
    const currencies = new Set(products.map((p: Product) => p.currency));
    return Array.from(currencies);
  };

  return {
    products: filteredProducts,
    allProducts: products,
    isLoading,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isSettingStatus: setStatusMutation.isPending,
    createError: createMutation.error,
    updateError: updateMutation.error,
    statusError: setStatusMutation.error,
    importError: importMutation.error,
    searchTerm,
    setSearchTerm,
    currencyFilter,
    setCurrencyFilter,
    currencies: getCurrencies(),
    handleCreate,
    handleUpdate,
    handleStatusChange,
    handleDelete,
    handleImport,
    isDeleting: deleteMutation.isPending,
    refetch,
  };
}
