import React from 'react';
import { AlertTriangle, TrendingUp, X } from 'lucide-react';

export interface Alert {
  id: string;
  type: 'low_inventory' | 'high_activity' | 'warning';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AlertsProps {
  alerts: Alert[];
  onDismiss?: (id: string) => void;
}

export const Alerts: React.FC<AlertsProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null;

  // Show only highest priority alert
  const priorityMap = { critical: 3, warning: 2, info: 1 };
  const highestPriorityAlert = alerts.reduce((prev, current) => {
    const prevPriority = priorityMap[prev.severity as keyof typeof priorityMap] || 0;
    const currentPriority = priorityMap[current.severity as keyof typeof priorityMap] || 0;
    return currentPriority > prevPriority ? current : prev;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle size={20} className="text-red-600" />;
      case 'warning':
        return <AlertTriangle size={20} className="text-yellow-600" />;
      default:
        return <TrendingUp size={20} className="text-blue-600" />;
    }
  };

  return (
    <div className="mb-8">
      {highestPriorityAlert && (
        <div
          className={`rounded-lg border p-4 flex items-start gap-4 ${getSeverityColor(highestPriorityAlert.severity)}`}
        >
          <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(highestPriorityAlert.severity)}</div>

          <div className="flex-1">
            <p className="font-semibold text-sm">{highestPriorityAlert.title}</p>
            <p className="text-sm mt-1 opacity-90">{highestPriorityAlert.message}</p>
            {highestPriorityAlert.action && (
              <button
                onClick={highestPriorityAlert.action.onClick}
                className="text-sm font-medium mt-2 underline hover:opacity-75 transition-opacity"
              >
                {highestPriorityAlert.action.label}
              </button>
            )}
          </div>

          <button
            onClick={() => onDismiss?.(highestPriorityAlert.id)}
            className="flex-shrink-0 p-1 hover:opacity-75 transition-opacity"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
