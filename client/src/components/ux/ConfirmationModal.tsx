import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

export type ConfirmationType = 'danger' | 'warning' | 'info';

interface ConfirmationModalProps {
  isOpen: boolean;
  type?: ConfirmationType;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  requiresTyping?: {
    text: string;
    placeholder: string;
  };
}

const typeConfig = {
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-[#fee2e2]',
    iconColor: 'text-[#b91c1c]',
    buttonBg: 'bg-[#b91c1c] hover:bg-[#991b1b]',
    headerBg: 'border-[#fca5a5]',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-[#fef3c7]',
    iconColor: 'text-[#b45309]',
    buttonBg: 'bg-[#b45309] hover:bg-[#92400e]',
    headerBg: 'border-[#fcd34d]',
  },
  info: {
    icon: CheckCircle,
    iconBg: 'bg-[#eff4ff]',
    iconColor: 'text-[#00236f]',
    buttonBg: 'bg-[#00236f] hover:bg-[#00164e]',
    headerBg: 'border-[#dce1ff]',
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  type = 'danger',
  title,
  description,
  details,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  isLoading = false,
  onConfirm,
  onCancel,
  requiresTyping,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [typedText, setTypedText] = useState('');
  const config = typeConfig[type];
  const Icon = config.icon;

  if (!isOpen) return null;

  const canConfirm = !requiresTyping || typedText === requiresTyping.text;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
      setTypedText('');
    }
  };

  const handleCancel = () => {
    setTypedText('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" dir="rtl">
        {/* Header */}
        <div className={`flex items-start justify-between p-6 border-b ${config.headerBg}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${config.iconBg}`}>
              <Icon className={`${config.iconColor}`} size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0b1c30]">{title}</h2>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isProcessing || isLoading}
            className="text-[#444651] hover:text-[#0b1c30] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-[#444651]">{description}</p>

          {/* Details */}
          {details && details.length > 0 && (
            <div className="bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-4 space-y-2">
              {details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-[#444651]">
                  <span className="font-bold">•</span>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Typing confirmation */}
          {requiresTyping && (
            <div className="bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-4">
              <p className="text-sm text-[#444651] mb-2">
                اكتب <code className="font-mono font-semibold text-[#0b1c30]">
                  {requiresTyping.text}
                </code> للتأكيد:
              </p>
              <input
                type="text"
                placeholder={requiresTyping.placeholder}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]"
                disabled={isProcessing || isLoading}
                dir="ltr"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e2e8f0] bg-[#f8f9ff]">
          <button
            onClick={handleCancel}
            disabled={isProcessing || isLoading}
            className="px-4 py-2 text-[#444651] font-medium hover:bg-[#e2e8f0] rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || isLoading || !canConfirm}
            className={`px-4 py-2 ${config.buttonBg} text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2`}
          >
            {isProcessing || isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                جاري المعالجة…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Pre-configured confirmation modals
 */
export const ConfirmationModals = {
  deleteKey: {
    type: 'danger' as const,
    title: 'حذف مفتاح API؟',
    description: 'لا يمكن التراجع عن هذا الإجراء. ستتوقف جميع التطبيقات التي تستخدم هذا المفتاح عن العمل.',
    details: ['سيُحذف المفتاح نهائيًا', 'لا يمكنك استعادة مفتاح محذوف'],
    confirmLabel: 'حذف المفتاح',
  },

  regenerateKey: {
    type: 'warning' as const,
    title: 'تجديد مفتاح API؟',
    description: 'سيُبطل هذا المفتاح الحالي. ستتوقف جميع التطبيقات التي تستخدمه فورًا.',
    details: [
      'حدّث جميع التطبيقات بالمفتاح الجديد',
      'أبطل المفتاح القديم من الخدمات الخارجية',
      'لا يمكن التراجع عن هذا الإجراء',
    ],
    confirmLabel: 'تجديد المفتاح',
  },

  deleteTransaction: {
    type: 'danger' as const,
    title: 'حذف المعاملة؟',
    description: 'سيزيل هذا المعاملة من سجلاتك.',
    details: ['لا يمكن التراجع عن هذا الإجراء', 'ستُحذف المعاملة نهائيًا'],
    confirmLabel: 'حذف المعاملة',
  },

  rejectRequest: {
    type: 'warning' as const,
    title: 'رفض طلب الوصول؟',
    description: 'لن يتمكن الموزع من الوصول إلى منتجاتك.',
    details: ['يمكنه تقديم طلب جديد لاحقًا', 'يمكنك تغيير قرارك في أي وقت'],
    confirmLabel: 'رفض الطلب',
  },

  disconnectDistributor: {
    type: 'danger' as const,
    title: 'قطع اتصال الموزع؟',
    description: 'سيؤدي هذا إلى إلغاء وصوله إلى منتجاتك وإيقاف جميع المعاملات النشطة.',
    details: [
      'لن يتمكن من شراء البطاقات',
      'ستبقى المعاملات الحالية في التاريخ',
      'يمكنك إعادة ربطه لاحقًا',
    ],
    confirmLabel: 'قطع الاتصال',
  },
};
