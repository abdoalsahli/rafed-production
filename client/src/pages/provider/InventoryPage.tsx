import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, Wand2 } from 'lucide-react';
import { useInventory } from '@/hooks/data/useInventory';
import { InventoryTable } from '@/components/provider/InventoryTable';
import { GeneratePinsModal } from '@/components/provider/GeneratePinsModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { trpc } from '@/lib/trpc';

export const InventoryPage: React.FC = () => {
  const { inventory, isLoading, isRefreshing, error, handleRefresh, refetch } = useInventory();
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const { data: productsData } = trpc.provider.listProducts.useQuery({});
  const products = (productsData?.products ?? []).map((p: any) => ({ id: p.id, name: p.name }));

  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="إدارة المخزون"
        subtitle="استعرض المنتجات والبطاقات المتاحة"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowGenerateModal(true)}
              className="gap-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white"
            >
              <Wand2 size={15} />
              توليد بطاقات
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              variant="outline"
              className="gap-1.5"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              تحديث
            </Button>
          </div>
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

      {/* ── Generate Pins Modal ─────────────────────────────────────────── */}
      {showGenerateModal && (
        <GeneratePinsModal
          products={products}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => { refetch(); }}
        />
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
