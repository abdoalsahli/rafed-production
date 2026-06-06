import { trpc } from '@/lib/trpc';

export interface Organization {
  id: number;
  name: string;
  type: 'provider' | 'distributor' | 'internal';
  status: 'active' | 'suspended';
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateOrganizationInput {
  name: string;
  type: 'provider' | 'distributor' | 'internal';
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateOrganizationInput {
  id: number;
  name?: string;
  status?: 'active' | 'suspended';
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * Hook to manage organization data and mutations.
 * Handles listing, creating, and updating organizations.
 */
export function useOrganizations() {
  const { data: organizations, isLoading, refetch } = trpc.organizations.listOrganizations.useQuery();
  
  const createMutation = trpc.organizations.createOrganization.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateMutation = trpc.organizations.updateOrganization.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreate = async (input: CreateOrganizationInput) => {
    return createMutation.mutateAsync(input);
  };

  const handleUpdate = async (input: UpdateOrganizationInput) => {
    return updateMutation.mutateAsync(input);
  };

  return {
    organizations: organizations || [],
    isLoading,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    createError: createMutation.error,
    updateError: updateMutation.error,
    handleCreate,
    handleUpdate,
    refetch,
  };
}
