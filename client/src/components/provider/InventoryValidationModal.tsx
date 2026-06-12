import { trpc } from '@/lib/trpc';
import { X, CheckCircle, AlertTriangle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { formatCount } from '@/lib/numberUtils';

interface InventoryValidationModalProps {
  onClose: () => void;
}

export function InventoryValidationModal({ onClose }: InventoryValidationModalProps) {
  const { data, isLoading, error } = trpc.provider.validateInventory.useQuery();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-[#e2e8f0] w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#00236f]" />
            <h2 className="text-base font-bold text-[#0b1c30]">التحقق من المخزون</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f8f9ff] rounded-lg transition-colors">
            <X size={18} className="text-[#444651]" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5">

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-[#00236f]" />
              <p className="text-sm text-[#444651]">جاري فحص المخزون…</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg flex items-start gap-3">
              <AlertCircle size={18} className="text-[#b91c1c] shrink-0 mt-0.5" />
              <p className="text-sm text-[#b91c1c]">{error.message}</p>
            </div>
          )}

          {data && (
            <>
              {/* Overall status */}
              {data.isClean ? (
                <div className="p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg flex items-center gap-3">
                  <CheckCircle size={20} className="text-[#0f766e] shrink-0" />
                  <div>
                    <p className="font-semibold text-[#134e4a]">المخزون نظيف — لا توجد بطاقات مكررة</p>
                    <p className="text-xs text-[#166534] mt-0.5">
                      تم فحص {formatCount(data.totalCards)} بطاقة
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#fef3c7] border border-[#fcd34d] rounded-lg flex items-center gap-3">
                  <AlertTriangle size={20} className="text-[#b45309] shrink-0" />
                  <div>
                    <p className="font-semibold text-[#78350f]">تم اكتشاف مشاكل في المخزون</p>
                    <p className="text-xs text-[#92400e] mt-0.5">
                      {data.duplicatePins > 0 && `${formatCount(data.duplicatePins)} تكرار في PIN `}
                      {data.duplicateSerials > 0 && `· ${formatCount(data.duplicateSerials)} تكرار في الرقم التسلسلي`}
                    </p>
                  </div>
                </div>
              )}

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'إجمالي البطاقات',      value: formatCount(data.totalCards),          color: 'text-[#0b1c30]' },
                  { label: 'تكرار PIN',             value: formatCount(data.duplicatePins),        color: data.duplicatePins > 0 ? 'text-[#b91c1c]' : 'text-[#0f766e]' },
                  { label: 'تكرار الرقم التسلسلي', value: formatCount(data.duplicateSerials),     color: data.duplicateSerials > 0 ? 'text-[#b91c1c]' : 'text-[#0f766e]' },
                  { label: 'بدون رقم تسلسلي',      value: formatCount(data.cardsWithoutSerial),   color: data.cardsWithoutSerial > 0 ? 'text-[#b45309]' : 'text-[#0f766e]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0] text-right">
                    <p className="text-xs text-[#444651]">{label}</p>
                    <p className={`text-lg font-bold num mt-0.5 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Duplicate PINs */}
              {data.dupPinExamples.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#0b1c30] mb-2 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-[#b91c1c]" />
                    تكرارات PIN ({formatCount(data.duplicatePins)})
                  </h3>
                  <div className="border border-[#fca5a5] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#fee2e2]">
                        <tr>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#b91c1c]">PIN Hash (مقتطع)</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#b91c1c]">عدد التكرارات</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#b91c1c]">معرّفات البطاقات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#fca5a5]/30">
                        {data.dupPinExamples.map((ex, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-4 py-2 font-mono text-xs text-[#444651]">{ex.pinHash}</td>
                            <td className="px-4 py-2 num font-semibold text-[#b91c1c]">{formatCount(ex.count)}</td>
                            <td className="px-4 py-2 num text-xs text-[#444651]">{ex.cardIds.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Duplicate serials */}
              {data.dupSnExamples.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#0b1c30] mb-2 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-[#b91c1c]" />
                    تكرارات الرقم التسلسلي ({formatCount(data.duplicateSerials)})
                  </h3>
                  <div className="border border-[#fca5a5] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#fee2e2]">
                        <tr>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#b91c1c]">الرقم التسلسلي</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#b91c1c]">عدد التكرارات</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#b91c1c]">معرّفات البطاقات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#fca5a5]/30">
                        {data.dupSnExamples.map((ex, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-4 py-2 num font-mono text-xs text-[#444651]">{ex.serial}</td>
                            <td className="px-4 py-2 num font-semibold text-[#b91c1c]">{formatCount(ex.count)}</td>
                            <td className="px-4 py-2 num text-xs text-[#444651]">{ex.cardIds.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Per-product breakdown */}
              {data.productBreakdown.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#0b1c30] mb-2">توزيع البطاقات حسب المنتج</h3>
                  <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f8f9ff]">
                        <tr>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#444651]">المنتج</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#444651]">الإجمالي</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#444651]">متاح</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[#444651]">مباع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f5f9]">
                        {data.productBreakdown.map((p) => (
                          <tr key={p.productId} className="hover:bg-[#f8f9ff]">
                            <td className="px-4 py-2 font-medium text-[#0b1c30]">{p.productName}</td>
                            <td className="px-4 py-2 num text-[#0b1c30]">{formatCount(p.totalCards)}</td>
                            <td className="px-4 py-2 num font-semibold text-[#0f766e]">{formatCount(p.available)}</td>
                            <td className="px-4 py-2 num text-[#444651]">{formatCount(p.sold)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e2e8f0] shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff] transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
