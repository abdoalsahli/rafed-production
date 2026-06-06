import React, { useRef, useEffect } from 'react';
import { useAlert } from '@/hooks/useAlert';
import { useDistributorDashboard } from '@/hooks/data/useDistributorDashboard';
import { DistributorDashboardView } from '@/components/distributor/DistributorDashboardView';

export const DashboardPage: React.FC = () => {
  const { warning }       = useAlert();
  const hasShownAlert     = useRef(false);
  const { dashboardData, isLoading } = useDistributorDashboard();

  useEffect(() => {
    if (!hasShownAlert.current && dashboardData.activeProviders !== undefined) {
      if (dashboardData.activeProviders === 0) {
        hasShownAlert.current = true;
        warning('لا يوجد مزودون', 'قم بالاتصال بمزودين لبدء شراء البطاقات المدفوعة مسبقاً.');
      }
    }
  }, [dashboardData.activeProviders, warning]);

  return (
    <div className="p-6 md:p-8">
      <DistributorDashboardView
        activeProviders={dashboardData.activeProviders || 0}
        pendingRequests={dashboardData.pendingRequests || 0}
        isLoading={isLoading}
      />
    </div>
  );
};

export default DashboardPage;
