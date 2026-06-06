import React, { createContext, useState, useCallback, ReactNode } from 'react';

export type AlertType = 'warning' | 'critical' | 'info';

export type AlertPriority = 1 | 2 | 3; // 1 = highest (critical), 3 = lowest (info)

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  priority: AlertPriority; // 1 = critical (no inventory), 2 = warning (low balance), 3 = info
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AlertContextType {
  alert: Alert | null; // Only one alert at a time
  addAlert: (alert: Omit<Alert, 'id'>) => string;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

export const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<Alert | null>(null);

  const addAlert = useCallback((newAlertData: Omit<Alert, 'id'>) => {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newAlert: Alert = {
      ...newAlertData,
      id,
      dismissible: newAlertData.dismissible !== false,
    };

    // Only replace current alert if new alert has higher priority (lower number = higher priority)
    setAlert(current => {
      if (!current || newAlert.priority < current.priority) {
        return newAlert;
      }
      return current;
    });

    // Auto-dismiss info alerts after 5 seconds
    if (newAlertData.type === 'info') {
      setTimeout(() => {
        removeAlert(id);
      }, 5000);
    }

    return id;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlert(current => (current?.id === id ? null : current));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlert(null);
  }, []);

  return (
    <AlertContext.Provider value={{ alert, addAlert, removeAlert, clearAlerts }}>
      {children}
    </AlertContext.Provider>
  );
};
