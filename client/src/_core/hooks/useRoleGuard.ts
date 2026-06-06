import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'provider' | 'distributor' | 'operator';

export function useRoleGuard(allowedRoles?: UserRole[]) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    // Check if user is authenticated
    if (!user) {
      setLocation('/login');
      return;
    }

    // Check if user is activated
    if ((user as any).status === 'pending') {
      setLocation('/pending-activation');
      return;
    }

    if ((user as any).status === 'suspended') {
      setLocation('/suspended');
      return;
    }

    // Check role-based access
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = (user as any).role;
      if (!allowedRoles.includes(userRole)) {
        setLocation('/unauthorized');
      }
    }
  }, [user, loading, allowedRoles, setLocation]);

  return { user, loading };
}
