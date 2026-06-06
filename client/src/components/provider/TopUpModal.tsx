import React, { useState } from 'react';
import { formatAmount } from '@/lib/numberUtils';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { DollarSign, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TopUpModalProps {
  distributorId: number;
  distributorName: string;
  currentBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function TopUpModal({
  distributorId,
  distributorName,
  currentBalance,
  onClose,
  onSuccess,
}: TopUpModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [amountError, setAmountError] = useState('');

  const topUpMutation = trpc.provider.topUpDistributorBalance.useMutation({
    onSuccess: (data) => {
      toast.success(
        `تم شحن الرصيد بنجاح. الرصيد الجديد: د.ل ${formatAmount(data.newBalance)}`
      );
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'فشل معالجة الشحن');
    },
  });

  const validateAmount = (value: string) => {
    if (!value) {
      setAmountError('المبلغ مطلوب');
      return false;
    }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setAmountError('يجب أن يكون المبلغ رقمًا موجبًا');
      return false;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      setAmountError('يجب أن يحتوي المبلغ على خانتين عشريتين كحد أقصى');
      return false;
    }
    setAmountError('');
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    if (value) validateAmount(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAmount(amount)) return;

    topUpMutation.mutate({
      distributorId,
      amount,
      paymentReference: paymentReference || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#ccfbf1] flex items-center justify-center">
              <DollarSign size={18} className="text-[#0f766e]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0b1c30]">إضافة رصيد</h2>
              <p className="text-xs text-[#444651]">{distributorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f8f9ff] transition-colors"
            disabled={topUpMutation.isPending}
          >
            <X size={18} className="text-[#444651]" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Current balance info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
            <span className="text-sm text-[#444651]">الرصيد الحالي</span>
            <span className="num text-sm font-semibold text-[#0b1c30]">
              {'د.ل '}{formatAmount(currentBalance)}
            </span>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#0b1c30]">
              مبلغ الشحن <span className="text-[#b91c1c]">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className={`num focus:border-[#00236f] ${amountError ? 'border-[#b91c1c]' : ''}`}
                disabled={topUpMutation.isPending}
                autoFocus
                dir="ltr"
              />
              <span className="text-[#444651] text-sm font-medium shrink-0">د.ل</span>
            </div>
            {amountError && (
              <p className="text-xs text-[#b91c1c]">{amountError}</p>
            )}
            {amount && !amountError && (
              <p className="text-xs text-[#0f766e] num" dir="ltr">
                الرصيد الجديد سيكون: {'د.ل '}{formatAmount(currentBalance + parseFloat(amount || '0'))}
              </p>
            )}
          </div>

          {/* Payment reference */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#0b1c30]">
              مرجع الدفع{' '}
              <span className="text-[#444651] font-normal">(اختياري)</span>
            </label>
            <Input
              type="text"
              placeholder="مثال: تحويل بنكي TXN-12345"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              maxLength={200}
              disabled={topUpMutation.isPending}
              className="focus:border-[#00236f]"
            />
            <p className="text-xs text-[#444651]">
              سيتم تسجيل هذا في السجل المحاسبي للرجوع إليه.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={topUpMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#0f766e] hover:bg-[#0d6460] text-white"
              disabled={topUpMutation.isPending || !amount || !!amountError}
            >
              {topUpMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  جاري المعالجة…
                </span>
              ) : (
                'إضافة رصيد'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
