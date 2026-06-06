import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  SlidersHorizontal,
  Package,
  BarChart3,
  FileUp,
  Users2,
  Link2,
  ShoppingCart,
  Plug2,
  Store,
  Truck,
  Wallet,
  Code2,
} from 'lucide-react';

export type NavItem = {
  label: string;
  path: string;
  icon: any;
  roles: string[];
  badge?: number;   // optional notification / count badge
};

const ALL_NAV_ITEMS: NavItem[] = [
  /* ── Admin ─────────────────────────────────────────────────────────── */
  { label: 'لوحة التحكم',   path: '/dashboard',            icon: LayoutDashboard,   roles: ['admin'] },
  { label: 'المؤسسات',      path: '/admin/organizations',  icon: Building2,         roles: ['admin'] },
  { label: 'المستخدمون',    path: '/admin/users',          icon: Users,             roles: ['admin'] },
  { label: 'العمليات',      path: '/transactions',         icon: Receipt,           roles: ['admin'] },
  { label: 'الإعدادات',     path: '/settings',             icon: SlidersHorizontal, roles: ['admin'] },

  /* ── Provider ───────────────────────────────────────────────────────── */
  { label: 'لوحة التحكم',   path: '/provider/dashboard',   icon: LayoutDashboard,   roles: ['provider'] },
  { label: 'المنتجات',      path: '/provider/products',    icon: Package,           roles: ['provider'] },
  { label: 'المخزون',       path: '/provider/inventory',   icon: BarChart3,         roles: ['provider'] },
  { label: 'رفع البطاقات',  path: '/provider/upload',      icon: FileUp,            roles: ['provider'] },
  { label: 'الموزعون',      path: '/provider/distributors',icon: Users2,            roles: ['provider'] },
  { label: 'طلبات الربط',   path: '/provider/requests',    icon: Link2,             roles: ['provider'] },
  { label: 'العمليات',      path: '/provider/transactions', icon: Receipt,          roles: ['provider'] },
  { label: 'الإعدادات',     path: '/provider/settings',    icon: SlidersHorizontal, roles: ['provider'] },

  /* ── Distributor ────────────────────────────────────────────────────── */
  { label: 'لوحة التحكم',   path: '/distributor/dashboard',         icon: LayoutDashboard,   roles: ['distributor'] },
  { label: 'شراء البطاقات', path: '/distributor/purchase',           icon: ShoppingCart,      roles: ['distributor'] },
  { label: 'ربط مزود',      path: '/distributor/connect-provider',  icon: Plug2,             roles: ['distributor'] },
  { label: 'المزودون',      path: '/distributor/providers',         icon: Store,             roles: ['distributor'] },
  { label: 'العمليات',      path: '/distributor/transactions',      icon: Receipt,           roles: ['distributor'] },
  { label: 'تتبع التنفيذ',  path: '/distributor/fulfillment',       icon: Truck,             roles: ['distributor'] },
  { label: 'حسابات المزود', path: '/distributor/provider-accounts', icon: Wallet,            roles: ['distributor'] },
  { label: 'واجهة API',     path: '/distributor/api',               icon: Code2,             roles: ['distributor'] },
  { label: 'الإعدادات',     path: '/distributor/settings',          icon: SlidersHorizontal, roles: ['distributor'] },
];

/**
 * Returns navigation items for the given user role, filtered from the master list.
 */
export function useNavigationItems(userRole: string | null | undefined): NavItem[] {
  if (!userRole) return [];
  return ALL_NAV_ITEMS.filter((item) => item.roles.includes(userRole));
}
