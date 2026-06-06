import React from 'react';
import { useConnectionFlow } from '@/hooks/data/useConnectionFlow';
import { ConnectProviderForm } from '@/components/distributor/ConnectProviderForm';
import { PageHeader } from '@/components/ui/PageHeader';

export const ConnectProviderPage: React.FC = () => {
  const {
    selectedProvider,
    connectionError,
    isSearching,
    isRequesting,
    handleFindProvider,
    handleRequestConnection,
    clearError,
    clearProvider,
  } = useConnectionFlow();

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="ربط مزود جديد"
        subtitle="أدخل رمز المزود للبحث وإرسال طلب الربط"
      />

      <div className="max-w-2xl">
        <ConnectProviderForm
          onSearch={handleFindProvider}
          onConnect={async (providerCode, commission, creditLine) => {
            await handleRequestConnection({
              providerCode,
              requestedCommission: commission,
              requestedCreditLine:  creditLine,
            });
          }}
          isSearching={isSearching}
          isConnecting={isRequesting}
          error={connectionError}
        />
      </div>
    </div>
  );
};

export default ConnectProviderPage;
