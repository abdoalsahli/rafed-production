import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Notification, NotificationItem } from './NotificationItem';

interface NotificationsDropdownProps {
  notifications?: Notification[];
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  notifications = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const hasNotifications = notifications.length > 0;

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-gray-600" />
        {hasNotifications && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          </div>

          {/* Notifications List */}
          {hasNotifications ? (
            <div className="max-h-96 overflow-y-auto">
              <div className="p-3 space-y-3">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">لا توجد إشعارات بعد</p>
            </div>
          )}

          {/* Footer */}
          {hasNotifications && (
            <div className="px-4 py-3 border-t border-gray-200">
              <button className="text-xs font-medium text-[#00236f] hover:text-[#00164e] transition-colors">
                عرض جميع الإشعارات
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
