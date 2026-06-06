import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/**
 * DashboardRedirect Component
 * 
 * Redirects users from /dashboard to their role-specific dashboard:
 * - Provider users → /provider/dashboard
 * - Distributor users → /distributor/dashboard
 * - Admin users → /admin/organizations (admin dashboard)
 * - Unauthenticated users → /login
 */
export default function DashboardRedirect() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      // Still loading auth state
      return;
    }

    if (!isAuthenticated || !user) {
      // Not authenticated, redirect to login
      setLocation('/login');
      return;
    }

    // Route based on user role and organization type
    const userRole = user.role?.toLowerCase();
    
    if (userRole === 'admin') {
      setLocation('/admin/organizations');
    } else if (userRole === 'user') {
      // For regular users, check their organization type
      const orgType = (user as any)?.organizationType?.toLowerCase();
      
      if (orgType === 'provider') {
        setLocation('/provider/dashboard');
      } else if (orgType === 'distributor') {
        setLocation('/distributor/dashboard');
      } else {
        // Default to distributor dashboard if org type is unknown
        setLocation('/distributor/dashboard');
      }
    } else {
      // Unknown role, redirect to home
      setLocation('/');
    }
  }, [user, isAuthenticated, loading, setLocation]);

  // Show loading state while determining redirect
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-10 text-center">
        <Loader2 size={28} className="animate-spin mx-auto mb-4 text-[#00236f]" />
        <p className="text-sm text-[#444651]">جاري التوجيه إلى لوحة التحكم…</p>
      </div>
    </div>
  );
}
