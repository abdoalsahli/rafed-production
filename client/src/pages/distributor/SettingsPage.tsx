import React, { useState, useEffect } from 'react';
import { formatDateTime } from '@/lib/dateUtils';
import {
  Lock, Bell, User, Save, X, Zap, Copy, Eye, EyeOff,
  RotateCcw, AlertTriangle, Check, Building2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { LogoUpload } from '@/components/ui/LogoUpload';

/* ── types ─────────────────────────────────────────────────────────────── */
interface SettingsForm {
  fullName: string;
  email:    string;
  phone:    string;
  company:  string;
}

interface NotificationPreferences {
  transactionAlerts: boolean;
  weeklyReport:      boolean;
  securityAlerts:    boolean;
  productUpdates:    boolean;
}

/* ── shared styles ──────────────────────────────────────────────────────── */
const inputCls =
  'w-full px-4 py-2.5 rounded-lg bg-white border border-[#e2e8f0] ' +
  'focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] ' +
  'focus:outline-none transition-colors text-sm text-[#0b1c30]';

/* ── SectionCard ────────────────────────────────────────────────────────── */
function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e2e8f0]">
        <h2 className="text-sm font-bold text-[#0b1c30] flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-[#444651] mt-1">{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ── Toggle ─────────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={[
        'relative w-12 h-6 rounded-full transition-colors shrink-0',
        checked ? 'bg-[#0d9488]' : 'bg-[#e2e8f0]',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

/* ── main component ─────────────────────────────────────────────────────── */
export const SettingsPage: React.FC = () => {
  const [formData, setFormData] = useState<SettingsForm>({
    fullName: '', email: '', phone: '', company: '',
  });
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    transactionAlerts: true, weeklyReport: true, securityAlerts: true, productUpdates: false,
  });

  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [currentPassword,     setCurrentPassword]     = useState('');
  const [newPassword,         setNewPassword]         = useState('');
  const [confirmPassword,     setConfirmPassword]     = useState('');
  const [showCurrentPw,       setShowCurrentPw]       = useState(false);
  const [showNewPw,           setShowNewPw]           = useState(false);

  const [webhookUrl,        setWebhookUrl]        = useState('');
  const [showApiKey,        setShowApiKey]        = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [newKeySecret,      setNewKeySecret]      = useState<string | null>(null);
  const [copiedKey,         setCopiedKey]         = useState(false);

  /* ── queries ──────────────────────────────────────────────────────────── */
  const { data: profileData,     isLoading: profileLoading } = trpc.distributor.getProfile.useQuery();
  const { data: apiCredentials,  isLoading: credsLoading,  refetch: refetchCreds } = trpc.distributorApi.getCredentials.useQuery();
  const { data: notifPrefs } = trpc.user.getNotificationPreferences.useQuery(undefined, {
    placeholderData: { transactionAlerts: true, weeklyReport: true, securityAlerts: true, productUpdates: false },
    staleTime: 5 * 60 * 1000,
  });

  /* ── mutations ────────────────────────────────────────────────────────── */
  const uploadLogoMutation = trpc.distributor.uploadLogo.useMutation({
    onSuccess: () => { toast.success('تم رفع الشعار بنجاح'); },
    onError: (err) => { toast.error(err.message || 'فشل رفع الشعار'); },
  });

  const updateProfileMutation = trpc.distributor.updateProfile.useMutation({
    onSuccess: () => toast.success('تم حفظ الملف الشخصي'),
    onError:   (err) => toast.error(err.message || 'فشل الحفظ'),
  });
  const updateWebhookMutation = trpc.distributorApi.updateWebhookUrl.useMutation({
    onSuccess: () => { toast.success('تم حفظ رابط الـ Webhook'); refetchCreds(); },
    onError:   (err) => toast.error(err.message || 'فشل الحفظ'),
  });
  const rotateKeyMutation = trpc.distributorApi.rotateApiKey.useMutation({
    onSuccess: (data) => { setNewKeySecret(data.secret); setShowRotateConfirm(false); refetchCreds(); },
    onError:   (err) => toast.error(err.message || 'فشل تدوير المفتاح'),
  });
  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح');
      setChangePasswordModal(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    },
    onError: (err) => toast.error(err.message || 'فشل تغيير كلمة المرور'),
  });
  const updateNotifMutation = trpc.user.updateNotificationPreferences.useMutation({
    onSuccess: () => toast.success('تم حفظ تفضيلات الإشعارات'),
    onError:   (err) => toast.error(err.message || 'فشل الحفظ'),
  });

  /* ── load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (profileData)     setFormData({ fullName: profileData.fullName || '', email: profileData.email || '', phone: profileData.phone || '', company: profileData.company || '' });
  }, [profileData]);
  useEffect(() => {
    if (apiCredentials)  setWebhookUrl(apiCredentials.webhookUrl || '');
  }, [apiCredentials]);
  useEffect(() => {
    if (notifPrefs)      setNotifications(notifPrefs as NotificationPreferences);
  }, [notifPrefs]);

  /* ── handlers ─────────────────────────────────────────────────────────── */
  const handleSaveProfile  = () => updateProfileMutation.mutate(formData);
  const handleSaveWebhook  = () => updateWebhookMutation.mutate({ webhookUrl: webhookUrl || null });
  const handleRotateKey    = () => rotateKeyMutation.mutate();
  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    changePasswordMutation.mutate({ currentPassword, newPassword, confirmPassword });
  };
  const handleToggleNotif = (key: keyof NotificationPreferences) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    updateNotifMutation.mutate(updated);
  };
  const handleCopyKey = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };
  const closePasswordModal = () => {
    setChangePasswordModal(false);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
  };

  // Render sections independently — don't block the whole page on all queries

  /* ── render ───────────────────────────────────────────────────────────── */
  const FIELD_LABELS: Record<keyof SettingsForm, string> = {
    fullName: 'الاسم الكامل',
    email:    'البريد الإلكتروني',
    phone:    'رقم الهاتف',
    company:  'اسم الشركة',
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="الإعدادات"
        subtitle="إدارة حسابك وتفضيلاتك"
      />

      {/* ── Organization Logo ────────────────────────────────────────────── */}
      <SectionCard
        icon={<Building2 size={17} className="text-[#00236f]" />}
        title="شعار المؤسسة"
        subtitle="يظهر الشعار في لوحة التحكم وصفحات النظام"
      >
        <LogoUpload
          logoUrl={profileData?.logoUrl ?? null}
          isUploading={uploadLogoMutation.isPending}
          onUpload={async (dataUrl) => { await uploadLogoMutation.mutateAsync({ logoDataUrl: dataUrl }); }}
        />
      </SectionCard>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <SectionCard
        icon={<User size={17} className="text-[#00236f]" />}
        title="الملف الشخصي"
        subtitle="تحديث بياناتك الشخصية"
      >
        {profileLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-10 bg-[#e5eeff] animate-pulse rounded-lg" />)}
          </div>
        ) : (
        <div className="space-y-4">
          {(['fullName', 'email', 'phone', 'company'] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">
                {FIELD_LABELS[field]}
              </label>
              <input
                type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                value={formData[field]}
                onChange={(e) => setFormData((p) => ({ ...p, [field]: e.target.value }))}
                className={inputCls}
                placeholder={`أدخل ${FIELD_LABELS[field]}`}
              />
            </div>
          ))}
          <div className="pt-4 border-t border-[#e2e8f0]">
            <button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
            >
              <Save size={15} />
              {updateProfileMutation.isPending ? 'جاري الحفظ…' : 'حفظ الملف الشخصي'}
            </button>
          </div>
        </div>
        )}
      </SectionCard>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Lock size={17} className="text-[#00236f]" />}
        title="الأمان"
        subtitle="إدارة كلمة المرور"
      >
        <div className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
          <div>
            <h3 className="text-sm font-semibold text-[#0b1c30]">كلمة المرور</h3>
            <p className="text-xs text-[#444651] mt-0.5">تغيير كلمة مرور الدخول</p>
          </div>
          <button
            onClick={() => setChangePasswordModal(true)}
            className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-white transition-colors"
          >
            تغيير
          </button>
        </div>
      </SectionCard>

      {/* ── Webhook & API key ─────────────────────────────────────────────── */}
      <SectionCard
        icon={<Zap size={17} className="text-[#00236f]" />}
        title="Webhook ومفتاح API"
        subtitle="إعداد استقبال إشعارات المشتريات"
      >
        {credsLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-[#e5eeff] animate-pulse rounded-lg" />)}
          </div>
        ) : (
        <div className="space-y-5">
          {/* Status */}
          {apiCredentials && (
            <div className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
              <div>
                <h3 className="text-sm font-semibold text-[#0b1c30]">حالة مفتاح API</h3>
                <p className="text-xs text-[#444651] mt-0.5">
                  أُنشئ {formatDateTime(apiCredentials.createdAt)}
                  {apiCredentials.lastUsedAt ? ` · آخر استخدام ${formatDateTime(apiCredentials.lastUsedAt)}` : ''}
                </p>
              </div>
              <span className={[
                'text-xs font-semibold px-2.5 py-1 rounded-full',
                apiCredentials.status === 'active'
                  ? 'bg-[#ccfbf1] text-[#0f766e]'
                  : 'bg-[#f1f5f9] text-[#64748b]',
              ].join(' ')}>
                {apiCredentials.status === 'active' ? 'نشط' : 'غير نشط'}
              </span>
            </div>
          )}

          {/* Masked key */}
          {apiCredentials && (
            <div>
              <label className="block text-xs font-medium text-[#444651] mb-1.5">
                معرّف مفتاح API
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiCredentials.keyId}
                    readOnly
                    className={inputCls + ' bg-[#f8f9ff] font-mono'}
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651] hover:text-[#0b1c30]"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  onClick={() => handleCopyKey(apiCredentials.keyId)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff] transition-colors"
                >
                  {copiedKey ? <Check size={15} className="text-[#0f766e]" /> : <Copy size={15} />}
                  نسخ
                </button>
              </div>
              <p className="text-xs text-[#444651] mt-1">يُستخدم لتوقيع بيانات الـ Webhook</p>
            </div>
          )}

          {/* Webhook URL */}
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">
              رابط الـ Webhook
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className={inputCls}
              placeholder="https://your-domain.com/webhooks/purchases"
            />
            <p className="text-xs text-[#444651] mt-1">
              سنُرسل إشعارات إتمام المشتريات إلى هذا الرابط
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-[#e2e8f0]">
            <button
              onClick={handleSaveWebhook}
              disabled={updateWebhookMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
            >
              <Save size={15} />
              {updateWebhookMutation.isPending ? 'جاري الحفظ…' : 'حفظ رابط Webhook'}
            </button>
            {apiCredentials && (
              <button
                onClick={() => setShowRotateConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff] transition-colors"
              >
                <RotateCcw size={15} />
                تدوير مفتاح API
              </button>
            )}
          </div>

          {/* New key reveal */}
          {newKeySecret && (
            <div className="p-4 bg-[#fef3c7] border border-[#fcd34d] rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-[#b45309] mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-[#92400e]">
                  احفظ مفتاحك الجديد الآن — لن يُعرض مجدداً.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeySecret}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#fcd34d] text-sm font-mono"
                />
                <button
                  onClick={() => handleCopyKey(newKeySecret)}
                  className="px-3 py-2 rounded-lg bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a] text-sm flex items-center gap-1 transition-colors"
                >
                  {copiedKey ? <Check size={14} className="text-[#0f766e]" /> : <Copy size={14} />}
                  نسخ
                </button>
              </div>
              <button
                onClick={() => setNewKeySecret(null)}
                className="text-xs text-[#b45309] hover:underline"
              >
                حفظته — إغلاق
              </button>
            </div>
          )}
        </div>
        )}
      </SectionCard>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Bell size={17} className="text-[#00236f]" />}
        title="الإشعارات"
        subtitle="تُحفظ التفضيلات فور التبديل"
      >
        <div className="space-y-3">
          {(
            [
              { key: 'transactionAlerts', label: 'تنبيهات العمليات',  desc: 'إشعار عند حدوث عمليات' },
              { key: 'weeklyReport',      label: 'التقرير الأسبوعي', desc: 'ملخص أسبوعي لنشاطك' },
              { key: 'securityAlerts',    label: 'تنبيهات الأمان',   desc: 'الإشعارات الأمنية المهمة' },
              { key: 'productUpdates',    label: 'تحديثات المنصة',   desc: 'أخبار المميزات الجديدة' },
            ] as { key: keyof NotificationPreferences; label: string; desc: string }[]
          ).map((pref) => (
            <div
              key={pref.key}
              className="flex items-center justify-between p-4 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]"
            >
              <div>
                <h3 className="text-sm font-semibold text-[#0b1c30]">{pref.label}</h3>
                <p className="text-xs text-[#444651] mt-0.5">{pref.desc}</p>
              </div>
              <Toggle
                checked={notifications[pref.key]}
                onChange={() => handleToggleNotif(pref.key)}
                disabled={updateNotifMutation.isPending}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Rotate confirm modal ──────────────────────────────────────────── */}
      {showRotateConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0b1c30]">تدوير مفتاح API؟</h2>
              <button
                onClick={() => setShowRotateConfirm(false)}
                className="p-1.5 hover:bg-[#f8f9ff] rounded-lg"
              >
                <X size={18} className="text-[#444651]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#444651]">
                تدوير المفتاح سيُبطل المفتاح الحالي فوراً. ستتوقف عمل أي تكامل يستخدم المفتاح القديم.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowRotateConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff]"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRotateKey}
                  disabled={rotateKeyMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#ba1a1a] text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {rotateKeyMutation.isPending ? 'جاري التدوير…' : 'تدوير المفتاح'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Change password modal ─────────────────────────────────────────── */}
      {changePasswordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0b1c30]">تغيير كلمة المرور</h2>
              <button onClick={closePasswordModal} className="p-1.5 hover:bg-[#f8f9ff] rounded-lg">
                <X size={18} className="text-[#444651]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'كلمة المرور الحالية',   value: currentPassword, setter: setCurrentPassword, show: showCurrentPw, toggle: () => setShowCurrentPw((p) => !p) },
                { label: 'كلمة المرور الجديدة',   value: newPassword,     setter: setNewPassword,     show: showNewPw,     toggle: () => setShowNewPw((p) => !p) },
                { label: 'تأكيد كلمة المرور',     value: confirmPassword, setter: setConfirmPassword, show: showNewPw,     toggle: () => setShowNewPw((p) => !p) },
              ].map(({ label, value, setter, show, toggle }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-[#444651] mb-1.5">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className={inputCls + ' pe-10'}
                      placeholder={`أدخل ${label}`}
                    />
                    <button
                      type="button"
                      onClick={toggle}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444651] hover:text-[#0b1c30]"
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closePasswordModal}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff]"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] disabled:opacity-50"
                >
                  {changePasswordMutation.isPending ? 'جاري التحديث…' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
