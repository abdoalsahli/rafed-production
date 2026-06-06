import { useProviderDistributors } from '@/hooks/data/useProviderDistributors';
import { ProviderDistributorsTable } from '@/components/provider/ProviderDistributorsTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users2 } from 'lucide-react';

export const DistributorsPage: React.FC = () => {
  const {
    distributors,
    isLoading,
    isSuspending,
    isReactivating,
    suspendError,
    reactivateError,
    handleSuspend,
    handleReactivate,
    refetch,
  } = useProviderDistributors();

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="علاقات الموزعين"
        subtitle="إدارة شراكاتك مع الموزعين النشطين"
        actions={
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            variant="outline"
            className="gap-1.5"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            تحديث
          </Button>
        }
      />

      {/* ── Error banners ────────────────────────────────────────────────── */}
      {suspendError && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">
            فشل إيقاف الموزع. يرجى المحاولة مجدداً.
          </p>
        </div>
      )}
      {reactivateError && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">
            فشل إعادة تفعيل الموزع. يرجى المحاولة مجدداً.
          </p>
        </div>
      )}

      {/* ── Distributors table ──────────────────────────────────────────── */}
      {!isLoading && distributors?.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg">
          <EmptyState
            icon={<Users2 size={28} />}
            iconVariant="primary"
            title="لا يوجد موزعون مرتبطون"
            description="لم يرتبط أي موزع بحسابك بعد."
          />
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <ProviderDistributorsTable
            distributors={distributors}
            isLoading={isLoading}
            onSuspend={handleSuspend}
            onReactivate={handleReactivate}
            onTopUpSuccess={refetch}
          />
        </div>
      )}
    </div>
  );
};

export default DistributorsPage;
