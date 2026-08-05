import { useState, useEffect } from 'react';
import { Mail, Lock, Loader2, FlaskConical } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { getPostLoginRedirectPath } from '@/lib/roleRedirect';
import { trpc } from '@/lib/trpc';

export default function LoginPage() {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [isOAuth,   setIsOAuth]   = useState(false);
  const [error,     setError]     = useState('');

  const { user, isAuthenticated, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: demoStatus } = trpc.demo.isDemoLoginEnabled.useQuery(undefined, {
    retry: false,
  });
  const isDemoEnabled = demoStatus?.enabled === true;

  const demoLoginMutation = trpc.demo.loginWithDemo.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      refresh();
    },
    onError: (err: any) => {
      setError(err.message || 'فشل تسجيل الدخول التجريبي');
    },
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      refresh();
    },
    onError: (err: any) => {
      setError(err.message || 'فشل تسجيل الدخول');
    },
  });

  // Redirect after successful login
  useEffect(() => {
    const isComingFromLogout = !localStorage.getItem('manus-runtime-user-info');
    if (isAuthenticated && user && (user as any).organizationType && !isComingFromLogout) {
      const redirectPath = getPostLoginRedirectPath(user);
      setLocation(redirectPath);
    }
  }, [isAuthenticated, user, setLocation]);

  const handleOAuthLogin = () => {
    setIsOAuth(true);
    setError('');
    window.location.href = getLoginUrl();
  };

  // Redirecting state
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4" dir="rtl">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-10 w-full max-w-sm text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-4 text-[#00236f]" />
          <p className="text-[#444651] text-sm">جاري التوجيه إلى لوحة التحكم…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="w-full max-w-sm">

        {/* Brand card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8">

          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#00236f] mb-4">
              <span className="text-white font-bold text-2xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>ر</span>
            </div>
            <h1 className="text-xl font-bold text-[#0b1c30]">أهلاً بك في منصة رافد</h1>
            <p className="text-sm text-[#444651] mt-1">سجّل دخولك للمتابعة</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 bg-[#fee2e2] border border-[#fca5a5] rounded-lg">
              <p className="text-sm text-[#b91c1c]">{error}</p>
            </div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleOAuthLogin}
            disabled={isOAuth || loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm font-medium text-[#0b1c30] bg-white hover:bg-[#f8f9ff] transition-colors disabled:opacity-50 mb-5"
          >
            {isOAuth ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            الدخول بحساب Google
          </button>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e2e8f0]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-[#444651]">أو باستخدام البريد الإلكتروني</span>
            </div>
          </div>

          {/* Email form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              loginMutation.mutate({ email, password });
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-[#444651] mb-1.5">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651]" size={16} />
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loginMutation.isPending}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-[#444651] mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651]" size={16} />
                <input
                  id="password"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loginMutation.isPending}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-[#444651] cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-[#e2e8f0] text-[#00236f] focus:ring-[#00236f]"
                  disabled={loginMutation.isPending}
                />
                تذكّرني
              </label>
              <a href="#" className="text-[#00236f] hover:text-[#00164e] font-medium">
                نسيت كلمة المرور؟
              </a>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00236f] hover:bg-[#00164e] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 mt-1"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  جاري تسجيل الدخول…
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

          {/* Demo login */}
          {isDemoEnabled && (
            <>
              <div className="relative mt-6 mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e2e8f0]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-[#444651] flex items-center gap-1.5">
                    <FlaskConical size={12} className="text-[#8a96a3]" />
                    الدخول بحساب تجريبي
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => demoLoginMutation.mutate({ email: 'admin@mostanad.ly' })}
                  disabled={demoLoginMutation.isPending || loginMutation.isPending || isOAuth}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-[#c8d6e8] rounded-lg text-sm font-medium text-[#444651] bg-[#f8f9ff] hover:bg-[#f0f4ff] hover:border-[#00236f] hover:text-[#00236f] transition-colors disabled:opacity-50"
                >
                  {demoLoginMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  دخول كمزوّد (Provider)
                </button>
                <button
                  type="button"
                  onClick={() => demoLoginMutation.mutate({ email: 'admin@distributer1.ly' })}
                  disabled={demoLoginMutation.isPending || loginMutation.isPending || isOAuth}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-[#c8d6e8] rounded-lg text-sm font-medium text-[#444651] bg-[#f8f9ff] hover:bg-[#f0f4ff] hover:border-[#00236f] hover:text-[#00236f] transition-colors disabled:opacity-50"
                >
                  {demoLoginMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  دخول كموزّع (Distributor)
                </button>
              </div>
              <p className="text-center text-xs text-[#8a96a3] mt-2">للتجربة والعرض فقط — غير متاح في الإنتاج</p>
            </>
          )}

          {/* Sign up link */}
          <p className="mt-6 text-center text-xs text-[#444651]">
            ليس لديك حساب؟{' '}
            <a href="/signup" className="text-[#00236f] hover:text-[#00164e] font-semibold">
              سجّل الآن
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#444651] mt-5">
          © 2026 منصة رافد. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
}
