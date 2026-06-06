import { useProviderRequests } from '@/hooks/data/useProviderRequests';
import { ProviderRequestsTable } from '@/components/provider/ProviderRequestsTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { RefreshCw, Link2 } from 'lucide-react';

export const RequestsPage: React.FC = () => {
  const {
    requests,
    isLoading,
    isApproving,
    isRejecting,
    approveError,
    rejectError,
    handleApprove,
    handleReject,
    refetch,
  } = useProviderRequests();

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="طلبات الربط"
        subtitle="مراجعة وإدارة طلبات الوصول من الموزعين"
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
      {approveError && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">
            فشل قبول الطلب. يرجى المحاولة مجدداً.
          </p>
        </div>
      )}
      {rejectError && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">
            فشل رفض الطلب. يرجى المحاولة مجدداً.
          </p>
        </div>
      )}

      {/* ── Requests table ──────────────────────────────────────────────── */}
      {!isLoading && requests?.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg">
          <EmptyState
            icon={<Link2 size={28} />}
            iconVariant="primary"
            title="لا توجد طلبات معلقة"
            description="لا يوجد أي طلب ربط في انتظار المراجعة حالياً."
          />
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <ProviderRequestsTable
            requests={requests}
            isLoading={isLoading}
            onApprove={(requestId) => handleApprove({ requestId })}
            onReject={(requestId) => handleReject({ requestId, rejectionReason: '' })}
          />
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
