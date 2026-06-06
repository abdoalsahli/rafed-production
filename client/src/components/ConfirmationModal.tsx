import React from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export type ConfirmationType = 'approve' | 'reject' | 'edit' | 'disable';

interface ConfirmationModalProps {
  isOpen: boolean;
  type: ConfirmationType;
  title: string;
  description: string;
  context?: {
    label: string;
    value: string;
  }[];
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const getIcon = (type: ConfirmationType) => {
  switch (type) {
    case 'approve':
      return <CheckCircle size={24} className="text-green-600" />;
    case 'reject':
      return <XCircle size={24} className="text-red-600" />;
    case 'disable':
      return <AlertCircle size={24} className="text-red-600" />;
    default:
      return <AlertCircle size={24} className="text-blue-600" />;
  }
};

const getColors = (type: ConfirmationType, isDangerous?: boolean) => {
  if (isDangerous) {
    return {
      button: 'bg-red-600 hover:bg-red-700',
      text: 'text-red-600',
    };
  }
  switch (type) {
    case 'approve':
      return {
        button: 'bg-green-600 hover:bg-green-700',
        text: 'text-green-600',
      };
    case 'reject':
    case 'disable':
      return {
        button: 'bg-red-600 hover:bg-red-700',
        text: 'text-red-600',
      };
    default:
      return {
        button: 'bg-blue-600 hover:bg-blue-700',
        text: 'text-blue-600',
      };
  }
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  type,
  title,
  description,
  context,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  isDangerous = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const colors = getColors(type, isDangerous);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
          {/* Header */}
          <div className="flex items-center gap-3 p-6 border-b border-gray-200">
            {getIcon(type)}
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">{description}</p>

            {/* Context */}
            {context && context.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {context.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600">
                      {item.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-gray-200">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 ${colors.button}`}
            >
              {isLoading ? 'جاري المعالجة…' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
