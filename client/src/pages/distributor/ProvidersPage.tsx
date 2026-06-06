import React from 'react';
import { useConnectedProviders } from '@/hooks/data/useConnectedProviders';
import { ConnectedProvidersTable } from '@/components/distributor/ConnectedProvidersTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Plus, Store } from 'lucide-react';
import { useLocation } from 'wouter';

export const ProvidersPage: React.FC = () => {
  const [, navigate]  = useLocation();
  const { providers, isLoading, error, handleDisconnect } = useConnectedProviders();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="المزودون المرتبطون"
        subtitle="إدارة علاقاتك النشطة مع المزودين"
        actions={
          <Button
            onClick={() => navigate('/distributor/connect-provider')}
            className="gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a]"
          >
            <Plus size={15} /> ربط مزود
          </Button>
        }
      />

      {error && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">
            فشل تحميل قائمة المزودين. يرجى المحاولة مجدداً.
          </p>
        </div>
      )}

      {!isLoading && !error && providers?.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg">
          <EmptyState
            icon={<Store size={28} />}
            iconVariant="primary"
            title="لا يوجد مزودون مرتبطون"
            description="ابدأ بربط مزود لتتمكن من شراء البطاقات."
            action={{ label: 'ربط مزود', onClick: () => navigate('/distributor/connect-provider') }}
          />
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <ConnectedProvidersTable
            providers={providers}
            isLoading={isLoading}
            error={error}
            onDisconnect={handleDisconnect}
          />
        </div>
      )}
    </div>
  );
};

export default ProvidersPage;
