import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  INNOButton,
  INNOPage,
  INNOState,
  INNOStatus,
} from '@inno/ui';
import {
  getPlatformNotifications,
  markAllPlatformNotificationsRead,
  updatePlatformNotification,
} from '../api/client';
import type { PlatformNotificationItem } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';

function relativeTime(value: string) {
  const date = new Date(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function moduleLabel(value: string) {
  if (value === 'helpdesk') return 'Helpdesk';
  if (value === 'devices') return 'Devices';
  if (value === 'assets') return 'Assets';
  if (value === 'meeting') return 'Meeting';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function moduleMark(value: string) {
  if (value === 'helpdesk') return 'H';
  if (value === 'devices') return 'D';
  if (value === 'assets') return 'A';
  if (value === 'meeting') return 'M';
  return 'N';
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['platform', 'notifications'],
    queryFn: () => getPlatformNotifications({ page: 1, pageSize: 25 }),
    refetchOnWindowFocus: true,
  });

  const markAllMutation = useMutation({
    mutationFn: markAllPlatformNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['platform', 'notifications'] });
    },
  });

  const openMutation = useMutation({
    mutationFn: (notification: PlatformNotificationItem) => (
      notification.isRead
        ? Promise.resolve(notification)
        : updatePlatformNotification(notification.id, true)
    ),
    onSuccess: async (_, notification) => {
      await queryClient.invalidateQueries({ queryKey: ['platform', 'notifications'] });
      navigate(notification.destinationPath);
    },
  });

  const data = query.data;

  return (
    <INNOPage
      eyebrow="Workspace"
      title="Notifications"
      description="Events from apps across INNO.One, linked back to the owning module."
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={markAllMutation.isPending}
          disabled={!data || data.unreadCount === 0}
          onClick={() => markAllMutation.mutate()}
        >
          Mark all read
        </INNOButton>
      )}
    >
      {query.isPending ? <LoadingState label="Loading notifications…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {data ? (
        <>
          <div className="notification-stat-strip" aria-label="Notification summary">
            <div>
              <span>Unread</span>
              <b>{data.unreadCount}</b>
              <small>Needs your attention</small>
            </div>
            <div>
              <span>Important</span>
              <b>{data.importantCount}</b>
              <small>Priority activity</small>
            </div>
            <div>
              <span>All</span>
              <b>{data.allCount}</b>
              <small>Personal notifications</small>
            </div>
          </div>

          <div className="notification-layout">
            <section className="notification-feed" aria-label="Notification feed">
              {data.items.length === 0 ? (
                <INNOState
                  title="You’re all caught up"
                  description="New activity from enabled INNO.One apps will appear here."
                />
              ) : (
                data.items.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={'notification-row' + (notification.isRead ? '' : ' unread')}
                    onClick={() => openMutation.mutate(notification)}
                    disabled={openMutation.isPending}
                  >
                    <span className={'notification-module-mark module-' + notification.sourceModule} aria-hidden="true">
                      {moduleMark(notification.sourceModule)}
                    </span>
                    <span className="notification-copy">
                      <span className="notification-title-line">
                        <b>{notification.title}</b>
                        {notification.isImportant ? <INNOStatus tone="warning">Important</INNOStatus> : null}
                      </span>
                      <span>{notification.message}</span>
                      <small>{moduleLabel(notification.sourceModule)}</small>
                    </span>
                    <span className="notification-time">{relativeTime(notification.createdAt)}</span>
                    {!notification.isRead ? <span className="notification-unread-dot" aria-label="Unread" /> : null}
                  </button>
                ))
              )}
            </section>

            <aside className="notification-side" aria-label="Notification information">
              <section className="prod-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>Today</h3>
                    <p>Your personal notification state.</p>
                  </div>
                  <INNOStatus tone={data.unreadCount > 0 ? 'warning' : 'success'} dot>
                    {data.unreadCount > 0 ? data.unreadCount + ' unread' : 'Caught up'}
                  </INNOStatus>
                </div>
                <div className="notification-summary-list">
                  <div><span>Unread</span><b>{data.unreadCount}</b></div>
                  <div><span>Important</span><b>{data.importantCount}</b></div>
                  <div><span>All</span><b>{data.allCount}</b></div>
                </div>
              </section>

              <section className="prod-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>Safe deep links</h3>
                    <p>Notifications never bypass destination authorization.</p>
                  </div>
                </div>
                <div className="notification-info-copy">
                  Opening a notification marks it read, then routes through the normal INNO.One permission checks for the owning app.
                </div>
              </section>
            </aside>
          </div>

          {markAllMutation.isError ? (
            <INNOState
              compact
              kind="error"
              title="Could not mark notifications read"
              description={markAllMutation.error instanceof Error ? markAllMutation.error.message : 'Please try again.'}
              action={<INNOButton variant="secondary" onClick={() => markAllMutation.mutate()}>Retry</INNOButton>}
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
