import { trpc } from '@/lib/trpc';

export interface OrganizationUser {
  id: number;
  userId: number;
  organizationId: number;
  role: 'admin' | 'operator' | 'viewer';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  id: number;
  email: string | null;
  name?: string | null;
  status: 'pending' | 'active' | 'suspended';
  organizations?: OrganizationUser[];
}

export interface ActivateUserInput {
  userId: number;
  organizationId: number;
}

export interface SuspendUserInput {
  userId: number;
  reason: string;
}

export interface AssignUserRoleInput {
  userId: number;
  organizationId: number;
  role: 'admin' | 'operator' | 'viewer';
}

/**
 * Hook to manage user data and mutations.
 * Handles listing, activating, suspending, and assigning roles to users.
 */
export function useUsers() {
  const { data: users, isLoading, refetch } = trpc.organizations.listUsers.useQuery();

  const activateMutation = trpc.organizations.activateUser.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const suspendMutation = trpc.organizations.suspendUser.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const assignRoleMutation = trpc.organizations.assignUserRole.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleActivate = async (input: ActivateUserInput) => {
    return activateMutation.mutateAsync(input);
  };

  const handleSuspend = async (input: SuspendUserInput) => {
    return suspendMutation.mutateAsync(input);
  };

  const handleAssignRole = async (input: AssignUserRoleInput) => {
    return assignRoleMutation.mutateAsync(input);
  };

  const filterByStatus = (status: 'pending' | 'active' | 'suspended') => {
    return (users || []).filter((user: User) => user.status === status);
  };

  return {
    users: users || [],
    isLoading,
    isActivating: activateMutation.isPending,
    isSuspending: suspendMutation.isPending,
    isAssigningRole: assignRoleMutation.isPending,
    activateError: activateMutation.error,
    suspendError: suspendMutation.error,
    assignRoleError: assignRoleMutation.error,
    handleActivate,
    handleSuspend,
    handleAssignRole,
    filterByStatus,
    refetch,
  };
}
