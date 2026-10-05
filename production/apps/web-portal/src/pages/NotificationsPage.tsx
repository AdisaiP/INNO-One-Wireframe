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
import { useI18n as useStep45NI18n } from '@inno/i18n';

function relativeTime(
  value: string,
  locale: 'en-US' | 'th-TH',
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const date = new Date(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('common.step45n.notifications.time.now');
  if (minutes < 60) return t('common.step45n.notifications.time.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.step45n.notifications.time.hours', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('common.step45n.notifications.time.days', { count: days });
  const formatLocale = locale === 'th-TH' ? 'th-TH-u-ca-gregory-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(formatLocale, { month: 'short', day: 'numeric' }).format(date);
}

function moduleMark(value: string) {
  if (value === 'helpdesk') return 'H';
  if (value === 'devices') return 'D';
  if (value === 'assets') return 'A';
  if (value === 'meeting') return 'M';
  return 'N';
}

export function NotificationsPage() {
  const { t: t45n, locale } = useStep45NI18n();
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
      eyebrow={t45n('navigation.workspace')}
      title={t45n('navigation.notifications')}
      description={t45n('common.step45n.notifications.eventsFromAppsAcrossInnoOneLinkedBack')}
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={markAllMutation.isPending}
          disabled={!data || data.unreadCount === 0}
          onClick={() => markAllMutation.mutate()}
        >
          {t45n('common.step45n.notifications.markAllRead')}</INNOButton>
      )}
    >
      {query.isPending ? <LoadingState label={t45n('common.step45n.notifications.loadingNotifications')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {data ? (
        <>
          <div className="notification-layout">
            <section className="notification-feed" aria-label={t45n('common.step45n.notifications.notificationFeed')}>
              {data.items.length === 0 ? (
                <INNOState
                  title={t45n('common.step45n.notifications.youReAllCaughtUp')}
                  description={t45n('common.step45n.notifications.newActivityFromEnabledInnoOneAppsWill')}
                />
              ) : (
                data.items.map((notification) => {
                  const contentLang = notification.contentLocale === 'th-TH' ? 'th' : 'en';
                  return (
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
                        <b lang={contentLang}>{notification.title}</b>
                        {notification.isImportant ? <INNOStatus tone="warning">{t45n('common.step45n.notifications.important')}</INNOStatus> : null}
                      </span>
                      <span lang={contentLang}>{notification.message}</span>
                    </span>
                    <span className="notification-time">{relativeTime(notification.createdAt, locale, t45n)}</span>
                  </button>
                  );
                })
              )}
            </section>

            <aside className="notification-side" aria-label={t45n('common.step45n.notifications.notificationInformation')}>
              <section className="prod-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>{t45n('common.step45n.notifications.today')}</h3>
                    <p>{t45n('common.step45n.notifications.yourPersonalNotificationState')}</p>
                  </div>
                  <INNOStatus tone={data.unreadCount > 0 ? 'warning' : 'success'} dot>
                    {data.unreadCount > 0
                      ? t45n('common.step45n.notifications.unreadCount', { count: data.unreadCount })
                      : t45n('common.step45n.notifications.caughtUp')}
                  </INNOStatus>
                </div>
                <div className="notification-summary-list">
                  <div><span>{t45n('common.step45n.notifications.unread')}</span><b>{data.unreadCount}</b></div>
                  <div><span>{t45n('common.step45n.notifications.important')}</span><b>{data.importantCount}</b></div>
                  <div><span>{t45n('admin.step45n.adminAccessScopeEdit.all')}</span><b>{data.allCount}</b></div>
                </div>
              </section>

              <section className="prod-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>{t45n('common.step45n.notifications.safeDeepLinks')}</h3>
                    <p>{t45n('common.step45n.notifications.notificationsNeverBypassDestinationAuthorization')}</p>
                  </div>
                </div>
                <div className="notification-info-copy">
                  {t45n('common.step45n.notifications.openingANotificationMarksItReadThenRoutes')}</div>
              </section>
            </aside>
          </div>

          {markAllMutation.isError ? (
            <INNOState
              compact
              kind="error"
              title={t45n('common.step45n.notifications.couldNotMarkNotificationsRead')}
              description={markAllMutation.error instanceof Error ? markAllMutation.error.message : t45n('common.step45n.notifications.pleaseTryAgain')}
              action={<INNOButton variant="secondary" onClick={() => markAllMutation.mutate()}>{t45n('common.step45n.notifications.retry')}</INNOButton>}
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
