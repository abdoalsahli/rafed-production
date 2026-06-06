import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

interface SecureAPIKeyDisplayProps {
  apiKey: string;
  createdAt: Date;
  lastUsedAt?: Date;
  lastUsedIP?: string;
  onCopy?: () => void;
}

export const SecureAPIKeyDisplay: React.FC<SecureAPIKeyDisplayProps> = ({
  apiKey,
  createdAt,
  lastUsedAt,
  lastUsedIP,
  onCopy,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const maskAPIKey = (key: string): string => {
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    onCopy?.();
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ar-LY-u-nu-latn', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const displayKey = isVisible ? apiKey : maskAPIKey(apiKey);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      {/* API Key Display */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">API Key</label>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg p-4">
          <code className="flex-1 text-sm font-mono text-gray-900 break-all">{displayKey}</code>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Show/Hide Toggle */}
            <button
              onClick={() => setIsVisible(!isVisible)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title={isVisible ? 'Hide API key' : 'Show API key'}
            >
              {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
              title="Copy API key"
            >
              {isCopied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {isVisible ? '✓ Visible' : '✓ Masked for security'}
        </p>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        {/* Created At */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
            Created
          </p>
          <p className="text-sm text-gray-900">{formatDate(createdAt)}</p>
        </div>

        {/* Last Used */}
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
            Last Used
          </p>
          {lastUsedAt ? (
            <p className="text-sm text-gray-900">{formatDate(lastUsedAt)}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">Never used</p>
          )}
        </div>
      </div>

      {/* Activity Info */}
      {lastUsedIP && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-2">
            Last Activity
          </p>
          <p className="text-sm text-blue-900">
            Last used from IP: <code className="font-mono font-semibold">{lastUsedIP}</code>
          </p>
          {lastUsedAt && (
            <p className="text-xs text-blue-700 mt-1">
              {formatDate(lastUsedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
