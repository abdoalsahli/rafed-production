import { useContext } from 'react';
import { AlertContext, Alert, AlertType, AlertPriority } from '../contexts/AlertContext';

export const useAlert = () => {
  const context = useContext(AlertContext);

  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }

  const { addAlert, removeAlert, clearAlerts, alert } = context;

  return {
    alert,
    addAlert,
    removeAlert,
    clearAlerts,
    // Convenience methods with priority
    warning: (title: string, message: string, priority: AlertPriority = 3, action?: Alert['action']) =>
      addAlert({ type: 'warning', title, message, priority, action }),
    critical: (title: string, message: string, priority: AlertPriority = 1, action?: Alert['action']) =>
      addAlert({ type: 'critical', title, message, priority, action }),
    info: (title: string, message: string, priority: AlertPriority = 3, action?: Alert['action']) =>
      addAlert({ type: 'info', title, message, priority, action }),
  };
};
