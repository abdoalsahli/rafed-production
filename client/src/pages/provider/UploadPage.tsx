import { useState } from 'react';
import { UploadCardsForm } from '@/components/provider/UploadCardsForm';
import { UploadHistoryTable } from '@/components/provider/UploadHistoryTable';
import { trpc } from '@/lib/trpc';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Step definitions ────────────────────────────────────────────────────── */
const STEPS = [
  { n: 1, label: 'اختيار المنتج'  },
  { n: 2, label: 'رفع الملف'      },
  { n: 3, label: 'تأكيد البيانات' },
] as const;

export const UploadPage: React.FC = () => {
  const [selectedProductId,   setSelectedProductId]   = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [hasFile,             setHasFile]             = useState(false);

  const { data: products,       isLoading: isLoadingProducts } = trpc.provider.listProducts.useQuery({});
  const {
    data: uploadHistory,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = trpc.provider.uploadHistory.useQuery({});

  const handleProductSelect = (productId: number, productName: string) => {
    setSelectedProductId(productId);
    setSelectedProductName(productName);
    setHasFile(false); // reset file step when product changes
  };

  const activeStep = !selectedProductId ? 1 : !hasFile ? 2 : 3;

  return (
    <div className="p-6 md:p-8 space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="رفع مخزون البطاقات"
        subtitle="أضف كميات جديدة من بطاقات الدفع لمنتجاتك"
      />

      {/* ── Step indicator ───────────────────────────────────────────────── */}
      <div className="flex items-center max-w-sm">
        {STEPS.map((s, i) => {
          const done   = s.n < activeStep;
          const active = s.n === activeStep;
          return (
            <div key={s.n} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <div className="flex items-center gap-2 shrink-0">
                <div className={cn(
                  'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
                  done   && 'bg-[#16a34a] text-white',
                  active && 'bg-[#00236f] text-white ring-4 ring-[#00236f]/15',
                  !done && !active && 'bg-[#e2e8f0] text-[#94a3b8]',
                )}>
                  {done ? '✓' : s.n}
                </div>
                <span className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  done   && 'text-[#16a34a]',
                  active && 'text-[#0b1c30]',
                  !done && !active && 'text-[#94a3b8]',
                )}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px mx-3 transition-colors', done ? 'bg-[#16a34a]' : 'bg-[#e2e8f0]')} />
              )}
            </div>
          );
        })}
      </div>

      {/* ══ Single combined card ══════════════════════════════════════════ */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-stretch">

          {/* ── RIGHT panel (DOM first → rightmost in RTL flex): product ─── */}
          <div className="shrink-0 lg:w-[280px] px-5 py-4 space-y-3
                          border-b border-[#e2e8f0]
                          lg:border-b-0 lg:border-l lg:border-l-[#e2e8f0]">

            <div>
              <p className="text-sm font-bold text-[#0b1c30] leading-tight">تحديد المنتج</p>
              <p className="text-xs text-[#64748b] mt-1 leading-snug">
                اختر المنتج الذي تريد إضافة بطاقاته
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0b1c30] mb-1.5">
                نوع المنتج
              </label>
              <div className="relative">
                <select
                  value={selectedProductId || ''}
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    const product = products?.products.find((p: any) => p.id === id);
                    if (product) handleProductSelect(product.id, product.name);
                    else { setSelectedProductId(null); setSelectedProductName(''); }
                  }}
                  disabled={isLoadingProducts}
                  className="w-full appearance-none px-4 py-2.5 pe-9 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-sm text-[#0b1c30] focus:outline-none focus:border-[#00236f] focus:ring-2 focus:ring-[#00236f]/15 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {isLoadingProducts ? 'جاري التحميل…' : '← اختر منتجاً'}
                  </option>
                  {products?.products.map((product: any) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.faceValue} د.ل)
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3.5 bg-[#fff7ed] border border-[#fed7aa] rounded-xl">
              <AlertCircle size={14} className="text-[#ea580c] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#9a3412] mb-0.5">نبذة مهمة</p>
                <p className="text-xs text-[#c2410c] leading-relaxed">
                  تأكد من أن الملف يحتوي على عمود{' '}
                  <span className="num font-semibold">PIN</span>{' '}
                  وأن البيانات صحيحة قبل الرفع. يُنصح بتنزيل النموذج أولاً.
                </p>
              </div>
            </div>
          </div>

          {/* ── LEFT panel (DOM second → leftmost in RTL flex): upload ───── */}
          <div className="flex-1 p-4">
            {selectedProductId ? (
              <UploadCardsForm
                productId={selectedProductId}
                productName={selectedProductName}
                onUploadSuccess={() => { setHasFile(false); refetchHistory(); }}
                onFileChange={setHasFile}
              />
            ) : (
              <div className="h-full min-h-[180px] border-2 border-dashed border-[#e2e8f0] rounded-xl
                              flex flex-col items-center justify-center gap-1.5 px-8 text-center">
                <p className="text-sm font-semibold text-[#94a3b8]">اختر المنتج أولاً</p>
                <p className="text-xs text-[#cbd5e1] max-w-[220px] leading-snug">
                  سيظهر هنا نموذج رفع البطاقات بعد اختيار المنتج من القائمة
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ── Upload history ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-[#0b1c30] tracking-tight">سجل الرفع</h2>
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
          <UploadHistoryTable
            uploads={uploadHistory?.uploads || []}
            isLoading={isLoadingHistory}
          />
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
