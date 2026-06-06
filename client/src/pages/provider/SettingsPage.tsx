import React, { useState, useEffect } from 'react';
import { formatDateOnly } from '@/lib/dateUtils';
import {
  Building2, Mail, Phone, MapPin, FileText,
  Save, X, Lock, Bell, Eye, EyeOff,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';

/* ── types ─────────────────────────────────────────────────────────────── */
interface SettingsForm {
  organizationName: string;
  contactPerson:    string;
  email:            string;
  phone:            string;
  address:          string;
  notes:            string;
}

interface NotificationPreferences {
  transactionAlerts: boolean;
  weeklyReport:      boolean;
  securityAlerts:    boolean;
  productUpdates:    boolean;
}

/* ── shared input class ─────────────────────────────────────────────────── */
const inputCls =
  'w-full px-4 py-2.5 rounded-lg bg-white border border-[#e2e8f0] ' +
  'focus:border-[#00236f] focus:ring-1 focus:ring-[#00236f] ' +
  'focus:outline-none transition-colors text-sm text-[#0b1c30]';

/* ── section card wrapper ────────────────────────────────────────────────── */
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
        {subtitle && (
          <p className="text-xs text-[#444651] mt-1">{subtitle}</p>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ── Toggle ─────────────────────────────────────────────────────────────── */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
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
export const ProviderSettingsPage: React.FC = () => {
  const [formData, setFormData] = useState<SettingsForm>({
    organizationName: '',
    contactPerson:    '',
    email:            '',
    phone:            '',
    address:          '',
    notes:            '',
  });
  const [originalData, setOriginalData] = useState<SettingsForm>(formData);
  const [hasChanges,   setHasChanges]   = useState(false);

  const [notifications, setNotifications] = useState<NotificationPreferences>({
    transactionAlerts: true,
    weeklyReport:      true,
    securityAlerts:    true,
    productUpdates:    false,
  });

  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [currentPassword,     setCurrentPassword]     = useState('');
  const [newPassword,         setNewPassword]         = useState('');
  const [confirmPassword,     setConfirmPassword]     = useState('');
  const [showCurrentPw,       setShowCurrentPw]       = useState(false);
  const [showNewPw,           setShowNewPw]           = useState(false);

  /* ── queries ──────────────────────────────────────────────────────────── */
  const { data: settingsData, isLoading: settingsLoading } =
    trpc.provider.getSettings.useQuery();
  const { data: notifPrefs,   isLoading: notifLoading } =
    trpc.user.getNotificationPreferences.useQuery();

  /* ── mutations ────────────────────────────────────────────────────────── */
  const updateSettingsMutation = trpc.provider.updateSettings.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات');
      setHasChanges(false);
      setOriginalData(formData);
    },
    onError: (err) => toast.error(err.message || 'فشل حفظ الإعدادات'),
  });

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح');
      closePasswordModal();
    },
    onError: (err) => toast.error(err.message || 'فشل تغيير كلمة المرور'),
  });

  const updateNotifMutation = trpc.user.updateNotificationPreferences.useMutation({
    onSuccess: () => toast.success('تم حفظ تفضيلات الإشعارات'),
    onError:   (err) => toast.error(err.message || 'فشل حفظ التفضيلات'),
  });

  /* ── load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (settingsData) {
      const d: SettingsForm = {
        organizationName: settingsData.organizationName || '',
        contactPerson:    settingsData.contactPerson    || '',
        email:            settingsData.email            || '',
        phone:            settingsData.phone            || '',
        address:          settingsData.address          || '',
        notes:            settingsData.notes            || '',
      };
      setFormData(d);
      setOriginalData(d);
    }
  }, [settingsData]);

  useEffect(() => {
    if (notifPrefs) setNotifications(notifPrefs as NotificationPreferences);
  }, [notifPrefs]);

  /* ── handlers ─────────────────────────────────────────────────────────── */
  const handleFormChange = (field: keyof SettingsForm, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    setHasChanges(JSON.stringify(next) !== JSON.stringify(originalData));
  };

  const handleSaveSettings = () => updateSettingsMutation.mutate(formData);
  const handleReset        = () => { setFormData(originalData); setHasChanges(false); };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword, confirmPassword });
  };

  const closePasswordModal = () => {
    setChangePasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleToggleNotif = (key: keyof NotificationPreferences) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    updateNotifMutation.mutate(updated);
  };

  // Render sections independently — don't block the whole page on all queries

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 md:p-8 space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="الإعدادات"
        subtitle="إدارة ملف مؤسستك وبيانات الحساب"
      />

      {/* ── Organization Profile ──────────────────────────────────────────── */}
      <SectionCard
        icon={<Building2 size={17} className="text-[#00236f]" />}
        title="ملف المؤسسة"
        subtitle="تحديث بيانات مؤسستك كمزود"
      >
        {settingsLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 bg-[#e5eeff] animate-pulse rounded-lg" />)}
          </div>
        ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">
              اسم المؤسسة *
            </label>
            <input
              type="text"
              value={formData.organizationName}
              onChange={(e) => handleFormChange('organizationName', e.target.value)}
              className={inputCls}
              placeholder="أدخل اسم المؤسسة"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5">
              الشخص المسؤول
            </label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => handleFormChange('contactPerson', e.target.value)}
              className={inputCls}
              placeholder="اسم المسؤول"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5 flex items-center gap-1">
              <Mail size={13} /> البريد الإلكتروني
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleFormChange('email', e.target.value)}
              className={inputCls}
              placeholder="example@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5 flex items-center gap-1">
              <Phone size={13} /> رقم الهاتف
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleFormChange('phone', e.target.value)}
              className={inputCls}
              placeholder="+218 XX XXX XXXX"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5 flex items-center gap-1">
              <MapPin size={13} /> العنوان
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleFormChange('address', e.target.value)}
              className={inputCls}
              placeholder="العنوان التفصيلي"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444651] mb-1.5 flex items-center gap-1">
              <FileText size={13} /> ملاحظات
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              className={inputCls}
              placeholder="ملاحظات إضافية"
              rows={3}
            />
          </div>

          <div className="pt-4 border-t border-[#e2e8f0] flex gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending || !hasChanges}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
            >
              <Save size={15} />
              {updateSettingsMutation.isPending ? 'جاري الحفظ…' : 'حفظ التغييرات'}
            </button>
            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff] transition-colors disabled:opacity-50"
            >
              <X size={15} /> إعادة تعيين
            </button>
          </div>
        </div>
        )}
      </SectionCard>

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Lock size={17} className="text-[#00236f]" />}
        title="الأمان"
        subtitle="إدارة كلمة المرور وأمان الحساب"
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

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Bell size={17} className="text-[#00236f]" />}
        title="الإشعارات"
        subtitle="تُحفظ التفضيلات فور التبديل"
      >
        {notifLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-[#e5eeff] animate-pulse rounded-lg" />)}
          </div>
        ) : (
        <div className="space-y-3">
          {(
            [
              { key: 'transactionAlerts', label: 'تنبيهات العمليات',     desc: 'إشعار عند حدوث عمليات بيع جديدة' },
              { key: 'weeklyReport',      label: 'التقرير الأسبوعي',     desc: 'ملخص أسبوعي لنشاطك' },
              { key: 'securityAlerts',    label: 'تنبيهات الأمان',       desc: 'إشعارات الأمان المهمة' },
              { key: 'productUpdates',    label: 'تحديثات المنصة',       desc: 'أخبار المميزات الجديدة' },
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
        )}
      </SectionCard>

      {/* ── System info ───────────────────────────────────────────────────── */}
      {settingsData && (
        <SectionCard
          icon={<FileText size={17} className="text-[#00236f]" />}
          title="معلومات النظام"
          subtitle="معرّفات القراءة فقط"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'رقم المزود',     value: String(settingsData.providerId) },
              { label: 'رمز المزود',     value: settingsData.providerCode },
              { label: 'رقم المؤسسة',   value: String(settingsData.organizationId) },
              { label: 'الحالة',         value: settingsData.organizationStatus },
              { label: 'تاريخ الإنشاء', value: settingsData.createdAt ? formatDateOnly(settingsData.createdAt) : 'غير متاح' },
              { label: 'آخر تحديث',     value: settingsData.updatedAt ? formatDateOnly(settingsData.updatedAt) : 'غير متاح' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
                <p className="text-xs font-medium text-[#444651] mb-1">{label}</p>
                <p className="text-sm font-mono text-[#0b1c30]">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Change Password Modal ─────────────────────────────────────────── */}
      {changePasswordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#e2e8f0] w-full max-w-md shadow-xl">
            {/* modal header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0b1c30]">تغيير كلمة المرور</h2>
              <button
                onClick={closePasswordModal}
                className="p-1.5 hover:bg-[#f8f9ff] rounded-lg transition-colors"
              >
                <X size={18} className="text-[#444651]" />
              </button>
            </div>

            {/* modal body */}
            <div className="p-6 space-y-4">
              {[
                {
                  label: 'كلمة المرور الحالية',
                  value: currentPassword,
                  setter: setCurrentPassword,
                  show: showCurrentPw,
                  toggle: () => setShowCurrentPw((p) => !p),
                },
                {
                  label: 'كلمة المرور الجديدة',
                  value: newPassword,
                  setter: setNewPassword,
                  show: showNewPw,
                  toggle: () => setShowNewPw((p) => !p),
                },
                {
                  label: 'تأكيد كلمة المرور',
                  value: confirmPassword,
                  setter: setConfirmPassword,
                  show: showNewPw,
                  toggle: () => setShowNewPw((p) => !p),
                },
              ].map(({ label, value, setter, show, toggle }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-[#444651] mb-1.5">
                    {label}
                  </label>
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
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#e2e8f0] text-[#0b1c30] text-sm font-medium hover:bg-[#f8f9ff] transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={
                    changePasswordMutation.isPending ||
                    !currentPassword || !newPassword || !confirmPassword
                  }
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
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

export default ProviderSettingsPage;
