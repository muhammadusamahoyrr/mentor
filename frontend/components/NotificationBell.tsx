'use client';
import { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { AppNotification } from '@/types';
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/auth';

interface NotificationBellProps {
  userId?: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!userId) return;
    setNotifications(getNotificationsForUser(userId));
  }, [userId]);

  const totalUnread = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    if (userId) markAllNotificationsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-panel text-ghost hover:text-ink rounded-full transition-colors active:scale-95 tt"
      >
        <Bell className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute top-0 right-0 bg-danger text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />

          <div className="absolute right-0 mt-3 w-96 bg-card rounded-2xl shadow-2xl border border-wire z-50 overflow-hidden tt">
            <div className="p-4 border-b border-haze flex justify-between items-center bg-panel tt">
              <div>
                <h3 className="font-bold text-ink text-sm tt">Notifications</h3>
                <p className="text-[10px] font-black text-ghost uppercase tracking-widest mt-0.5 tt">
                  {totalUnread} unread
                </p>
              </div>
              <button
                onClick={() => setShowDropdown(false)}
                className="text-ghost hover:text-ink p-1 hover:bg-lift rounded-lg transition-colors tt"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-2 text-ghost tt" />
                  <p className="text-sm font-medium text-dim tt">No notifications</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-haze hover:bg-panel transition-colors tt ${!notif.read ? 'bg-brand-muted/30' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold text-sm text-ink leading-tight tt">{notif.title}</div>
                      {!notif.read && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="text-brand hover:text-brand-hover ml-2 p-1 hover:bg-brand-muted rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-dim mb-2 font-medium tt">{notif.message}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-ghost tt">
                        {new Date(notif.createdAt).toLocaleString()}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                        notif.type === 'appointment'  ? 'bg-purple-100 text-purple-700' :
                        notif.type === 'reminder'     ? 'bg-amber-100 text-amber-700' :
                        notif.type === 'file_shared'  ? 'bg-emerald-100 text-emerald-700' :
                                                        'bg-blue-100 text-blue-700'
                      }`}>
                        {notif.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-wire flex justify-end bg-panel tt">
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-ghost hover:text-brand font-bold uppercase tracking-wider transition-colors tt"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
