import { useAlert } from '../hooks/useAlert';

/**
 * Common alert scenarios for the distributor dashboard
 * Priority levels: 1 = critical (highest), 2 = warning, 3 = info (lowest)
 */

export const useAlertUtils = () => {
  const alert = useAlert();

  return {
    /**
     * Show no inventory alert (Priority 1 - Critical)
     * @param providerName Name of the provider with no inventory
     */
    noInventory: (providerName: string) => {
      alert.critical(
        'No Inventory Available',
        `${providerName} has no cards available. Please contact them to restock or select another provider.`,
        1, // Priority 1 - highest
        {
          label: 'View Providers',
          onClick: () => {
            window.location.href = '/distributor/providers';
          },
        },
      );
    },

    /**
     * Show low balance warning (Priority 2)
     * @param balance Current wallet balance
     * @param threshold Minimum balance threshold
     */
    lowBalance: (balance: number, threshold: number = 1000) => {
      alert.warning(
        'Low Wallet Balance',
        `Your wallet balance is ${balance.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        })}. Please top up to continue transactions.`,
        2, // Priority 2
        {
          label: 'Top Up Now',
          onClick: () => {
            window.location.href = '/distributor/wallet';
          },
        },
      );
    },

    /**
     * Show API connection issue (Priority 1 - Critical)
     */
    apiError: () => {
      alert.critical(
        'API Connection Issue',
        'Unable to connect to the service. Please check your internet connection and try again.',
        1, // Priority 1 - critical
        {
          label: 'Retry',
          onClick: () => {
            window.location.reload();
          },
        },
      );
    },

    /**
     * Show API rate limit warning (Priority 3)
     */
    rateLimitWarning: () => {
      alert.warning(
        'Rate Limit Approaching',
        'You are approaching your API rate limit. Please slow down your requests to avoid service interruption.',
        3, // Priority 3 - lowest
      );
    },

    /**
     * Show pending approval info (Priority 3)
     */
    pendingApproval: (providerName: string) => {
      alert.info(
        'Pending Approval',
        `Your access request to ${providerName} is pending approval. You will be notified once it's approved.`,
        3, // Priority 3 - lowest
      );
    },

    /**
     * Show successful action (Priority 3)
     */
    success: (title: string, message: string) => {
      alert.info(title, message, 3); // Priority 3 - lowest
    },

    /**
     * Show credit limit warning (Priority 2)
     */
    creditLimitWarning: (used: number, limit: number) => {
      const percentage = (used / limit) * 100;
      alert.warning(
        'Credit Limit Warning',
        `You have used ${percentage.toFixed(0)}% of your credit limit (${used.toLocaleString()} / ${limit.toLocaleString()}).`,
        2, // Priority 2
      );
    },

    /**
     * Show credit limit exceeded (Priority 1 - Critical)
     */
    creditLimitExceeded: () => {
      alert.critical(
        'Credit Limit Exceeded',
        'You have reached your credit limit. Please contact support to increase your limit.',
        1, // Priority 1 - critical
        {
          label: 'Contact Support',
          onClick: () => {
            window.open('mailto:support@example.com');
          },
        },
      );
    },

    /**
     * Show transaction failed (Priority 1 - Critical)
     */
    transactionFailed: (reason: string) => {
      alert.critical(
        'Transaction Failed',
        `Your transaction could not be completed. Reason: ${reason}`,
        1, // Priority 1 - critical
      );
    },

    /**
     * Show maintenance mode (Priority 1 - Critical)
     */
    maintenanceMode: () => {
      alert.critical(
        'System Maintenance',
        'The system is currently under maintenance. Please try again later.',
        1, // Priority 1 - critical
      );
    },
  };
};
