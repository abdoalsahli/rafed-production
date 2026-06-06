import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Organization, CreateOrganizationInput, UpdateOrganizationInput } from '@/hooks/data/useOrganizations';
import { useState, useEffect } from 'react';

interface OrganizationFormProps {
  organization?: Organization | null;
  isLoading: boolean;
  onSubmit: (data: CreateOrganizationInput | UpdateOrganizationInput) => void;
  onCancel: () => void;
}

export function OrganizationForm({
  organization,
  isLoading,
  onSubmit,
  onCancel,
}: OrganizationFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    type: 'provider' | 'distributor' | 'internal';
    status: 'active' | 'suspended';
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
  }>({
    name: '',
    type: 'provider',
    status: 'active',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name:          organization.name,
        type:          organization.type,
        status:        organization.status,
        contactPerson: organization.contactPerson || '',
        email:         organization.email         || '',
        phone:         organization.phone         || '',
        address:       organization.address       || '',
        notes:         organization.notes         || '',
      });
    }
  }, [organization]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (organization) {
      onSubmit({
        id:            organization.id,
        name:          formData.name,
        status:        formData.status,
        contactPerson: formData.contactPerson,
        email:         formData.email,
        phone:         formData.phone,
        address:       formData.address,
        notes:         formData.notes,
      });
    } else {
      onSubmit({
        name:          formData.name,
        type:          formData.type,
        contactPerson: formData.contactPerson,
        email:         formData.email,
        phone:         formData.phone,
        address:       formData.address,
        notes:         formData.notes,
      });
    }
  };

  const labelClass = 'text-sm font-medium text-[#444651] block mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>الاسم *</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="اسم المؤسسة"
          required
        />
      </div>

      {!organization && (
        <div>
          <label className={labelClass}>النوع *</label>
          <Select
            value={formData.type}
            onValueChange={(value: any) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provider">مزود</SelectItem>
              <SelectItem value="distributor">موزع</SelectItem>
              <SelectItem value="internal">داخلي / إداري</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {organization && (
        <div>
          <label className={labelClass}>الحالة</label>
          <Select
            value={formData.status}
            onValueChange={(value: any) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">نشطة</SelectItem>
              <SelectItem value="suspended">موقوفة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className={labelClass}>جهة الاتصال</label>
        <Input
          value={formData.contactPerson}
          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
          placeholder="اسم جهة الاتصال"
        />
      </div>

      <div>
        <label className={labelClass}>البريد الإلكتروني</label>
        <Input
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="البريد الإلكتروني"
          type="email"
          dir="ltr"
        />
      </div>

      <div>
        <label className={labelClass}>الهاتف</label>
        <Input
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="رقم الهاتف"
          dir="ltr"
        />
      </div>

      <div>
        <label className={labelClass}>العنوان</label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="العنوان"
        />
      </div>

      <div>
        <label className={labelClass}>ملاحظات</label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="ملاحظات إضافية"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1 bg-[#00236f] hover:bg-[#00164e]" disabled={isLoading}>
          {isLoading
            ? (organization ? 'جاري التحديث…' : 'جاري الإنشاء…')
            : (organization ? 'تحديث' : 'إنشاء')}
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
