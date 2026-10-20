import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/toast/ToastProvider';

export interface AppNotification {
  id: string;
  type: 'follow' | 'collab_invite' | 'collab_joined' | 'board_updated' | 'info';
  title: string;
  body: string;

  createdAt: string;
  read: boolean;

  link?: string;
}

interface NotificationsCtx {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  refresh: () => void;
}

const Ctx = createContext<NotificationsCtx>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: () => {},
  refresh: () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const toast = useToast();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.get<AppNotification[]>('/notifications');
      const next = res.data ?? [];
      setNotifications(next);
      const seen = seenIds.current;
      if (seen) {
        for (const n of next) {
          if (!seen.has(n.id) && !n.read) {
            toast.info(n.title, n.body);
          }
        }
      }
      seenIds.current = new Set(next.map((n) => n.id));
    } catch {

    }
  }, [toast]);

  useEffect(() => {
    void fetchNotifications();
    timerRef.current = setInterval(() => void fetchNotifications(), 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifications]);

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    apiClient.patch(`/notifications/${id}/read`).catch(() => {});
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    apiClient.patch('/notifications/read-all').catch(() => {});
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Ctx.Provider value={{ notifications, unreadCount, markAllRead, markRead, refresh: fetchNotifications }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() {
  return useContext(Ctx);
}
