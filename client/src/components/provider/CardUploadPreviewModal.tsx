import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2, X, List, XCircle, Copy, ShieldX } from 'lucide-react';
import { useState } from 'react';

interface CardUploadPreviewModalProps {
  preview: any;
  productName: string;
  fileName: string;
  onClose: () => void;
  onSuccess: () => void;
}

/* ── Stat card used inside the summary grid ────────────────────────────── */
interface StatTileProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}
function StatTile({ label, value, icon, bg, border, iconBg, iconColor, valueColor }: StatTileProps) {
  return (
    <div className={`p-3.5 ${bg} border ${border} rounded-xl`}>
      <div className={`w-7 h-7 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center mb-2.5`}>
        {icon}
      </div>
      <p className="text-xs text-[#64748b] leading-tight">{label}</p>
      <p className={`num text-2xl font-bold ${valueColor} leading-tight mt-0.5`}>{value}</p>
    </div>
  );
}

export function CardUploadPreviewModal({
  preview,
  productName,
  fileName,
  onClose,
  onSuccess,
}: CardUploadPreviewModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCanceling,  setIsCanceling]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const canConfirm = preview.validRows > 0;

  const handleConfirmImport = async () => {
    try {
      setIsConfirming(true);
      setError(null);
      const response = await fetch('/api/trpc/provider.confirmCardUpload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { uploadPreviewId: preview.uploadPreviewId } }),
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        if (data[0]?.error) throw new Error(data[0].error.json?.message || 'فشل التأكيد');
      } else {
        if (data.error) throw new Error(data.error.json?.message || 'فشل التأكيد');
      }
      onSuccess();
    } catch (err) {
      console.error('Confirm import failed:', err);
      setError((err as any)?.message || 'فشل تأكيد الاستيراد');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsCanceling(true);
      setError(null);
      const response = await fetch('/api/trpc/provider.cancelCardUpload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { uploadPreviewId: preview.uploadPreviewId } }),
      });
      const data = await response.json();
      if (Array.isArray(data) && data[0]?.error) throw new Error(data[0].error.json?.message || 'فشل الإلغاء');
      else if (!Array.isArray(data) && data.error) throw new Error(data.error.json?.message || 'فشل الإلغاء');
      onClose();
    } catch (err) {
      console.error('Cancel failed:', err);
      setError((err as any)?.message || 'فشل الإلغاء');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        dir="rtl"
      >
        <div className="p-6">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30] tracking-tight">معاينة الرفع</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="num text-xs font-medium text-[#444651] bg-[#f1f5f9] px-2 py-0.5 rounded-md border border-[#e2e8f0]">
                  {fileName}
                </span>
                <span className="text-[#94a3b8] text-xs">←</span>
                <span className="text-xs font-semibold text-[#00236f] bg-[#eff4ff] px-2 py-0.5 rounded-md border border-[#00236f]/15">
                  {productName}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isConfirming || isCanceling}
              className="w-8 h-8 rounded-lg bg-[#f1f5f9] hover:bg-[#e2e8f0] flex items-center justify-center text-[#64748b] hover:text-[#0b1c30] transition-colors disabled:opacity-40 shrink-0"
              aria-label="إغلاق"
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Summary stats ────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatTile
              label="إجمالي الصفوف"
              value={preview.totalRows}
              icon={<List size={14} />}
              bg="bg-[#f8f9ff]"       border="border-[#e2e8f0]"
              iconBg="bg-[#e9edf2]"   iconColor="text-[#444651]"
              valueColor="text-[#0b1c30]"
            />
            <StatTile
              label="صفوف صالحة"
              value={preview.validRows}
              icon={<CheckCircle2 size={14} />}
              bg="bg-[#f0fdf4]"       border="border-[#bbf7d0]"
              iconBg="bg-[#dcfce7]"   iconColor="text-[#16a34a]"
              valueColor="text-[#16a34a]"
            />
            <StatTile
              label="غير صالحة"
              value={preview.invalidRows}
              icon={<XCircle size={14} />}
              bg="bg-[#fff1f2]"       border="border-[#fecdd3]"
              iconBg="bg-[#ffe4e6]"   iconColor="text-[#e11d48]"
              valueColor="text-[#be123c]"
            />
            <StatTile
              label="مكررة"
              value={preview.duplicateRows || 0}
              icon={<Copy size={14} />}
              bg="bg-[#fffbeb]"       border="border-[#fde68a]"
              iconBg="bg-[#fef3c7]"   iconColor="text-[#b45309]"
              valueColor="text-[#b45309]"
            />
          </div>

          {/* ── Error message ─────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-[#fff1f2] border border-[#fecdd3] rounded-xl mb-6">
              <div className="w-7 h-7 rounded-lg bg-[#ffe4e6] flex items-center justify-center shrink-0">
                <AlertCircle size={14} className="text-[#e11d48]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#be123c]">خطأ</p>
                <p className="text-xs text-[#be123c] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* ── No valid cards warning ────────────────────────────────────── */}
          {!canConfirm && (
            <div className="flex items-start gap-3 p-4 bg-[#fffbeb] border border-[#fde68a] rounded-xl mb-6">
              <div className="w-7 h-7 rounded-lg bg-[#fef3c7] flex items-center justify-center shrink-0">
                <AlertCircle size={14} className="text-[#b45309]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#92400e]">لا توجد بطاقات صالحة</p>
                <p className="text-xs text-[#b45309] mt-0.5 leading-snug">
                  لا يحتوي هذا الملف على بطاقات صالحة للاستيراد. يرجى التحقق من تنسيق الملف والمحاولة مجددًا.
                </p>
              </div>
            </div>
          )}

          {/* ── System duplicates banner ─────────────────────────────────── */}
          {(preview.duplicateInSystemCount ?? 0) > 0 && (
            <div className="flex items-start gap-3 p-4 bg-[#fef3c7] border border-[#fde68a] rounded-xl mb-6">
              <div className="w-7 h-7 rounded-lg bg-[#fef3c7] flex items-center justify-center shrink-0 mt-0.5">
                <ShieldX size={14} className="text-[#b45309]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#92400e]">بطاقات موجودة مسبقاً في النظام</p>
                <p className="text-xs text-[#b45309] mt-0.5 leading-snug">
                  تم استبعاد{' '}
                  <span className="num font-bold">{preview.duplicateInSystemCount}</span>{' '}
                  بطاقة لأنها موجودة مسبقاً في قاعدة البيانات.
                </p>
              </div>
            </div>
          )}

          {/* ── Valid rows sample ─────────────────────────────────────────── */}
          {preview.validRows > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#0b1c30]">عينة من البطاقات الصالحة</h3>
                <span className="num text-xs text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded-md">
                  {Math.min(5, preview.sampleValidRows?.length || 0)} من {preview.validRows}
                </span>
              </div>
              <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                {/* Header row */}
                <div className="flex items-center px-4 py-2.5 bg-[#f1f5f9] border-b border-[#e2e8f0]" dir="ltr">
                  <span className="text-xs font-semibold text-[#444651] flex-1">PIN</span>
                  <span className="text-xs font-semibold text-[#444651] w-32 text-left">رقم مسلسل</span>
                </div>
                {/* Data rows */}
                {preview.sampleValidRows?.slice(0, 5).map((row: any, idx: number) => (
                  <div
                    key={idx}
                    dir="ltr"
                    className="flex items-center px-4 py-2.5 bg-white border-b border-[#e2e8f0] last:border-0 hover:bg-[#eff4ff] transition-colors"
                  >
                    <span className="num text-xs font-medium text-[#0b1c30] flex-1">
                      {row.pinMasked ?? row.maskedPin}
                    </span>
                    <span className="num text-xs text-[#64748b] w-32">
                      {row.serialNumber || '—'}
                    </span>
                  </div>
                ))}
              </div>
              {preview.sampleValidRows?.length > 5 && (
                <p className="text-xs text-[#94a3b8] mt-2 text-center">
                  و <span className="num font-semibold">{preview.sampleValidRows.length - 5}</span> بطاقة صالحة أخرى
                </p>
              )}
            </div>
          )}

          {/* ── Invalid rows ──────────────────────────────────────────────── */}
          {preview.invalidRows > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#0b1c30] mb-3">الصفوف غير الصالحة</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {preview.errors?.slice(0, 10).map((err: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl"
                  >
                    <XCircle size={14} className="text-[#e11d48] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#be123c]">
                        صف <span className="num">{err.row}</span>
                      </p>
                      <p className="text-xs text-[#be123c] mt-0.5 leading-snug">{err.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              {preview.errors?.length > 10 && (
                <p className="text-xs text-[#94a3b8] mt-2 text-center">
                  و <span className="num font-semibold">{preview.errors.length - 10}</span> خطأ آخر
                </p>
              )}
            </div>
          )}

          {/* ── Action buttons ────────────────────────────────────────────── */}
          {/* RTL: first child = rightmost = primary action (Confirm) */}
          <div className="flex gap-3 pt-5 border-t border-[#e2e8f0]">
            <Button
              onClick={handleConfirmImport}
              disabled={!canConfirm || isConfirming || isCanceling}
              className="flex-1 flex items-center justify-center gap-2 bg-[#00236f] hover:bg-[#00164e] text-white disabled:opacity-40 transition-colors"
            >
              {isConfirming && <Loader2 size={14} className="animate-spin" />}
              {canConfirm ? 'تأكيد الاستيراد' : 'لا توجد بطاقات صالحة'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isConfirming || isCanceling}
              className="flex items-center gap-2 border-[#e2e8f0] text-[#444651] hover:bg-[#f8f9ff] hover:text-[#0b1c30]"
            >
              {isCanceling && <Loader2 size={14} className="animate-spin" />}
              إلغاء
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
