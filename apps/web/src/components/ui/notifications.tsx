'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
export interface Notice {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
  createdAt: string;
  read: boolean;
  visible: boolean;
}
const Context = createContext<{
  notices: Notice[];
  notify: (message: string, tone?: Notice['tone']) => void;
  markRead: () => void;
  clear: () => void;
} | null>(null);
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function notify(message: string, tone: Notice['tone'] = 'success') {
    const id = crypto.randomUUID();
    setNotices((values) =>
      [
        {
          id,
          message,
          tone,
          createdAt: new Date().toISOString(),
          read: false,
          visible: true,
        },
        ...values,
      ].slice(0, 20),
    );
    timers.current.push(
      setTimeout(
        () =>
          setNotices((values) =>
            values.map((value) =>
              value.id === id ? { ...value, visible: false } : value,
            ),
          ),
        6000,
      ),
    );
  }
  return (
    <Context.Provider
      value={{
        notices,
        notify,
        markRead: () =>
          setNotices((values) =>
            values.map((value) => ({ ...value, read: true })),
          ),
        clear: () => setNotices([]),
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {notices
          .filter((notice) => notice.visible)
          .slice(0, 2)
          .map((notice) => (
            <div
              key={notice.id}
              className={`toast toast-${notice.tone}`}
              role={notice.tone === 'error' ? 'alert' : 'status'}
            >
              {notice.message}
              <button
                aria-label="Dismiss notification"
                onClick={() =>
                  setNotices((values) =>
                    values.map((value) =>
                      value.id === notice.id
                        ? { ...value, visible: false }
                        : value,
                    ),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
      </div>
    </Context.Provider>
  );
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('NotificationProvider is required.');
  return value;
}
