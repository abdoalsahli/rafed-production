import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  isLoading?: boolean;
}

export function TopUpModal({ isOpen, onClose, onSubmit, isLoading = false }: TopUpModalProps) {
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    if (amount && parseFloat(amount) > 0) {
      onSubmit(parseFloat(amount));
      setAmount('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full mx-4" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e2e8f0]">
          <h2 className="text-xl font-bold text-[#0b1c30]">شحن المحفظة</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#f8f9ff] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#444651]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0b1c30] mb-2">المبلغ</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f] num"
                dir="ltr"
              />
              <span className="text-[#444651] font-semibold shrink-0">د.ل</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-[#eff4ff] border border-[#dce1ff] rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-[#00236f] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#00236f]">
              تتم معالجة عمليات الشحن فورًا وتصبح الأموال متاحة على الفور.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[#e2e8f0]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#e2e8f0] rounded-lg text-[#444651] hover:bg-[#f8f9ff] font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || isLoading}
            className="flex-1 px-4 py-2 bg-[#0f766e] text-white rounded-lg hover:bg-[#0d6460] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'جاري المعالجة…' : 'شحن'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  maxAmount: number;
  isLoading?: boolean;
}

export function WithdrawModal({
  isOpen,
  onClose,
  onSubmit,
  maxAmount,
  isLoading = false,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState('');

  const handleSubmit = () => {
    if (amount && parseFloat(amount) > 0 && parseFloat(amount) <= maxAmount) {
      onSubmit(parseFloat(amount));
      setAmount('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full mx-4" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e2e8f0]">
          <h2 className="text-xl font-bold text-[#0b1c30]">سحب الأموال</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#f8f9ff] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#444651]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0b1c30] mb-2">المبلغ</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                max={maxAmount}
                className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f] num"
                dir="ltr"
              />
              <span className="text-[#444651] font-semibold shrink-0">د.ل</span>
            </div>
            <p className="text-xs text-[#444651] mt-2 num">
              المتاح: {'د.ل '}{maxAmount.toLocaleString('en-US')}
            </p>
          </div>

          {/* Warning Box */}
          <div className="bg-[#fee2e2] border border-[#fca5a5] rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-[#b91c1c] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#b91c1c]">
              تتم معالجة عمليات السحب خلال 1-2 يوم عمل. قد تُطبَّق رسوم معالجة.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[#e2e8f0]">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[#e2e8f0] rounded-lg text-[#444651] hover:bg-[#f8f9ff] font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              parseFloat(amount) > maxAmount ||
              isLoading
            }
            className="flex-1 px-4 py-2 bg-[#b91c1c] text-white rounded-lg hover:bg-[#991b1b] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'جاري المعالجة…' : 'سحب'}
          </button>
        </div>
      </div>
    </div>
  );
}
