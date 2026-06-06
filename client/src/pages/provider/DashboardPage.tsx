import { useProviderDashboard } from '@/hooks/data/useProviderDashboard';
import { ProviderDashboardView } from '@/components/provider/ProviderDashboardView';

export const ProviderDashboardPage: React.FC = () => {
  const {
    dashboardData,
    inventoryAlerts,
    pendingRequests,
    providerCode,
    isLoading,
  } = useProviderDashboard();

  return (
    <div className="p-6 md:p-8">
      <ProviderDashboardView
        metrics={dashboardData}
        inventoryAlerts={inventoryAlerts as any}
        pendingRequests={pendingRequests as any}
        providerCode={providerCode}
        isLoading={isLoading}
      />
    </div>
  );
};
