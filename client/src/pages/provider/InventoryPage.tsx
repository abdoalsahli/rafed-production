import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useInventory } from '@/hooks/data/useInventory';
import { InventoryTable } from '@/components/provider/InventoryTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export const InventoryPage: React.FC = () => {
  const { inventory, isLoading, isRefreshing, error, handleRefresh } = useInventory();

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="إدارة المخزون"
        subtitle="استعرض المنتجات والبطاقات المتاحة"
        actions={
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            variant="outline"
            className="gap-1.5"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            تحديث
          </Button>
        }
      />

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
          <p className="text-sm font-medium text-[#b91c1c]">
            فشل تحميل المخزون. يرجى المحاولة مجدداً.
          </p>
        </div>
      )}

      {/* ── Inventory table ─────────────────────────────────────────────── */}
      {!isLoading && !error && inventory?.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg">
          <EmptyState
            icon={<BarChart3 size={28} />}
            iconVariant="teal"
            title="لا يوجد مخزون"
            description="لم يتم رفع أي بطاقات بعد. ابدأ برفع بطاقاتك الأولى."
          />
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <InventoryTable inventory={inventory} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
};
