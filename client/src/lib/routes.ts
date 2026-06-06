/**
 * Application Routes Configuration
 * Centralized route definitions for easy management and future expansion
 */

export const ROUTES = {
  // Dashboard Routes
  DISTRIBUTOR_DASHBOARD: '/dashboard',
  
  // Future routes can be added here
  // PROVIDER_DASHBOARD: '/provider-dashboard',
  // ADMIN_DASHBOARD: '/admin',
  // TRANSACTIONS: '/transactions',
  // REPORTS: '/reports',
  // SETTINGS: '/settings',
  
  // Auth Routes
  // LOGIN: '/login',
  // LOGOUT: '/logout',
} as const;

/**
 * Navigation items for sidebar/menu
 * Used to generate navigation links dynamically
 */
export const NAVIGATION_ITEMS = [
  {
    label: 'Distributor Dashboard',
    path: ROUTES.DISTRIBUTOR_DASHBOARD,
    icon: 'dashboard',
  },
  // Future navigation items
  // {
  //   label: 'Transactions',
  //   path: ROUTES.TRANSACTIONS,
  //   icon: 'transactions',
  // },
  // {
  //   label: 'Reports',
  //   path: ROUTES.REPORTS,
  //   icon: 'reports',
  // },
  // {
  //   label: 'Settings',
  //   path: ROUTES.SETTINGS,
  //   icon: 'settings',
  // },
] as const;
