'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { collection, query, orderBy, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
}

const NOTIFICATION_READ_KEY = 'lastNotificationReadTimestamp';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications: Notification[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Notification));

      const lastReadTimestamp = parseInt(localStorage.getItem(NOTIFICATION_READ_KEY) || '0', 10);
      const newUnreadCount = fetchedNotifications.filter(
        n => n.createdAt && n.createdAt.toMillis() > lastReadTimestamp
      ).length;
      
      // Show toast only for new notifications that appeared after the component mounted
      if (notifications.length > 0 && fetchedNotifications.length > notifications.length) {
          const newNotification = fetchedNotifications[0];
           if (newNotification && newNotification.createdAt.toMillis() > (notifications[0]?.createdAt.toMillis() || 0)) {
               toast({
                    title: newNotification.title,
                    description: newNotification.body,
               });
           }
      }
      
      setNotifications(fetchedNotifications);
      setUnreadCount(newUnreadCount);

    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Mark all as read when opening the popover
      localStorage.setItem(NOTIFICATION_READ_KEY, Date.now().toString());
      setUnreadCount(0);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-transparent border-white/50 text-white hover:bg-white/10 hover:text-white">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-xs items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 mr-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Notifications</h4>
            <p className="text-sm text-muted-foreground">
              You have {notifications.length} recent notifications.
            </p>
          </div>
          <div className="grid gap-2">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="grid grid-cols-[25px_1fr] items-start pb-4 last:pb-0"
                >
                  <span className="flex h-2 w-2 translate-y-1 rounded-full bg-sky-500" />
                  <div className="grid gap-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {notification.body}
                    </p>
                  </div>
                </div>
              ))
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No new notifications.</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
