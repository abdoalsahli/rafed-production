import React from 'react';
import { formatDateTime } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Bell, CheckCircle, AlertTriangle } from 'lucide-react';

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
  relatedEntityId?: number;
  relatedEntityType?: string;
}

export interface NotificationsPanelProps {
  notifications: Notification[];
  isLoading?: boolean;
  error?: string | null;
  unreadCount?: number;
  onMarkAsRead?: (notificationId: string) => Promise<void>;
  onMarkAllAsRead?: () => Promise<void>;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-[#0f766e]" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-[#b45309]" />;
    case 'error':
      return <AlertCircle className="h-5 w-5 text-[#b91c1c]" />;
    default:
      return <Bell className="h-5 w-5 text-[#00236f]" />;
  }
};

const getNotificationBgColor = (type: string, read: boolean) => {
  if (read) return 'bg-[#f8f9ff]';
  switch (type) {
    case 'success': return 'bg-[#ccfbf1]';
    case 'warning': return 'bg-[#fef3c7]';
    case 'error':   return 'bg-[#fee2e2]';
    default:        return 'bg-[#eff4ff]';
  }
};

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications,
  isLoading = false,
  error = null,
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00236f]" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-[#fee2e2] border-[#fca5a5]">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#b91c1c] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[#b91c1c]">خطأ في تحميل الإشعارات</p>
            <p className="text-sm text-[#b91c1c]">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Bell className="h-12 w-12 text-[#444651] mx-auto mb-4" />
        <p className="text-[#444651] font-medium">لا توجد إشعارات</p>
        <p className="text-sm text-[#444651] mt-1">أنت على اطلاع بكل شيء!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Mark All as Read */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[#0b1c30]">الإشعارات</h3>
          {unreadCount > 0 && (
            <p className="text-sm text-[#444651]">
              <span className="num">{unreadCount}</span> غير مقروءة
            </p>
          )}
        </div>
        {unreadCount > 0 && onMarkAllAsRead && (
          <Button
            size="sm"
            variant="outline"
            onClick={onMarkAllAsRead}
          >
            تحديد الكل كمقروء
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border border-[#e2e8f0] ${getNotificationBgColor(notification.type, notification.read)}`}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${notification.read ? 'text-[#444651]' : 'font-medium text-[#0b1c30]'}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-[#444651] mt-1">
                  {formatDateTime(notification.createdAt)}
                </p>
              </div>
              {!notification.read && onMarkAsRead && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onMarkAsRead(notification.id)}
                  className="flex-shrink-0 text-[#00236f]"
                >
                  تحديد كمقروء
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPanel;
