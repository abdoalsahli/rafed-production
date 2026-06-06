import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface RegenerateKeyModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const RegenerateKeyModal: React.FC<RegenerateKeyModalProps> = ({
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Regenerate API Key?</h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            This will invalidate your current API key. Any applications using it will stop working immediately.
          </p>

          {/* Warning Points */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-red-900">Before you continue:</p>
            <ul className="text-sm text-red-700 space-y-1">
              <li className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>Update all applications with the new key</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>Revoke the old key from third-party services</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>This action cannot be undone</span>
              </li>
            </ul>
          </div>

          {/* Confirmation Text */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Type <code className="font-mono font-semibold text-gray-900">REGENERATE</code> to confirm:</p>
            <input
              type="text"
              placeholder="Type REGENERATE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || isLoading}
            className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing || isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Regenerating...
              </>
            ) : (
              'Regenerate Key'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
