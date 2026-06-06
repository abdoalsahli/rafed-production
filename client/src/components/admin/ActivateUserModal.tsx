import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Organization } from '@/hooks/data/useOrganizations';
import { useState } from 'react';

interface ActivateUserModalProps {
  isOpen: boolean;
  isLoading: boolean;
  organizations: Organization[];
  onSubmit: (organizationId: number) => void;
  onClose: () => void;
}

export function ActivateUserModal({
  isOpen,
  isLoading,
  organizations,
  onSubmit,
  onClose,
}: ActivateUserModalProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const handleSubmit = () => {
    if (selectedOrgId) {
      onSubmit(parseInt(selectedOrgId));
      setSelectedOrgId('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تفعيل المستخدم</DialogTitle>
          <DialogDescription>اختر المؤسسة التي ينتمي إليها هذا المستخدم</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#444651] block mb-1.5">المؤسسة *</label>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المؤسسة" />
              </SelectTrigger>
              <SelectContent>
                {organizations?.map((org: Organization) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSubmit}
            className="w-full bg-[#00236f] hover:bg-[#00164e]"
            disabled={isLoading || !selectedOrgId}
          >
            {isLoading ? 'جاري التفعيل…' : 'تفعيل المستخدم'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
