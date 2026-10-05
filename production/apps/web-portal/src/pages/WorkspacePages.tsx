import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOIcon,
  INNOPage,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  getWorkspaceActivity,
  getWorkspaceAttention,
  getWorkspaceContinue,
  getWorkspaceHome,
} from '../api/client';
import type {
  WorkspaceActivityItem,
  WorkspaceAttentionItem,
} from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function moduleLabel(
  value: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (value === 'devices') return t('navigation.devices');
  if (value === 'helpdesk') return t('navigation.helpdesk');
  if (value === 'assets') return t('navigation.assets');
  if (value === 'reports') return t('navigation.reports');
  return value;
}
function moduleMark(value: string) {
  if (value === 'devices') return 'D';
  if (value === 'helpdesk') return 'H';
  if (value === 'assets') return 'A';
  return 'W';
}

function relativeTime(
  value: string,
  locale: 'en-US' | 'th-TH',
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const date = new Date(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('common.step45n.workspacePages.time.now');
  if (minutes < 60) return t('common.step45n.workspacePages.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.step45n.workspacePages.time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('common.step45n.workspacePages.time.daysAgo', { count: days });
  const formatLocale = locale === 'th-TH' ? 'th-TH-u-ca-gregory-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(formatLocale, { month: 'short', day: 'numeric' }).format(date);
}

function greeting(t: (key: string) => string) {
  const hour = new Date().getHours();
  if (hour < 12) return t('common.step45n.workspacePages.greetingMorning');
  if (hour < 18) return t('common.step45n.workspacePages.greetingAfternoon');
  return t('common.step45n.workspacePages.greetingEvening');
}
function severityTone(value: string): 'neutral' | 'info' | 'warning' | 'danger' {
  if (value === 'danger') return 'danger';
  if (value === 'warning') return 'warning';
  if (value === 'info') return 'info';
  return 'neutral';
}

function ActivityFeed({ items }: { items: WorkspaceActivityItem[] }) {
  const { t: t45n, locale } = useStep45NI18n();
  if (items.length === 0) {
    return <INNOState compact title={t45n('common.step45n.workspacePages.nothingToContinueYet')} description={t45n('common.step45n.workspacePages.recentResourcesWillAppearHereAsYouWork')} />;
  }

  return (
    <div className="workspace-feed">
      {items.map((item) => (
        <Link
          key={item.sourceModule + ':' + item.resourceId + ':' + item.occurredAt}
          className="workspace-feed-item"
          to={item.destinationPath}
        >
          <span className={'workspace-module-mark module-' + item.sourceModule}>{moduleMark(item.sourceModule)}</span>
          <span className="workspace-feed-copy">
            <b>{item.title}</b>
            <span>{moduleLabel(item.sourceModule, t45n)} · {item.activity}</span>
          </span>
          <small>{relativeTime(item.occurredAt, locale, t45n)}</small>
        </Link>
      ))}
    </div>
  );
}
function AttentionFeed({ items }: { items: WorkspaceAttentionItem[] }) {
  const { t: t45n, locale } = useStep45NI18n();
  if (items.length === 0) {
    return <INNOState compact title={t45n('common.step45n.workspacePages.nothingNeedsAttention')} description={t45n('common.step45n.workspacePages.thereAreNoCrossAppItemsRequiringAction')} />;
  }

  return (
    <div className="workspace-attention-list">
      {items.map((item) => (
        <Link className="workspace-attention-item" to={item.route} key={item.id}>
          <span className={'workspace-module-mark module-' + item.module}>{moduleMark(item.module)}</span>
          <span className="workspace-feed-copy">
            <span className="workspace-attention-title">
              <b>{item.title}</b>
              <INNOStatus tone={severityTone(item.severity)}>{moduleLabel(item.module, t45n)}</INNOStatus>
            </span>
            <span>{item.detail}</span>
          </span>
          <b className="workspace-attention-count">{item.count}</b>
        </Link>
      ))}
    </div>
  );
}

export function WorkspaceHomePage() {
  const { t: t45n, locale } = useStep45NI18n();
  const query = useQuery({
    queryKey: ['platform', 'workspace'],
    queryFn: getWorkspaceHome,
    refetchOnWindowFocus: true,
  });
  if (query.isPending) return <LoadingState label={t45n('common.step45n.workspacePages.loadingYourWorkspace')} />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const firstName = data.fullName.split(/\s+/)[0] || data.fullName;

  return (
    <div className="workspace-home-page">
      <section className="workspace-welcome">
        <div>
          <div className="eyebrow">{t45n('navigation.workspace')}</div>
          <h1>{greeting(t45n)}, {firstName}</h1>
          <p>{t45n('common.step45n.workspacePages.continueWhereYouLeftOffOrOpenAn')}</p>
          <div className="workspace-welcome-meta">
            <span>{data.apps.length} {t45n('common.step45n.workspacePages.availableApps')}</span>
            <span>{data.continueItems.length} {t45n('common.step45n.workspacePages.recentResources')}</span>
            <span>{data.attentionTotal} {t45n('common.step45n.workspacePages.attentionItems')}</span>
          </div>
        </div>
        <div className="workspace-welcome-art" aria-hidden="true">
          <img src="/illustrations/workspace-welcome.svg" alt="" />
        </div>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <h2>{t45n('common.step45n.workspacePages.yourApps')}</h2>
          <Link to="/apps">{t45n('common.step45n.workspacePages.allApps')}{' '}<INNOIcon token="action.next" size={13} /></Link>
        </div>
        {data.apps.length ? (
          <div className="workspace-app-grid">
            {data.apps.map((app) => (
              <Link className="workspace-app-card" to={app.route} key={app.id}>
                <span className={'workspace-app-mark module-' + app.id}>{moduleMark(app.id)}</span>
                <span><b>{app.name}</b><small>{t45n('common.step45n.search.open')}{' '}{app.name}</small></span>
              </Link>
            ))}
          </div>
        ) : (
          <INNOState compact title={t45n('common.step45n.apps.noAppsAvailable')} description={t45n('common.step45n.workspacePages.appsAppearHereWhenTheyAreEnabledAnd')} />
        )}
      </section>

      <div className="workspace-home-columns">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>{t45n('navigation.continueWorking')}</h3><p>{t45n('common.step45n.workspacePages.recentResourcesAcrossYourWorkspace')}</p></div>
            <Link to="/workspace/continue">{t45n('assets.step45n.assetsOverview.viewAll')}</Link>
          </div>
          <ActivityFeed items={data.continueItems} />
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>{t45n('navigation.needsAttention')}</h3><p>{t45n('common.step45n.workspacePages.crossAppItemsThatMayNeedActionSoon')}</p></div>
            <INNOStatus tone={data.attentionTotal ? 'warning' : 'success'}>
              {data.attentionTotal} {t45n('common.step45n.workspacePages.items')}{' '}</INNOStatus>
          </div>
          <AttentionFeed items={data.attentionItems} />
        </section>
      </div>
      <section className="prod-panel workspace-recent-panel">
        <div className="prod-panel-head">
          <div><h3>{t45n('common.step45n.workspacePages.recentActivity')}</h3><p>{t45n('common.step45n.workspacePages.resourcesYouRecentlyOpenedOrChanged')}</p></div>
          <Link to="/workspace/recent">{t45n('common.step45n.workspacePages.viewHistory')}</Link>
        </div>
        {data.recentItems.length ? (
          <INNOTableWrap>
            <table className="inno-table workspace-recent-table">
              <thead><tr><th>{t45n('common.step45n.workspacePages.item')}</th><th>{t45n('common.step45n.workspacePages.app')}</th><th>{t45n('helpdesk.step45n.ticketDetail.activity')}</th><th>{t45n('common.step45n.workspacePages.lastUsed')}</th><th>{t45n('reports.table.action')}</th></tr></thead>
              <tbody>
                {data.recentItems.map((item) => (
                  <tr key={item.sourceModule + ':' + item.resourceId + ':' + item.occurredAt}>
                    <td><b>{item.title}</b></td>
                    <td>{moduleLabel(item.sourceModule, t45n)}</td>
                    <td>{item.activity}</td>
                    <td>{relativeTime(item.occurredAt, locale, t45n)}</td>
                    <td><Link to={item.destinationPath}>{t45n('common.step45n.search.open')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <INNOState compact title={t45n('common.step45n.workspacePages.noRecentActivity')} description={t45n('common.step45n.workspacePages.yourLatestWorkspaceActivityWillAppearHere')} />
        )}
      </section>
      {data.partialFailures.length ? (
        <INNOState
          banner
          kind="partial"
          title={t45n('common.step45n.workspacePages.someWorkspaceSignalsAreTemporarilyUnavailable')}
          description={t45n('common.step45n.workspacePages.partialAvailable', { providers: data.partialFailures.join(', ') })}
        />
      ) : null}
    </div>
  );
}

export function WorkspaceContinuePage() {
  const { t: t45n, locale } = useStep45NI18n();
  const query = useQuery({
    queryKey: ['platform', 'workspace', 'continue'],
    queryFn: getWorkspaceContinue,
  });

  return (
    <INNOPage
      eyebrow={t45n('navigation.workspace')}
      title={t45n('navigation.continueWorking')}
      description={t45n('common.step45n.workspacePages.openResourcesYouWereRecentlyWorkingWithAcross')}
    >
      {query.isPending ? <LoadingState label={t45n('common.step45n.workspacePages.loadingRecentWork')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? <section className="prod-panel"><ActivityFeed items={query.data.items} /></section> : null}
    </INNOPage>
  );
}
export function WorkspaceAttentionPage() {
  const { t: t45n, locale } = useStep45NI18n();
  const query = useQuery({
    queryKey: ['platform', 'workspace', 'attention'],
    queryFn: getWorkspaceAttention,
    refetchOnWindowFocus: true,
  });

  return (
    <INNOPage
      eyebrow={t45n('navigation.workspace')}
      title={t45n('navigation.needsAttention')}
      description={t45n('common.step45n.workspacePages.crossAppItemsPrioritizedFromTheResourcesYou')}
    >
      {query.isPending ? <LoadingState label={t45n('common.step45n.workspacePages.loadingAttentionItems')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <section className="prod-panel">
            <div className="prod-panel-head">
              <div><h3>{t45n('common.step45n.workspacePages.attentionQueue')}</h3><p>{t45n('common.step45n.workspacePages.liveSignalsFromEnabledModules')}</p></div>
              <INNOStatus tone={query.data.totalCount ? 'warning' : 'success'}>{query.data.totalCount} {t45n('common.step45n.workspacePages.items')}</INNOStatus>
            </div>
            <AttentionFeed items={query.data.items} />
          </section>
          {query.data.partialFailures.length ? (
            <INNOState
              banner
              kind="partial"
              title={t45n('common.step45n.workspacePages.partialWorkspaceData')}
              description={t45n('common.step45n.workspacePages.partialAttention', { providers: query.data.partialFailures.join(', ') })}
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
export function WorkspaceRecentPage() {
  const { t: t45n, locale } = useStep45NI18n();
  const query = useQuery({
    queryKey: ['platform', 'activity'],
    queryFn: () => getWorkspaceActivity(50),
  });

  return (
    <INNOPage
      eyebrow={t45n('navigation.workspace')}
      title={t45n('common.step45n.workspacePages.recentActivity')}
      description={t45n('common.step45n.workspacePages.reviewYourLatestResourceActivityAcrossInnoOne')}
    >
      {query.isPending ? <LoadingState label={t45n('common.step45n.workspacePages.loadingRecentActivity')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data?.items.length ? (
        <section className="prod-panel">
          <INNOTableWrap>
            <table className="inno-table workspace-recent-table">
              <thead><tr><th>{t45n('common.step45n.workspacePages.item')}</th><th>{t45n('common.step45n.workspacePages.app')}</th><th>{t45n('helpdesk.step45n.ticketDetail.activity')}</th><th>{t45n('common.step45n.workspacePages.lastUsed')}</th><th>{t45n('reports.table.action')}</th></tr></thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.sourceModule + ':' + item.resourceId + ':' + item.occurredAt}>
                    <td><b>{item.title}</b></td>
                    <td>{moduleLabel(item.sourceModule, t45n)}</td>
                    <td>{item.activity}</td>
                    <td>{relativeTime(item.occurredAt, locale, t45n)}</td>
                    <td><Link to={item.destinationPath}>{t45n('common.step45n.search.open')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        </section>
      ) : query.data ? (
        <INNOState title={t45n('common.step45n.workspacePages.noRecentActivity')} description={t45n('common.step45n.workspacePages.yourLatestResourceActivityWillAppearHereAs')} />
      ) : null}
    </INNOPage>
  );
}
