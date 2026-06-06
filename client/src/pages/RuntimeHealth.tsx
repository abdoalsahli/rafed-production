/**
 * Runtime Health Page
 * Admin-only page for viewing runtime health dashboard
 */

import { RuntimeHealthDashboard } from '@/components/RuntimeHealthDashboard';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

export default function RuntimeHealthPage() {
  const [, navigate] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();

  // Only admins can access this page
  if (!user || user.role !== 'admin') {
    navigate('/');
    return null;
  }

  return (
    <div className="p-6 md:p-8">
      <RuntimeHealthDashboard />
    </div>
  );
}
