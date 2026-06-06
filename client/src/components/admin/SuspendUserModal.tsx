import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';

interface SuspendUserModalProps {
  isOpen: boolean;
  isLoading: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

export function SuspendUserModal({
  isOpen,
  isLoading,
  onSubmit,
  onClose,
}: SuspendUserModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (reason) {
      onSubmit(reason);
      setReason('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إيقاف المستخدم</DialogTitle>
          <DialogDescription>أدخل سبب الإيقاف</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#444651] block mb-1.5">السبب *</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب الإيقاف"
            />
          </div>
          <Button
            onClick={handleSubmit}
            variant="destructive"
            className="w-full"
            disabled={isLoading || !reason}
          >
            {isLoading ? 'جاري الإيقاف…' : 'إيقاف المستخدم'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
