import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavItem } from '@/hooks/useNavigationItems';

/* ── Portal / role display labels ───────────────────────────────────────── */
const PORTAL_LABELS: Record<string, string> = {
  admin:       'لوحة الإدارة',
  provider:    'بوابة المزود',
  distributor: 'بوابة الموزع',
};

const ROLE_LABELS: Record<string, string> = {
  admin:       'مدير النظام',
  provider:    'مزود معتمد',
  distributor: 'موزع معتمد',
};

function getInitial(name: string | null | undefined): string {
  if (!name) return '؟';
  return name.trim().charAt(0).toUpperCase();
}

function isPathActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) return true;
  if (itemPath !== '/' && currentPath.startsWith(itemPath + '/')) return true;
  return false;
}

interface UnifiedSidebarProps {
  navItems: NavItem[];
  currentPath: string;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  logoUrl?: string | null;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

/* ════════════════════════════════════════════════════════════════════════════
   UnifiedSidebar

   IMPORTANT: do NOT extract the inner JSX into a nested component defined
   inside this function. Doing so creates a new component identity on every
   render → React unmounts + remounts → scroll position resets on navigation.
   Keep all JSX inlined directly inside the <aside> elements.
   ════════════════════════════════════════════════════════════════════════════ */
export function UnifiedSidebar({
  navItems,
  currentPath,
  userEmail,
  userName,
  userRole,
  logoUrl,
  onNavigate,
  onLogout,
}: UnifiedSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const portalLabel = PORTAL_LABELS[userRole ?? ''] ?? 'رافد';
  const roleLabel   = ROLE_LABELS[userRole ?? '']   ?? '';
  const initial     = getInitial(userName);
  const displayName = userName || userEmail || 'مستخدم';

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setMobileOpen(false);
  };

  /* ── Shared nav JSX (inlined — NOT a nested component) ──────────────── */
  const navList = navItems.map((item) => {
    const active = isPathActive(currentPath, item.path);
    const Icon   = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => handleNavClick(item.path)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 text-sm font-medium"
        style={
          active
            ? { backgroundColor: 'var(--rf-primary)', color: '#ffffff' }
            : { color: 'var(--rf-on-surface-variant)' }
        }
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--rf-surface-container-low)';
        }}
        onMouseLeave={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '';
        }}
      >
        {/*
          RTL flex-row: first child → rightmost, subsequent → leftward.
          Icon first  → appears on the RIGHT (RTL start / reading start).
          Label flex-1 → extends to the LEFT of the icon.
          Badge       → leftmost (RTL end).
        */}
        <Icon size={17} className="shrink-0 opacity-90" />
        <span className="flex-1 text-right">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span
            className="min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center leading-none"
            style={
              active
                ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }
                : { backgroundColor: 'var(--rf-error)', color: '#ffffff' }
            }
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  });

  /* ── Sidebar interior (RTL) ──────────────────────────────────────────── */
  const header = (
    /* Compact horizontal header — logo on the right (RTL start) */
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
      {/*
        RTL flex: avatar circle (first) → rightmost.
        Brand + portal label (second) → to the left of avatar.
      */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 select-none overflow-hidden"
        style={{ backgroundColor: logoUrl ? undefined : 'var(--rf-primary)' }}
      >
        {logoUrl
          ? <img src={logoUrl} alt="شعار المؤسسة" className="w-full h-full object-contain" />
          : initial
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight tracking-tight" style={{ color: 'var(--rf-primary)' }}>
          رافد
        </p>
        <p className="text-xs leading-snug truncate" style={{ color: 'var(--rf-on-surface-variant)' }}>
          {displayName}
        </p>
        <p className="text-xs leading-snug" style={{ color: 'var(--rf-on-surface-variant)', opacity: 0.7 }}>
          {portalLabel}
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="shrink-0 px-3 pb-4 pt-2 border-t border-border space-y-1">
      {/* Logout — red, icon on right (RTL: icon first → right) */}
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
        style={{ color: 'var(--rf-error)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#fef2f2')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '')}
      >
        {/* RTL: icon (first) → right, label (second) → left */}
        <LogOut size={16} className="shrink-0" />
        <span className="flex-1">تسجيل الخروج</span>
      </button>

      {/* Rights reservation */}
      <p className="text-center text-[10px] leading-relaxed pt-1" style={{ color: 'var(--rf-on-surface-variant)', opacity: 0.55 }}>
        © {new Date().getFullYear()} مستند لتقنية المعلومات
        <br />
        جميع الحقوق محفوظة
      </p>
    </div>
  );

  return (
    <>
      {/* ── Mobile hamburger ──────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 rounded-lg bg-white border border-border shadow-sm flex items-center justify-center"
          style={{ color: 'var(--rf-on-surface)' }}
          aria-label="فتح القائمة"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Desktop fixed sidebar ─────────────────────────────────────── */}
      <aside
        className="hidden lg:flex lg:flex-col fixed right-0 top-0 h-dvh bg-white border-l border-border z-40"
        style={{ width: 'var(--sidebar-width, 260px)' }}
      >
        {header}
        <nav className="sidebar-nav flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navList}
        </nav>
        {footer}
      </aside>

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed right-0 top-0 h-dvh bg-white border-l border-border z-50 lg:hidden flex flex-col"
            style={{ width: 'var(--sidebar-width, 260px)' }}
          >
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
              style={{ color: 'var(--rf-on-surface)' }}
              aria-label="إغلاق القائمة"
            >
              <X size={16} />
            </button>
            {header}
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {navList}
            </nav>
            {footer}
          </aside>
        </>
      )}
    </>
  );
}
