import { useContext } from 'react';
import { AlertContext } from '../contexts/AlertContext';
import { AlertBanner } from './AlertBanner';

/**
 * AlertContainer displays a single alert at the top of the page
 * Only the highest priority alert is shown at any given time
 */
export const AlertContainer = () => {
  const context = useContext(AlertContext);

  if (!context || !context.alert) {
    return null;
  }

  const { alert, removeAlert } = context;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4">
      <div className="w-full max-w-2xl px-4">
        <AlertBanner
          alert={alert}
          onDismiss={() => removeAlert(alert.id)}
        />
      </div>
    </div>
  );
};
