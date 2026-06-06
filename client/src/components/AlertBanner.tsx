import React from 'react';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { Alert } from '../contexts/AlertContext';

interface AlertBannerProps {
  alert: Alert;
  onDismiss: (id: string) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, onDismiss }) => {
  const getStyles = () => {
    // Use only red for critical, yellow for warning/info
    if (alert.type === 'critical') {
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        icon: 'text-red-600',
        title: 'text-red-900',
        message: 'text-red-800',
        button: 'bg-red-600 hover:bg-red-700 text-white',
        dismissButton: 'text-red-600 hover:text-red-700',
      };
    }
    // Yellow for warning and info
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      icon: 'text-yellow-600',
      title: 'text-yellow-900',
      message: 'text-yellow-800',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      dismissButton: 'text-yellow-600 hover:text-yellow-700',
    };
  };

  const styles = getStyles();

  const getIcon = () => {
    return alert.type === 'critical' ? (
      <AlertCircle size={20} className={styles.icon} />
    ) : (
      <AlertTriangle size={20} className={styles.icon} />
    );
  };

  return (
    <div
      className={`${styles.bg} border ${styles.border} rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm`}
      role="alert"
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-semibold ${styles.title}`}>{alert.title}</h3>
        <p className={`text-sm mt-1 ${styles.message}`}>{alert.message}</p>

        {/* Action Button */}
        {alert.action && (
          <button
            onClick={alert.action.onClick}
            className={`text-sm font-medium mt-3 px-4 py-2 rounded transition-colors ${styles.button}`}
          >
            {alert.action.label}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {alert.dismissible && (
        <button
          onClick={() => onDismiss(alert.id)}
          className={`flex-shrink-0 p-1 rounded transition-colors ${styles.dismissButton}`}
          aria-label="Dismiss alert"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
