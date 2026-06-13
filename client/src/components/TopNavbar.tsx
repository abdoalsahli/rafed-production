import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronLeft } from 'lucide-react';
import { NavItem } from '@/hooks/useNavigationItems';

/* ── Role / portal labels (mirrors UnifiedSidebar) ──────────────────────── */
const PORTAL_LABELS: Record<string, string> = {
  admin:       'الإدارة',
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

/* ── Props ───────────────────────────────────────────────────────────────── */
interface TopNavbarProps {
  navItems:    NavItem[];
  currentPath: string;
  userName:    string | null;
  userEmail:   string | null;
  userRole:    string | null;
  onNavigate:  (path: string) => void;
  logoUrl?:    string | null;
}

/* ════════════════════════════════════════════════════════════════════════════
   TopNavbar
   ════════════════════════════════════════════════════════════════════════════ */
export function TopNavbar({
  navItems,
  currentPath,
  userName,
  userEmail,
  userRole,
  onNavigate,
  logoUrl,
}: TopNavbarProps) {
  const [query,   setQuery]   = useState('');
  const [focused, setFocused] = useState(false);
  const wrapperRef            = useRef<HTMLDivElement>(null);

  const displayName  = userName || userEmail || 'مستخدم';
  const initial      = getInitial(displayName);
  const portalLabel  = PORTAL_LABELS[userRole ?? ''] ?? 'رافد';
  const roleLabel    = ROLE_LABELS[userRole   ?? ''] ?? '';

  /* Current page — matched from navItems */
  const currentPage = navItems.find(
    (item) =>
      currentPath === item.path ||
      (item.path !== '/' && currentPath.startsWith(item.path + '/')),
  );

  /* Search results */
  const results = query.trim()
    ? navItems.filter((item) => item.label.includes(query))
    : [];

  /* Close search dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    /*
     * Three explicit sections — all in a single flex row.
     * RTL document: first DOM child = rightmost, last = leftmost.
     *
     * Section 1 (RIGHT)  : breadcrumb          — shrink-0
     * Section 2 (CENTER) : search (flex-1)     — expands to fill middle
     * Section 3 (LEFT)   : bell + user profile — shrink-0, ms-auto forces left edge
     */
    <header className="sticky top-0 z-30 flex items-center h-14 px-6 bg-white border-b border-[#e2e8f0] shrink-0">

      {/* ── Section 1 — RIGHT: breadcrumb ───────────────────────────────── */}
      <nav className="flex items-center gap-1 text-sm shrink-0 select-none">
        <span className="font-bold text-[#00236f]">رافد</span>
        <ChevronLeft size={13} className="text-[#cbd5e1] shrink-0" />
        <span className="text-[#444651]">{portalLabel}</span>
        {currentPage && (
          <>
            <ChevronLeft size={13} className="text-[#cbd5e1] shrink-0" />
            <span className="font-semibold text-[#0b1c30]">{currentPage.label}</span>
          </>
        )}
      </nav>

      {/* ── Section 2 — CENTER: search ──────────────────────────────────── */}
      <div ref={wrapperRef} className="flex-1 flex justify-center px-6 relative">
        <div className="relative w-full max-w-sm">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
          />
          <input
            type="text"
            placeholder="ابحث في الصفحات…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            className="w-full h-8 pr-8 pl-4 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-sm text-[#0b1c30] placeholder-[#94a3b8] focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f]/20 transition-colors"
          />
          {/* Search dropdown */}
          {focused && results.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-50 overflow-hidden">
              {results.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onMouseDown={() => {
                      onNavigate(item.path);
                      setQuery('');
                      setFocused(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-right hover:bg-[#eff4ff] transition-colors"
                  >
                    <Icon size={15} className="text-[#444651] shrink-0" />
                    <span className="text-[#0b1c30]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3 — LEFT: bell + user profile ───────────────────────── */}
      {/*
       * ms-auto = margin-inline-start: auto.
       * In RTL, inline-start = right, so this adds auto margin on the RIGHT
       * of this element, pushing it to the physical LEFT edge of the flex row.
       */}
      <div className="flex items-center gap-2 shrink-0 ms-auto">

        {/* Notifications bell */}
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#444651] hover:bg-[#f1f5f9] transition-colors"
          title="الإشعارات"
        >
          <Bell size={17} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-[#e2e8f0]" />

        {/* User profile — LTR internally: avatar LEFT, text RIGHT */}
        <div className="flex items-center gap-2" dir="ltr">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 select-none overflow-hidden"
            style={{ backgroundColor: logoUrl ? undefined : 'var(--rf-primary)' }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="شعار المؤسسة" className="w-full h-full object-contain" />
            ) : (
              initial
            )}
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-[#0b1c30] leading-tight">{displayName}</p>
            <p className="text-xs text-[#444651] leading-tight">{roleLabel}</p>
          </div>
        </div>

      </div>
    </header>
  );
}
