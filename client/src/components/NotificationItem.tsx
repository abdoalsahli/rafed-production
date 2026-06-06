import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type NotificationType = 'info' | 'warning' | 'critical';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  time: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationItemProps {
  notification: Notification;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const getStyles = () => {
    switch (notification.type) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          title: 'text-red-900',
          description: 'text-red-700',
          button: 'text-red-600 hover:text-red-700 hover:bg-red-100',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-600',
          title: 'text-yellow-900',
          description: 'text-yellow-700',
          button: 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          description: 'text-blue-700',
          button: 'text-blue-600 hover:text-blue-700 hover:bg-blue-100',
        };
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'critical':
        return <AlertCircle size={16} />;
      case 'warning':
        return <AlertTriangle size={16} />;
      case 'info':
      default:
        return <Info size={16} />;
    }
  };

  const styles = getStyles();

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-3 hover:shadow-sm transition-shadow`}>
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>{getIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${styles.title}`}>{notification.title}</p>
          {notification.description && (
            <p className={`text-xs mt-1 ${styles.description}`}>{notification.description}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">{notification.time}</p>

          {/* Action Button */}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={`text-xs font-medium mt-2 px-2 py-1 rounded transition-colors ${styles.button}`}
            >
              {notification.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
