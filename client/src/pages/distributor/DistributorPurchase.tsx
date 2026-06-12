/**
 * Distributor Purchase Page
 *
 * Allows distributors to buy prepaid cards from connected providers.
 * Supports 1-10 cards per order; each card is queued individually and
 * polled until SUCCEEDED. The decrypted PIN is shown once — the user
 * must copy it before navigating away.
 */

import { useState, useEffect, useCallback } from 'react';
import { formatAmount } from '@/lib/numberUtils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, AlertCircle, CheckCircle2, ShoppingCart,
  Copy, CreditCard, Package, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  provider_id: number;
  name: string;
  display_name: string;
  description?: string;
  face_value: number;
  currency: string;
  price: number;
  status: string;
  provider_name: string;
  in_stock: number; // 1 = in stock, 0 = out of stock
}

type CardStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

interface PurchasedCard {
  seq: number;
  requestId: number;
  status: CardStatus;
  pin: string | null;
  serialNumber: string | null;
  error: string | null;
  pinRevealed: boolean;
  copied: boolean;
}

type Phase = 'form' | 'submitting' | 'polling' | 'done';

// ─── Per-card invisible poller ────────────────────────────────────────────────

function CardPoller({
  requestId,
  onResult,
}: {
  requestId: number;
  onResult: (id: number, status: CardStatus, pin: string | null, serialNumber: string | null, error: string | null) => void;
}) {
  const { data } = trpc.distributor.getPurchaseResult.useQuery(
    { requestId },
    {
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d || d.status === 'PENDING' || d.status === 'PROCESSING') return 800;
        return false;
      },
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: 2,
    }
  );

  useEffect(() => {
    if (data?.status === 'SUCCEEDED' || data?.status === 'FAILED') {
      onResult(
        requestId,
        data.status,
        data.pin ?? null,
        (data as any).serialNumber ?? null,
        data.failureReason ?? null
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DistributorPurchase() {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>('form');
  const [purchasedCards, setPurchasedCards] = useState<PurchasedCard[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: productsData,
    isLoading: isLoadingProducts,
    error: productsError,
  } = trpc.distributor.listProducts.useQuery(
    { limit: 100, offset: 0 },
    { staleTime: 30_000 }
  );

  const purchaseMutation = trpc.distributor.purchase.useMutation();

  const selectedProduct = selectedProductId && productsData?.products
    ? (productsData.products as Product[]).find(p => p.id === parseInt(selectedProductId)) ?? null
    : null;

  // ── Derived state ──────────────────────────────────────────────────────────

  const succeededCount = purchasedCards.filter(c => c.status === 'SUCCEEDED').length;
  const failedCount    = purchasedCards.filter(c => c.status === 'FAILED').length;
  const pendingCount   = purchasedCards.filter(c => c.status === 'PENDING' || c.status === 'PROCESSING').length;
  const allSettled     = purchasedCards.length > 0 && pendingCount === 0;

  // Transition to 'done' once every card has a final status
  useEffect(() => {
    if (allSettled && phase === 'polling') setPhase('done');
  }, [allSettled, phase]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCardResult = useCallback(
    (requestId: number, status: CardStatus, pin: string | null, serialNumber: string | null, error: string | null) => {
      setPurchasedCards(prev =>
        prev.map(c => c.requestId === requestId ? { ...c, status, pin, serialNumber, error } : c)
      );
    },
    []
  );

  const handlePurchase = async () => {
    if (!selectedProduct) return;
    setSubmitError(null);
    setPhase('submitting');
    const cards: PurchasedCard[] = [];

    try {
      for (let i = 0; i < quantity; i++) {
        const idempotencyKey = `manual-${selectedProduct.provider_id}-${selectedProduct.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`;
        const result = await purchaseMutation.mutateAsync({
          providerId: selectedProduct.provider_id,
          productId:  selectedProduct.id,
          quantity:   1,
          idempotencyKey,
        });

        if ((result as any).status === 'REJECTED') {
          setSubmitError(
            cards.length === 0
              ? 'قائمة الانتظار ممتلئة. يرجى المحاولة مرة أخرى بعد قليل.'
              : `امتلأت قائمة الانتظار بعد ${cards.length} ${cards.length > 1 ? 'بطاقات' : 'بطاقة'}. البطاقات أعلاه لا تزال قيد المعالجة.`
          );
          break;
        }

        cards.push({
          seq:          i + 1,
          requestId:    result.requestId as number,
          status:       (result.status as CardStatus) || 'PENDING',
          pin:          null,
          serialNumber: null,
          error:        null,
          pinRevealed:  false,
          copied:       false,
        });
      }

      if (cards.length === 0) {
        setPhase('form');
        return;
      }

      setPurchasedCards(cards);
      setPhase('polling');
      setSelectedProductId('');
      setQuantity(1);
    } catch (err: any) {
      setSubmitError(err?.message || 'فشل إرسال الطلب. يرجى المحاولة مرة أخرى.');
      setPhase('form');
    }
  };

  const handleCopyPin = (requestId: number, pin: string) => {
    navigator.clipboard.writeText(pin).then(() => {
      setPurchasedCards(prev =>
        prev.map(c => c.requestId === requestId ? { ...c, copied: true } : c)
      );
      setTimeout(() => {
        setPurchasedCards(prev =>
          prev.map(c => c.requestId === requestId ? { ...c, copied: false } : c)
        );
      }, 2000);
    });
  };

  const handleCopyAll = () => {
    const lines = purchasedCards
      .filter(c => c.pin)
      .map(c => `بطاقة #${c.seq}: ${c.pin}`)
      .join('\n');
    navigator.clipboard.writeText(lines);
  };

  const handleTogglePin = (requestId: number) =>
    setPurchasedCards(prev =>
      prev.map(c => c.requestId === requestId ? { ...c, pinRevealed: !c.pinRevealed } : c)
    );

  const handleNewPurchase = () => {
    setPhase('form');
    setPurchasedCards([]);
    setSubmitError(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">شراء البطاقات</h1>
        <p className="text-muted-foreground mt-1">
          اشترِ بطاقات مدفوعة مسبقاً من مزوديك المرتبطين. تُعرض رموز PIN مرة واحدة فقط — احفظها قبل مغادرة الصفحة.
        </p>
      </div>

      {/* Invisible pollers — one per in-flight card */}
      {phase === 'polling' &&
        purchasedCards
          .filter(c => c.status === 'PENDING' || c.status === 'PROCESSING')
          .map(c => (
            <CardPoller key={c.requestId} requestId={c.requestId} onResult={handleCardResult} />
          ))
      }

      {/* Submission error */}
      {submitError && (
        <Alert className="border-[#fecaca] bg-[#fff5f5]">
          <AlertCircle className="h-4 w-4 text-[#b91c1c]" />
          <AlertDescription className="text-[#991b1b]">{submitError}</AlertDescription>
        </Alert>
      )}

      {/* ── Results panel (polling + done) ───────────────────────────────── */}
      {(phase === 'polling' || phase === 'done') && purchasedCards.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {phase === 'polling' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-[#00236f]" />
                      جاري معالجة {purchasedCards.length} {purchasedCards.length > 1 ? 'بطاقات' : 'بطاقة'}…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-[#0f766e]" />
                      اكتمل الشراء
                    </>
                  )}
                </CardTitle>

                {phase === 'done' && (
                  <CardDescription className="mt-1">
                    {succeededCount > 0 && `${succeededCount} تم تخصيصها`}
                    {succeededCount > 0 && failedCount > 0 && ' · '}
                    {failedCount > 0 && `${failedCount} فاشلة`}
                    {succeededCount > 0 && ' · رموز PIN تُستخدم مرة واحدة — انسخها الآن'}
                  </CardDescription>
                )}
              </div>

              <div className="flex items-center gap-2">
                {phase === 'done' && succeededCount > 1 && (
                  <Button variant="outline" size="sm" onClick={handleCopyAll}>
                    <Copy className="h-3.5 w-3.5 ml-1.5" />
                    نسخ جميع رموز PIN
                  </Button>
                )}
                {phase === 'done' && (
                  <Button variant="outline" size="sm" onClick={handleNewPurchase}>
                    عملية شراء جديدة
                  </Button>
                )}
              </div>
            </div>

            {/* Progress bar while polling */}
            {phase === 'polling' && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{succeededCount + failedCount} / {purchasedCards.length} مكتملة</span>
                  {pendingCount > 0 && <span>جاري تخصيص البطاقات…</span>}
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00236f] rounded-full transition-all duration-500"
                    style={{ width: `${((succeededCount + failedCount) / purchasedCards.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-3">
            {purchasedCards.map(card => (
              <CardResultRow
                key={card.requestId}
                card={card}
                onCopyPin={handleCopyPin}
                onTogglePin={handleTogglePin}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Purchase form ─────────────────────────────────────────────────── */}
      {phase === 'form' && (
        <>
          {isLoadingProducts && (
            <Card>
              <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري تحميل المنتجات…
              </CardContent>
            </Card>
          )}

          {productsError && (
            <Alert className="border-[#fecaca] bg-[#fff5f5]">
              <AlertCircle className="h-4 w-4 text-[#b91c1c]" />
              <AlertDescription className="text-[#991b1b]">
                فشل تحميل المنتجات: {productsError.message}
              </AlertDescription>
            </Alert>
          )}

          {!isLoadingProducts && !productsError &&
            (!productsData?.products || productsData.products.length === 0) && (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                لا توجد منتجات متاحة. قم بالربط بمزود أولاً.
              </AlertDescription>
            </Alert>
          )}

          {!isLoadingProducts && productsData?.products && productsData.products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>اختر المنتج</CardTitle>
                <CardDescription>اختر بطاقة مدفوعة مسبقاً للشراء</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Product dropdown */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">المنتج</label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر منتجاً…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(productsData.products as Product[]).map(product => (
                        <SelectItem
                          key={product.id}
                          value={product.id.toString()}
                          disabled={!product.in_stock}
                        >
                          <span>{product.display_name || product.name}</span>
                          <span className="mr-2 text-xs text-muted-foreground">
                            — {product.provider_name}
                          </span>
                          {!product.in_stock && (
                            <span className="mr-2 text-xs text-[#b91c1c]">(نفد المخزون)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product details grid */}
                {selectedProduct && (
                  <div className="bg-[#f8f9ff] rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border border-[#e2e8f0]">
                    <Stat
                      label="القيمة الاسمية"
                      value={`د.ل ${selectedProduct.face_value}`}
                    />
                    <Stat
                      label="سعرك"
                      value={`د.ل ${selectedProduct.price}`}
                    />
                    <Stat
                      label="الهامش"
                      value={`د.ل ${formatAmount(selectedProduct.face_value - selectedProduct.price)}`}
                      valueClass="text-[#0f766e]"
                    />
                  </div>
                )}

                {/* Quantity selector */}
                {selectedProduct && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الكمية</label>
                    <div className="flex items-center gap-3" dir="ltr">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 text-lg"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                      >
                        −
                      </Button>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={quantity}
                        onChange={e =>
                          setQuantity(
                            Math.min(
                              10,
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          )
                        }
                        className="w-16 h-9 border rounded text-center text-sm num"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 text-lg"
                        onClick={() =>
                          setQuantity(q => Math.min(10, q + 1))
                        }
                        disabled={quantity >= 10}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}

                {/* Order summary */}
                {selectedProduct && (
                  <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-4 space-y-2">
                    <div className="text-sm font-semibold text-[#1e3a8a] mb-1">ملخص الطلب</div>
                    <div className="flex justify-between text-sm text-[#1e40af]">
                      <span>سعر الوحدة</span>
                      <span className="font-medium num" dir="ltr">{selectedProduct.price} {selectedProduct.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm text-[#1e40af]">
                      <span>الكمية</span>
                      <span className="font-medium num">{quantity} {quantity > 1 ? 'بطاقات' : 'بطاقة'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base text-[#1e3a8a] pt-2 border-t border-[#bfdbfe]">
                      <span>الإجمالي</span>
                      <span className="num" dir="ltr">{formatAmount(selectedProduct.price * quantity)} {selectedProduct.currency}</span>
                    </div>
                  </div>
                )}

                {/* Purchase button */}
                <Button
                  onClick={handlePurchase}
                  disabled={
                    !selectedProduct ||
                    !selectedProduct.in_stock ||
                    purchaseMutation.isPending
                  }
                  className="w-full bg-[#00236f] hover:bg-[#00164e]"
                  size="lg"
                >
                  <ShoppingCart className="ml-2 h-5 w-5" />
                  {selectedProduct
                    ? `شراء ${quantity} ${quantity > 1 ? 'بطاقات' : 'بطاقة'}`
                    : 'شراء بطاقة'}
                  {selectedProduct && (
                    <span className="mr-2 opacity-75 text-sm font-normal num" dir="ltr">
                      — {formatAmount(selectedProduct.price * quantity)} {selectedProduct.currency}
                    </span>
                  )}
                </Button>

              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Submitting overlay ─────────────────────────────────────────────── */}
      {phase === 'submitting' && (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-[#00236f]" />
            <div>
              <div className="text-base font-semibold text-center">
                جاري إرسال {quantity > 1 ? 'الطلبات' : 'الطلب'}…
              </div>
              <div className="text-sm text-muted-foreground text-center mt-1">
                يرجى الانتظار بينما يتم وضع طلبك في قائمة الانتظار
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-0.5 num ${valueClass}`} dir="ltr">{value}</div>
    </div>
  );
}

function CardResultRow({
  card,
  onCopyPin,
  onTogglePin,
}: {
  card:         PurchasedCard;
  onCopyPin:    (id: number, pin: string) => void;
  onTogglePin:  (id: number) => void;
}) {
  const isPending = card.status === 'PENDING' || card.status === 'PROCESSING';

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        card.status === 'SUCCEEDED'
          ? 'border-[#bbf7d0] bg-[#f0fdf4]'
          : card.status === 'FAILED'
          ? 'border-[#fecaca] bg-[#fff5f5]'
          : 'border-[#e2e8f0] bg-[#f8f9ff]'
      }`}
    >
      {/* Row header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[#0b1c30] flex items-center gap-1.5">
          <CreditCard className="h-4 w-4" />
          بطاقة #{card.seq}
        </span>

        <Badge
          className={
            card.status === 'SUCCEEDED'
              ? 'bg-[#dcfce7] text-[#166534]'
              : card.status === 'FAILED'
              ? 'bg-[#fee2e2] text-[#991b1b]'
              : 'bg-[#dbeafe] text-[#1e40af]'
          }
        >
          {isPending ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {card.status === 'PROCESSING' ? 'جاري التخصيص…' : 'في قائمة الانتظار'}
            </span>
          ) : card.status === 'SUCCEEDED' ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> تم التخصيص
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> فاشل
            </span>
          )}
        </Badge>
      </div>

      {/* Serial number */}
      {card.status === 'SUCCEEDED' && card.serialNumber && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-semibold text-[#444651]">الرقم التسلسلي:</span>
          <span className="num font-mono text-sm font-bold text-[#0b1c30] bg-white border border-[#e2e8f0] rounded px-2 py-0.5 select-all">
            {card.serialNumber}
          </span>
        </div>
      )}

      {/* PIN display */}
      {card.status === 'SUCCEEDED' && card.pin && (
        <div className="mt-2 space-y-1.5">
          <div className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide">رمز PIN</div>
          <div className="flex items-center gap-2" dir="ltr">
            {/* PIN value */}
            <div className="flex-1 font-mono text-2xl font-bold tracking-[0.25em] text-[#134e4a] bg-white rounded-md px-4 py-2 border border-[#99f6e4] select-all">
              {card.pinRevealed ? card.pin : '•'.repeat(card.pin.length)}
            </div>

            {/* Reveal/hide */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTogglePin(card.requestId)}
              title={card.pinRevealed ? 'إخفاء رمز PIN' : 'كشف رمز PIN'}
            >
              {card.pinRevealed
                ? <EyeOff className="h-4 w-4 text-[#444651]" />
                : <Eye className="h-4 w-4 text-[#444651]" />
              }
            </Button>

            {/* Copy */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopyPin(card.requestId, card.pin!)}
              title="نسخ رمز PIN"
            >
              {card.copied
                ? <CheckCircle2 className="h-4 w-4 text-[#0f766e]" />
                : <Copy className="h-4 w-4 text-[#444651]" />
              }
            </Button>
          </div>

          <p className="text-xs text-[#b45309] font-medium">
            ⚠ يُعرض رمز PIN مرة واحدة فقط — انسخه قبل مغادرة الصفحة.
          </p>
        </div>
      )}

      {/* Succeeded but no PIN available */}
      {card.status === 'SUCCEEDED' && !card.pin && card.error && (
        <p className="text-sm text-[#b45309] mt-1">{card.error}</p>
      )}
      {card.status === 'SUCCEEDED' && !card.pin && !card.error && (
        <p className="text-sm text-[#444651] mt-1">تم تخصيص البطاقة.</p>
      )}

      {/* Failed */}
      {card.status === 'FAILED' && (
        <p className="text-sm text-[#b91c1c] mt-1">{card.error || 'فشل الشراء.'}</p>
      )}
    </div>
  );
}
