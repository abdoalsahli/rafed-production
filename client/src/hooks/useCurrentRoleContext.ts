import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';

/**
 * Hook to get current user role and auth state.
 * Derives role from URL path to support role-based navigation.
 */
export function useCurrentRoleContext() {
  const { user, loading, isAuthenticated } = useAuth();
  const [location] = useLocation();
  
  const userEmail = user ? (user as any).email : null;
  
  // Derive role from URL path
  let userRole: string | null = null;
  if (location.startsWith('/admin')) {
    userRole = 'admin';
  } else if (location.startsWith('/provider')) {
    userRole = 'provider';
  } else if (location.startsWith('/distributor')) {
    userRole = 'distributor';
  } else if (location.startsWith('/dashboard')) {
    // Default dashboard - use backend role
    userRole = user ? (user as any).role : null;
  } else {
    // For other paths, use backend role
    userRole = user ? (user as any).role : null;
  }

  return {
    userRole,
    userEmail,
    user,
    loading,
    isAuthenticated,
  };
}
