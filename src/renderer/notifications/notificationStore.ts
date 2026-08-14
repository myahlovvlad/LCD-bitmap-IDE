import { create } from 'zustand';

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';
export type OperationStatus = 'idle' | 'running' | 'success' | 'failure';

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  tone: NotificationTone;
  status: OperationStatus;
  source?: string;
  createdAt: string;
  updatedAt: string;
  read: boolean;
  dismissed: boolean;
  persistent: boolean;
  dedupeKey?: string;
}

export interface NotificationInput {
  title: string;
  message?: string;
  tone?: NotificationTone;
  status?: OperationStatus;
  source?: string;
  persistent?: boolean;
  dedupeKey?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  notify: (input: NotificationInput) => string;
  update: (id: string, updates: Partial<Pick<AppNotification, 'title' | 'message' | 'tone' | 'status' | 'persistent'>>) => void;
  dismiss: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const MAX_NOTIFICATION_HISTORY = 100;
let notificationSequence = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  notify: (input) => {
    const timestamp = new Date().toISOString();
    const existing = input.dedupeKey
      ? get().notifications.find((item) => item.dedupeKey === input.dedupeKey)
      : undefined;
    if (existing) {
      set((state) => ({
        notifications: state.notifications.map((item) => item.id === existing.id ? {
          ...item,
          ...input,
          tone: input.tone ?? item.tone,
          status: input.status ?? item.status,
          persistent: input.persistent ?? item.persistent,
          updatedAt: timestamp,
          read: false,
          dismissed: false
        } : item)
      }));
      return existing.id;
    }

    notificationSequence += 1;
    const id = `notification-${Date.now()}-${notificationSequence}`;
    const notification: AppNotification = {
      id,
      title: input.title,
      message: input.message,
      tone: input.tone ?? 'info',
      status: input.status ?? 'idle',
      source: input.source,
      createdAt: timestamp,
      updatedAt: timestamp,
      read: false,
      dismissed: false,
      persistent: input.persistent ?? input.tone === 'danger',
      dedupeKey: input.dedupeKey
    };
    set((state) => ({ notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATION_HISTORY) }));
    return id;
  },
  update: (id, updates) => set((state) => ({
    notifications: state.notifications.map((item) => item.id === id ? {
      ...item,
      ...updates,
      updatedAt: new Date().toISOString(),
      read: false,
      dismissed: false
    } : item)
  })),
  dismiss: (id) => set((state) => ({
    notifications: state.notifications.map((item) => item.id === id ? { ...item, dismissed: true, read: true } : item)
  })),
  markRead: (id) => set((state) => ({
    notifications: state.notifications.map((item) => item.id === id ? { ...item, read: true } : item)
  })),
  markAllRead: () => set((state) => ({
    notifications: state.notifications.map((item) => ({ ...item, read: true }))
  })),
  clear: () => set({ notifications: [] })
}));

export function notify(input: NotificationInput): string {
  return useNotificationStore.getState().notify(input);
}

export interface OperationFeedback {
  id: string;
  succeed: (title: string, message?: string) => void;
  fail: (title: string, message?: string) => void;
}

export function beginOperation(title: string, options: Pick<NotificationInput, 'message' | 'source' | 'dedupeKey'> = {}): OperationFeedback {
  const id = notify({
    title,
    ...options,
    tone: 'info',
    status: 'running',
    persistent: true
  });
  return {
    id,
    succeed: (nextTitle, message) => useNotificationStore.getState().update(id, {
      title: nextTitle,
      message,
      tone: 'success',
      status: 'success',
      persistent: false
    }),
    fail: (nextTitle, message) => useNotificationStore.getState().update(id, {
      title: nextTitle,
      message,
      tone: 'danger',
      status: 'failure',
      persistent: true
    })
  };
}

export function resetNotificationStoreForTests(): void {
  notificationSequence = 0;
  useNotificationStore.setState({ notifications: [] });
}
