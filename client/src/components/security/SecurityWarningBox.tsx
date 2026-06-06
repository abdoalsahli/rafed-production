import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

export interface SecurityWarning {
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  details?: string[];
}

interface SecurityWarningBoxProps {
  warning: SecurityWarning;
}

const warningConfig = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    titleColor: 'text-red-900',
    textColor: 'text-red-700',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    titleColor: 'text-yellow-900',
    textColor: 'text-yellow-700',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Shield,
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    textColor: 'text-blue-700',
  },
};

export const SecurityWarningBox: React.FC<SecurityWarningBoxProps> = ({ warning }) => {
  const config = warningConfig[warning.type];
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`flex-shrink-0 mt-0.5 ${config.iconColor}`} size={20} />

        <div className="flex-1">
          <p className={`font-semibold ${config.titleColor}`}>{warning.title}</p>
          <p className={`text-sm mt-1 ${config.textColor}`}>{warning.message}</p>

          {warning.details && warning.details.length > 0 && (
            <ul className={`text-sm mt-2 space-y-1 ${config.textColor}`}>
              {warning.details.map((detail, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-semibold">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Pre-configured security warnings
 */
export const SecurityWarnings = {
  neverShareKey: {
    type: 'critical' as const,
    title: 'Never share your API key',
    message: 'Your API key is like a password. Anyone with this key can access your account.',
    details: [
      'Do not share it in public repositories or forums',
      'Do not commit it to version control',
      'Do not send it via email or chat',
      'Treat it like a password - keep it secret',
    ],
  },

  keyRegenerationWarning: {
    type: 'warning' as const,
    title: 'Regenerating will invalidate current key',
    message: 'Any applications using the current API key will stop working immediately.',
    details: [
      'Update all applications with the new key',
      'Revoke old key from any third-party services',
      'This action cannot be undone',
    ],
  },

  unusedKeyWarning: {
    type: 'info' as const,
    title: 'This API key has not been used',
    message: 'Consider regenerating unused keys for better security hygiene.',
  },

  oldKeyWarning: {
    type: 'warning' as const,
    title: 'This API key is older than 90 days',
    message: 'Consider rotating old keys regularly for better security.',
  },
};
