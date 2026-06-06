import React, { useState } from 'react';
import { formatAmount } from '@/lib/numberUtils';
import { formatDateOnly } from '@/lib/dateUtils';
import { Check, X, Clock } from 'lucide-react';

export interface AccessRequest {
  id: string;
  distributorName: string;
  requestedCredit: number;
  requestedCommission: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
}

interface AccessRequestsProps {
  requests: AccessRequest[];
  isLoading?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

interface ConfirmModalProps {
  isOpen: boolean;
  action: 'approve' | 'reject';
  request: AccessRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, action, request, onConfirm, onCancel, isLoading }) => {
  if (!isOpen || !request) return null;

  const isApprove = action === 'approve';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-[#e2e8f0]" dir="rtl">
          <div className={`p-6 border-b border-[#e2e8f0] flex items-center gap-3 ${isApprove ? 'bg-[#ccfbf1]' : 'bg-[#fee2e2]'}`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isApprove ? 'bg-[#5eead4]' : 'bg-[#fca5a5]'}`}>
              {isApprove ? (
                <Check size={20} className="text-[#0f766e]" />
              ) : (
                <X size={20} className="text-[#b91c1c]" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-[#0b1c30]">
              {isApprove ? 'قبول طلب الوصول؟' : 'رفض طلب الوصول؟'}
            </h3>
          </div>

          <div className="p-6">
            <p className="text-sm text-[#444651] mb-4">
              {isApprove
                ? `أنت على وشك قبول الوصول لـ ${request.distributorName}.`
                : `أنت على وشك رفض طلب ${request.distributorName}.`}
            </p>

            <div className="bg-[#f8f9ff] rounded-lg p-4 mb-4 border border-[#e2e8f0]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#444651] font-semibold mb-1">الائتمان المطلوب</p>
                  <p className="text-lg font-bold num text-[#0b1c30]" dir="ltr">
                    {'د.ل '}{formatAmount(request.requestedCredit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#444651] font-semibold mb-1">العمولة المطلوبة</p>
                  <p className="text-lg font-bold num text-[#0b1c30]">
                    {request.requestedCommission}%
                  </p>
                </div>
              </div>
            </div>

            {isApprove && (
              <div className="rounded-lg bg-[#eff4ff] border border-[#dce1ff] p-4 mb-4">
                <p className="text-sm text-[#00236f]">
                  ℹ️ سيتم إخطار الموزع فورًا وسيتمكن من استخدام حسابه.
                </p>
              </div>
            )}

            {!isApprove && (
              <div className="rounded-lg bg-[#fef3c7] border border-[#fcd34d] p-4 mb-4">
                <p className="text-sm text-[#b45309]">
                  ⚠️ سيتم إخطار الموزع برفض الطلب.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-6 border-t border-[#e2e8f0] bg-[#f8f9ff]">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-[#444651] border border-[#e2e8f0] rounded-lg hover:bg-[#e2e8f0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                isApprove
                  ? 'bg-[#0f766e] hover:bg-[#0d6460]'
                  : 'bg-[#b91c1c] hover:bg-[#991b1b]'
              }`}
            >
              {isLoading ? 'جاري المعالجة…' : isApprove ? 'قبول' : 'رفض'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const AccessRequests: React.FC<AccessRequestsProps> = ({
  requests,
  isLoading = false,
  onApprove,
  onReject,
}) => {
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject';
    request: AccessRequest | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    action: 'approve',
    request: null,
    isLoading: false,
  });

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const handleApprove = async (request: AccessRequest) => {
    setConfirmModal({ isOpen: true, action: 'approve', request, isLoading: false });
  };

  const handleReject = async (request: AccessRequest) => {
    setConfirmModal({ isOpen: true, action: 'reject', request, isLoading: false });
  };

  const handleConfirm = async () => {
    if (!confirmModal.request) return;

    setConfirmModal((prev) => ({ ...prev, isLoading: true }));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (confirmModal.action === 'approve') {
      onApprove?.(confirmModal.request.id);
    } else {
      onReject?.(confirmModal.request.id);
    }

    setConfirmModal({ isOpen: false, action: 'approve', request: null, isLoading: false });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[#0b1c30] mb-6">طلبات الوصول</h3>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-[#f8f9ff] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-12 shadow-sm text-center">
        <Clock size={32} className="mx-auto text-[#444651] mb-3" />
        <p className="text-sm font-medium text-[#0b1c30]">لا توجد طلبات معلقة</p>
        <p className="text-sm text-[#444651] mt-1">تمت معالجة جميع طلبات الوصول</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm">
        {/* Header */}
        <div className="border-b border-[#e2e8f0] p-6">
          <h3 className="text-lg font-semibold text-[#0b1c30]">طلبات الوصول</h3>
          <p className="text-sm text-[#444651] mt-1">
            <span className="num">{pendingRequests.length}</span> طلب معلق
          </p>
        </div>

        {/* Requests List */}
        <div className="divide-y divide-[#e2e8f0]">
          {pendingRequests.map((request) => (
            <div key={request.id} className="p-6 hover:bg-[#f8f9ff] transition-colors" dir="rtl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-[#0b1c30]">{request.distributorName}</p>
                  <p className="text-sm text-[#444651] mt-1">
                    طُلب في {formatDateOnly(request.requestedAt)}
                  </p>

                  {/* Request Details */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-[#eff4ff] rounded-lg p-3 border border-[#dce1ff]">
                      <p className="text-xs text-[#00236f] font-semibold mb-1">الائتمان المطلوب</p>
                      <p className="text-lg font-bold num text-[#00236f]" dir="ltr">
                        {'د.ل '}{formatAmount(request.requestedCredit)}
                      </p>
                    </div>
                    <div className="bg-[#f8f9ff] rounded-lg p-3 border border-[#e2e8f0]">
                      <p className="text-xs text-[#444651] font-semibold mb-1">العمولة المطلوبة</p>
                      <p className="text-lg font-bold num text-[#0b1c30]">
                        {request.requestedCommission}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mr-4">
                  <button
                    onClick={() => handleApprove(request)}
                    className="px-4 py-2 bg-[#0f766e] text-white text-sm font-medium rounded-lg hover:bg-[#0d6460] transition-colors flex items-center gap-2"
                  >
                    <Check size={16} />
                    قبول
                  </button>
                  <button
                    onClick={() => handleReject(request)}
                    className="px-4 py-2 bg-[#b91c1c] text-white text-sm font-medium rounded-lg hover:bg-[#991b1b] transition-colors flex items-center gap-2"
                  >
                    <X size={16} />
                    رفض
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        action={confirmModal.action}
        request={confirmModal.request}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, action: 'approve', request: null, isLoading: false })}
        isLoading={confirmModal.isLoading}
      />
    </>
  );
};
