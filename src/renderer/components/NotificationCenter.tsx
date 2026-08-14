import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, CircleAlert, Info, LoaderCircle, X } from 'lucide-react';
import type { LanguageCode } from '../types/domain';
import { type AppNotification, useNotificationStore } from '../notifications/notificationStore';

const COPY: Record<LanguageCode, {
  title: string;
  empty: string;
  markAllRead: string;
  clear: string;
  close: string;
  running: string;
  success: string;
  failure: string;
}> = {
  en: { title: 'Notifications', empty: 'No notifications yet.', markAllRead: 'Mark all read', clear: 'Clear history', close: 'Close', running: 'In progress', success: 'Completed', failure: 'Failed' },
  ru: { title: 'Уведомления', empty: 'Уведомлений пока нет.', markAllRead: 'Прочитать все', clear: 'Очистить историю', close: 'Закрыть', running: 'Выполняется', success: 'Завершено', failure: 'Ошибка' },
  zh: { title: '通知', empty: '暂无通知。', markAllRead: '全部标为已读', clear: '清除历史记录', close: '关闭', running: '进行中', success: '已完成', failure: '失败' }
};

export function NotificationCenter({ language }: { language: LanguageCode }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const clear = useNotificationStore((state) => state.clear);
  const unread = notifications.filter((item) => !item.read).length;
  const copy = COPY[language];

  useEffect(() => {
    if (open) markAllRead();
  }, [markAllRead, open]);

  return (
    <div className="notification-center">
      <button
        type="button"
        className={open ? 'notification-trigger active' : 'notification-trigger'}
        aria-label={`${copy.title}${unread ? ` (${unread})` : ''}`}
        aria-expanded={open}
        aria-controls="notification-center-panel"
        onClick={() => setOpen((value) => !value)}
        data-testid="notification-center-trigger"
      >
        <Bell size={16} />
        {unread > 0 ? <span className="notification-count" aria-hidden="true">{Math.min(unread, 99)}</span> : null}
      </button>
      {open ? (
        <section id="notification-center-panel" className="notification-panel" aria-label={copy.title}>
          <header>
            <strong>{copy.title}</strong>
            <button type="button" aria-label={copy.close} onClick={() => setOpen(false)}><X size={16} /></button>
          </header>
          <div className="notification-panel-actions">
            <button type="button" onClick={markAllRead} disabled={unread === 0}>{copy.markAllRead}</button>
            <button type="button" onClick={clear} disabled={notifications.length === 0}>{copy.clear}</button>
          </div>
          <div className="notification-history">
            {notifications.length ? notifications.map((item) => (
              <NotificationCard key={item.id} item={item} language={language} compact />
            )) : <p className="notification-empty">{copy.empty}</p>}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function NotificationViewport({ language }: { language: LanguageCode }): React.ReactElement | null {
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const visible = useMemo(() => notifications.filter((item) => !item.dismissed).slice(0, 5), [notifications]);

  useEffect(() => {
    const timers = visible
      .filter((item) => !item.persistent && item.status !== 'running')
      .map((item) => globalThis.setTimeout(() => dismiss(item.id), 5200));
    return () => timers.forEach((timer) => globalThis.clearTimeout(timer));
  }, [dismiss, visible]);

  if (visible.length === 0) return null;
  return (
    <div className="toast-viewport" aria-label={COPY[language].title}>
      {visible.map((item) => <NotificationCard key={item.id} item={item} language={language} onDismiss={() => dismiss(item.id)} />)}
    </div>
  );
}

function NotificationCard({
  item,
  language,
  compact = false,
  onDismiss
}: {
  item: AppNotification;
  language: LanguageCode;
  compact?: boolean;
  onDismiss?: () => void;
}): React.ReactElement {
  const copy = COPY[language];
  const statusLabel = item.status === 'running' ? copy.running : item.status === 'success' ? copy.success : item.status === 'failure' ? copy.failure : '';
  return (
    <article
      className={`${compact ? 'notification-card compact' : `toast toast-${item.tone}`}`}
      role={item.tone === 'danger' ? 'alert' : 'status'}
      aria-live={item.tone === 'danger' ? 'assertive' : 'polite'}
      data-notification-status={item.status}
      data-notification-source={item.source}
    >
      <span className="notification-icon" aria-hidden="true">{iconFor(item)}</span>
      <div className="notification-content">
        <strong>{item.title}</strong>
        {item.message ? <p>{item.message}</p> : null}
        <small>
          {statusLabel}{statusLabel && item.source ? ' · ' : ''}{item.source ?? ''}
          {(statusLabel || item.source) ? ' · ' : ''}{new Date(item.updatedAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : language, { hour: '2-digit', minute: '2-digit' })}
        </small>
      </div>
      {onDismiss ? <button type="button" className="notification-dismiss" aria-label={copy.close} onClick={onDismiss}><X size={15} /></button> : null}
    </article>
  );
}

function iconFor(item: AppNotification): React.ReactElement {
  if (item.status === 'running') return <LoaderCircle size={18} className="notification-spinner" />;
  if (item.tone === 'success') return <CheckCircle2 size={18} />;
  if (item.tone === 'warning') return <AlertTriangle size={18} />;
  if (item.tone === 'danger') return <CircleAlert size={18} />;
  return <Info size={18} />;
}
