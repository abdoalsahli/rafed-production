import React, { useState } from 'react';
import { RotateCcw, Trash2, Plus } from 'lucide-react';
import { SecureAPIKeyDisplay } from './SecureAPIKeyDisplay';
import { SecurityWarningBox, SecurityWarnings } from './SecurityWarningBox';
import { RegenerateKeyModal } from './RegenerateKeyModal';

export interface APIKeyInfo {
  id: string;
  key: string;
  createdAt: Date;
  lastUsedAt?: Date;
  lastUsedIP?: string;
  isActive: boolean;
}

interface SecureAPIKeyManagementProps {
  apiKeys: APIKeyInfo[];
  isLoading?: boolean;
  error?: string;
  onRegenerateKey?: (keyId: string) => Promise<void>;
  onDeleteKey?: (keyId: string) => Promise<void>;
  onCreateKey?: () => Promise<void>;
}

export const SecureAPIKeyManagement: React.FC<SecureAPIKeyManagementProps> = ({
  apiKeys,
  isLoading = false,
  error,
  onRegenerateKey,
  onDeleteKey,
  onCreateKey,
}) => {
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeKey = apiKeys.find((k) => k.isActive);
  const inactiveKeys = apiKeys.filter((k) => !k.isActive);

  const handleRegenerateClick = (keyId: string) => {
    setSelectedKeyId(keyId);
    setShowRegenerateModal(true);
  };

  const handleConfirmRegenerate = async () => {
    if (!selectedKeyId || !onRegenerateKey) return;

    setIsProcessing(true);
    try {
      await onRegenerateKey(selectedKeyId);
      setShowRegenerateModal(false);
      setSelectedKeyId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!onDeleteKey) return;
    if (!confirm('Are you sure you want to delete this API key?')) return;

    setIsProcessing(true);
    try {
      await onDeleteKey(keyId);
    } finally {
      setIsProcessing(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Error loading API keys</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">API Keys</h2>
          <p className="text-gray-600 mt-1">Manage your API keys for secure integrations</p>
        </div>
        <button
          onClick={onCreateKey}
          disabled={isLoading || isProcessing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus size={18} />
          Create New Key
        </button>
      </div>

      {/* Security Warning */}
      <SecurityWarningBox warning={SecurityWarnings.neverShareKey} />

      {/* Active Key Section */}
      {activeKey && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active API Key</h3>
            <SecureAPIKeyDisplay
              apiKey={activeKey.key}
              createdAt={activeKey.createdAt}
              lastUsedAt={activeKey.lastUsedAt}
              lastUsedIP={activeKey.lastUsedIP}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRegenerateClick(activeKey.id)}
              disabled={isLoading || isProcessing}
              className="flex items-center gap-2 px-4 py-2 border border-yellow-300 text-yellow-700 font-medium rounded-lg hover:bg-yellow-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={18} />
              Regenerate Key
            </button>
          </div>

          {/* Regeneration Warning */}
          <SecurityWarningBox warning={SecurityWarnings.keyRegenerationWarning} />
        </div>
      )}

      {/* Inactive Keys Section */}
      {inactiveKeys.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Inactive Keys</h3>
          <div className="space-y-3">
            {inactiveKeys.map((key) => (
              <div key={key.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded">
                        Inactive
                      </span>
                      <span className="text-sm text-gray-600">
                        Created {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(key.createdAt)}
                      </span>
                    </div>
                    <code className="text-sm font-mono text-gray-700">
                      {key.key.substring(0, 4)}...{key.key.substring(key.key.length - 4)}
                    </code>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={isLoading || isProcessing}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete this key"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {apiKeys.length === 0 && (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-600 font-medium">No API keys yet</p>
          <p className="text-gray-500 text-sm mt-1">Create your first API key to get started</p>
          <button
            onClick={onCreateKey}
            disabled={isLoading || isProcessing}
            className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Create API Key
          </button>
        </div>
      )}

      {/* Regenerate Modal */}
      <RegenerateKeyModal
        isOpen={showRegenerateModal}
        isLoading={isProcessing}
        onConfirm={handleConfirmRegenerate}
        onCancel={() => {
          setShowRegenerateModal(false);
          setSelectedKeyId(null);
        }}
      />

      {/* Best Practices */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-3">API Key Best Practices</h4>
        <ul className="text-sm text-blue-700 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            <span>Rotate your API keys regularly (every 90 days)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            <span>Use different keys for different applications</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            <span>Never commit API keys to version control</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            <span>Monitor your API key activity regularly</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">•</span>
            <span>Delete unused keys immediately</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
