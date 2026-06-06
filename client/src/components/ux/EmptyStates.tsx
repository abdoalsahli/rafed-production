import React from 'react';
import { InboxIcon, SearchIcon, AlertCircle, Zap } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="text-[#444651] mb-4">{icon || <InboxIcon size={48} />}</div>
    <h3 className="text-lg font-semibold text-[#0b1c30] mb-2">{title}</h3>
    <p className="text-[#444651] text-center max-w-md mb-6">{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="px-4 py-2 bg-[#00236f] text-white font-medium rounded-lg hover:bg-[#00164e] transition-colors"
      >
        {action.label}
      </button>
    )}
  </div>
);

/**
 * Pre-configured empty states
 */
export const EmptyStates = {
  noTransactions: {
    icon: <InboxIcon size={48} className="text-[#444651]" />,
    title: 'لا توجد معاملات بعد',
    description: 'ستظهر معاملاتك هنا بمجرد البدء في إجراء عمليات الشراء.',
  },

  noData: {
    icon: <InboxIcon size={48} className="text-[#444651]" />,
    title: 'لا توجد بيانات',
    description: 'لا توجد بيانات لعرضها في الوقت الحالي.',
  },

  searchNoResults: {
    icon: <SearchIcon size={48} className="text-[#444651]" />,
    title: 'لم يتم العثور على نتائج',
    description: 'جرب تعديل معايير البحث أو الفلاتر.',
  },

  noDistributors: {
    icon: <InboxIcon size={48} className="text-[#444651]" />,
    title: 'لا يوجد موزعون بعد',
    description: 'ادعُ موزعين للبدء في منصة بطاقات الدفع المسبق.',
  },

  noProviders: {
    icon: <InboxIcon size={48} className="text-[#444651]" />,
    title: 'لا يوجد مزودون متاحون',
    description: 'تواصل مع المزودين لتوسيع نطاق منتجاتك.',
  },

  noAccessRequests: {
    icon: <InboxIcon size={48} className="text-[#444651]" />,
    title: 'لا توجد طلبات معلقة',
    description: 'ستظهر هنا طلبات الوصول الواردة من الموزعين.',
  },

  noAPIKeys: {
    icon: <Zap size={48} className="text-[#444651]" />,
    title: 'لا توجد مفاتيح API بعد',
    description: 'أنشئ مفتاحك الأول للتكامل مع المنصة.',
  },

  error: {
    icon: <AlertCircle size={48} className="text-[#b91c1c]" />,
    title: 'حدث خطأ ما',
    description: 'واجهنا خطأ أثناء تحميل هذه البيانات. يرجى المحاولة مرة أخرى.',
  },
};

/**
 * Empty state with action
 */
export const EmptyStateWithAction: React.FC<
  EmptyStateProps & { actionLabel?: string }
> = ({ icon, title, description, action, actionLabel }) => (
  <EmptyState
    icon={icon}
    title={title}
    description={description}
    action={action}
  />
);

/**
 * Error empty state
 */
export const ErrorEmptyState: React.FC<{
  title?: string;
  description?: string;
  onRetry?: () => void;
}> = ({
  title = 'حدث خطأ ما',
  description = 'واجهنا خطأ أثناء تحميل هذه البيانات.',
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
    <AlertCircle size={48} className="text-[#b91c1c] mb-4" />
    <h3 className="text-lg font-semibold text-[#b91c1c] mb-2">{title}</h3>
    <p className="text-[#b91c1c] text-center max-w-md mb-6">{description}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-[#b91c1c] text-white font-medium rounded-lg hover:bg-[#991b1b] transition-colors"
      >
        إعادة المحاولة
      </button>
    )}
  </div>
);
