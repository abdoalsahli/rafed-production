import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import PendingActivationPage from '@/pages/PendingActivationPage';
import SuspendedPage from '@/pages/SuspendedPage';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredRoles?: string[];
};

export function ProtectedRoute({ children, requiredRoles = [] }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    // Not authenticated - redirect to login
    if (!user) {
      setLocation('/login');
      return;
    }

    // User is pending activation
    if ((user as any).status === 'PENDING') {
      setLocation('/pending-activation');
      return;
    }

    // User is suspended
    if ((user as any).status === 'SUSPENDED') {
      setLocation('/suspended');
      return;
    }

    // Check role-based access
    if (requiredRoles.length > 0) {
      const rawRole    = (user as any).role || 'user';
      const orgType    = (user as any).organizationType;
      // internal org users are platform admins
      const effectiveRole = rawRole === 'admin' || orgType === 'internal'
        ? 'admin'
        : (orgType || rawRole);
      if (!requiredRoles.includes(effectiveRole)) {
        setLocation('/unauthorized');
        return;
      }
    }
  }, [user, loading, requiredRoles, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00236f] mx-auto mb-3"></div>
          <p className="text-sm text-[#444651]">جاري التحميل…</p>
        </div>
      </div>
    );
  }

  // Handle redirect states
  if (!user) return null;
  if ((user as any).status === 'PENDING') return <PendingActivationPage />;
  if ((user as any).status === 'SUSPENDED') return <SuspendedPage />;

  const rawRole    = (user as any).role || 'user';
  const orgType    = (user as any).organizationType;
  const effectiveRole = rawRole === 'admin' || orgType === 'internal'
    ? 'admin'
    : (orgType || rawRole);
  if (requiredRoles.length > 0 && !requiredRoles.includes(effectiveRole)) {
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
}
