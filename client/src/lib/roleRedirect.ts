/**
 * Utility to get the default dashboard path for a given user role.
 * Used for post-login redirects to route users to their appropriate dashboard.
 */
export function getRoleDashboardPath(role: string | null | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin/organizations';
    case 'provider':
      return '/provider/dashboard';
    case 'distributor':
      return '/distributor/dashboard';
    default:
      return '/admin/organizations'; // Fallback to admin dashboard
  }
}

/**
 * Determine the redirect path after successful login based on user status and role.
 * Handles pending activation, suspended status, and role-based dashboard routing.
 */
export function getPostLoginRedirectPath(user: any): string {
  // Check if user has a status field
  if (user?.status) {
    const status = user.status.toLowerCase();
    if (status === 'pending') {
      return '/pending-activation';
    }
    if (status === 'suspended') {
      return '/suspended';
    }
  }

  // Route to role-specific dashboard
  // First check organizationType (from organization link), then fall back to role
  const roleToUse = user?.organizationType || user?.role;
  return getRoleDashboardPath(roleToUse);
}
