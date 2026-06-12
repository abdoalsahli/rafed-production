import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Wand2, X, CheckCircle, Loader2 } from 'lucide-react';
import { formatCount } from '@/lib/numberUtils';

interface Product {
  id: number;
  name: string;
}

interface GeneratePinsModalProps {
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

type SerialMode = 'auto' | 'custom';
type Step       = 'form' | 'success';

const inputCls =
  'w-full px-4 py-2.5 rounded-lg bg-white border border-[#e2e8f0] ' +
  'focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] ' +
  'focus:outline-none transition-colors text-sm text-[#0b1c30]';

export function GeneratePinsModal({ products, onClose, onSuccess }: GeneratePinsModalProps) {
  const [step,           setStep]           = useState<Step>('form');
  const [productId,      setProductId]      = useState<number>(products[0]?.id ?? 0);
  const [count,          setCount]          = useState<number>(100);
  const [pinLength,      setPinLength]      = useState<number>(12);
  const [prefix,         setPrefix]         = useState('');
  const [serialMode,     setSerialMode]     = useState<SerialMode>('auto');
  const [startSerial,    setStartSerial]    = useState<number>(1);
  const [serialInterval, setSerialInterval] = useState<number>(1);
  const [result,         setResult]         = useState<any>(null);

  const generateMutation = trpc.provider.generatePins.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep('success');
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || 'فشل توليد البطاقات');
    },
  });

  const handleSubmit = () => {
    if (!productId) { toast.error('اختر منتجًا'); return; }
    if (count < 1 || count > 10000) { toast.error('العدد يجب أن يكون بين 1 و 10,000'); return; }
    if (prefix.length >= pinLength) { toast.error('البادئة أطول من رقم PIN'); return; }

    generateMutation.mutate({
      productId,
      count,
      pinLength,
      prefix:         prefix || undefined,
      serialMode,
      startSerial:    serialMode === 'custom' ? startSerial : undefined,
      serialInterval: serialMode === 'custom' ? serialInterval : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-[#e2e8f0] w-full max-w-lg shadow-xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 size={18} className="text-[#00236f]" />
            <h2 className="text-base font-bold text-[#0b1c30]">توليد بطاقات تلقائيًا</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#f8f9ff] rounded-lg transition-colors"
          >
            <X size={18} className="text-[#444651]" />
          </button>
        </div>

        {/* Body */}
        {step === 'form' ? (
          <div className="p-6 space-y-5">

            {/* Product */}
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">المنتج *</label>
              <select
                value={productId}
                onChange={(e) => setProductId(Number(e.target.value))}
                className={inputCls}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Count + PIN Length */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#444651] mb-1.5">عدد البطاقات *</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className={inputCls}
                />
                <p className="text-xs text-[#94a3b8] mt-1">الحد الأقصى 10,000</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#444651] mb-1.5">طول رقم PIN *</label>
                <input
                  type="number"
                  min={4}
                  max={32}
                  value={pinLength}
                  onChange={(e) => setPinLength(Number(e.target.value))}
                  className={inputCls}
                />
                <p className="text-xs text-[#94a3b8] mt-1">بين 4 و 32 رقمًا</p>
              </div>
            </div>

            {/* Prefix */}
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">
                بادئة PIN <span className="text-[#94a3b8]">(اختياري)</span>
              </label>
              <input
                type="text"
                maxLength={8}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.replace(/\D/g, ''))}
                placeholder="مثال: 99"
                className={inputCls + ' font-mono'}
              />
              <p className="text-xs text-[#94a3b8] mt-1">
                أرقام فقط. مثال: بادئة 99 + طول 12 → 99XXXXXXXXXX
              </p>
            </div>

            {/* Serial Number Mode */}
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-2">نمط الرقم التسلسلي *</label>
              <div className="grid grid-cols-2 gap-3">
                {(['auto', 'custom'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSerialMode(mode)}
                    className={[
                      'p-3 rounded-lg border text-sm font-medium transition-colors text-right',
                      serialMode === mode
                        ? 'border-[#00236f] bg-[#eff4ff] text-[#00236f]'
                        : 'border-[#e2e8f0] text-[#444651] hover:bg-[#f8f9ff]',
                    ].join(' ')}
                  >
                    {mode === 'auto' ? (
                      <>
                        <p className="font-semibold">تلقائي</p>
                        <p className="text-xs opacity-70 mt-0.5">SN-{'{batch}'}-0001…</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">مخصص</p>
                        <p className="text-xs opacity-70 mt-0.5">نقطة بداية + فاصل</p>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom serial options */}
            {serialMode === 'custom' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
                <div>
                  <label className="block text-xs font-medium text-[#444651] mb-1.5">نقطة البداية</label>
                  <input
                    type="number"
                    min={0}
                    value={startSerial}
                    onChange={(e) => setStartSerial(Number(e.target.value))}
                    className={inputCls + ' font-mono'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#444651] mb-1.5">الفاصل</label>
                  <input
                    type="number"
                    min={1}
                    value={serialInterval}
                    onChange={(e) => setSerialInterval(Number(e.target.value))}
                    className={inputCls + ' font-mono'}
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-[#444651]">
                    مثال: بداية{' '}
                    <span className="num font-semibold">{startSerial}</span>
                    {' '}+ فاصل{' '}
                    <span className="num font-semibold">{serialInterval}</span>
                    {' '}→{' '}
                    <span className="num">
                      {startSerial}, {startSerial + serialInterval}, {startSerial + serialInterval * 2}…
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-[#e2e8f0]">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff] transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={generateMutation.isPending || !productId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    جاري التوليد…
                  </>
                ) : (
                  <>
                    <Wand2 size={15} />
                    توليد {formatCount(count)} بطاقة
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Success screen */
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#ccfbf1] flex items-center justify-center">
              <CheckCircle size={28} className="text-[#0f766e]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0b1c30]">تم توليد البطاقات بنجاح</h3>
              <p className="text-sm text-[#444651] mt-1">{result?.productName}</p>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 text-right">
              {[
                { label: 'البطاقات المولّدة', value: formatCount(result?.insertedCount) },
                { label: 'رقم الدُفعة',       value: `#${result?.batchId}` },
                { label: 'أول رقم تسلسلي',   value: result?.firstSerial },
                { label: 'آخر رقم تسلسلي',   value: result?.lastSerial },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
                  <p className="text-xs text-[#444651]">{label}</p>
                  <p className="text-sm font-bold text-[#0b1c30] num mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
