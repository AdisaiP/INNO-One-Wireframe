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

function moduleLabel(value: string) {
  if (value === 'devices') return 'Devices';
  if (value === 'helpdesk') return 'Helpdesk';
  if (value === 'assets') return 'Assets';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function moduleMark(value: string) {
  if (value === 'devices') return 'D';
  if (value === 'helpdesk') return 'H';
  if (value === 'assets') return 'A';
  return 'W';
}

function relativeTime(value: string) {
  const date = new Date(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
function severityTone(value: string): 'neutral' | 'info' | 'warning' | 'danger' {
  if (value === 'danger') return 'danger';
  if (value === 'warning') return 'warning';
  if (value === 'info') return 'info';
  return 'neutral';
}

function ActivityFeed({ items }: { items: WorkspaceActivityItem[] }) {
  if (items.length === 0) {
    return <INNOState compact title="Nothing to continue yet" description="Recent resources will appear here as you work across INNO.One." />;
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
            <span>{moduleLabel(item.sourceModule)} · {item.activity}</span>
          </span>
          <small>{relativeTime(item.occurredAt)}</small>
        </Link>
      ))}
    </div>
  );
}
function AttentionFeed({ items }: { items: WorkspaceAttentionItem[] }) {
  if (items.length === 0) {
    return <INNOState compact title="Nothing needs attention" description="There are no cross-app items requiring action in your current scope." />;
  }

  return (
    <div className="workspace-attention-list">
      {items.map((item) => (
        <Link className="workspace-attention-item" to={item.route} key={item.id}>
          <span className={'workspace-module-mark module-' + item.module}>{moduleMark(item.module)}</span>
          <span className="workspace-feed-copy">
            <span className="workspace-attention-title">
              <b>{item.title}</b>
              <INNOStatus tone={severityTone(item.severity)}>{moduleLabel(item.module)}</INNOStatus>
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
  const query = useQuery({
    queryKey: ['platform', 'workspace'],
    queryFn: getWorkspaceHome,
    refetchOnWindowFocus: true,
  });
  if (query.isPending) return <LoadingState label="Loading your workspace…" />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const firstName = data.fullName.split(/\s+/)[0] || data.fullName;

  return (
    <div className="workspace-home-page">
      <section className="workspace-welcome">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>{greeting()}, {firstName}</h1>
          <p>Continue where you left off or open an app to start working.</p>
          <div className="workspace-welcome-meta">
            <span>{data.apps.length} available apps</span>
            <span>{data.continueItems.length} recent resources</span>
            <span>{data.attentionTotal} attention items</span>
          </div>
        </div>
        <div className="workspace-welcome-mark" aria-hidden="true">I1</div>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div><h2>Your Apps</h2><p>Apps available to your current role.</p></div>
          <Link to="/apps">All apps <INNOIcon token="action.next" size={13} /></Link>
        </div>
        {data.apps.length ? (
          <div className="workspace-app-grid">
            {data.apps.map((app) => (
              <Link className="workspace-app-card" to={app.route} key={app.id}>
                <span className={'workspace-app-mark module-' + app.id}>{moduleMark(app.id)}</span>
                <span><b>{app.name}</b><small>Open {app.name}</small></span>
                <span aria-hidden="true"><INNOIcon token="action.next" size={14} /></span>
              </Link>
            ))}
          </div>
        ) : (
          <INNOState compact title="No apps available" description="Apps appear here when they are enabled and permitted for your role." />
        )}
      </section>

      <div className="workspace-home-columns">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>Continue Working</h3><p>Recent resources across your workspace.</p></div>
            <Link to="/workspace/continue">View all</Link>
          </div>
          <ActivityFeed items={data.continueItems} />
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>Needs Attention</h3><p>Cross-app items that may need action soon.</p></div>
            <INNOStatus tone={data.attentionTotal ? 'warning' : 'success'}>
              {data.attentionTotal} items
            </INNOStatus>
          </div>
          <AttentionFeed items={data.attentionItems} />
        </section>
      </div>
      <section className="prod-panel workspace-recent-panel">
        <div className="prod-panel-head">
          <div><h3>Recent Activity</h3><p>Resources you recently opened or changed.</p></div>
          <Link to="/workspace/recent">View history</Link>
        </div>
        {data.recentItems.length ? (
          <INNOTableWrap>
            <table className="inno-table workspace-recent-table">
              <thead><tr><th>Item</th><th>App</th><th>Activity</th><th>Last Used</th><th>Action</th></tr></thead>
              <tbody>
                {data.recentItems.map((item) => (
                  <tr key={item.sourceModule + ':' + item.resourceId + ':' + item.occurredAt}>
                    <td><b>{item.title}</b></td>
                    <td>{moduleLabel(item.sourceModule)}</td>
                    <td>{item.activity}</td>
                    <td>{relativeTime(item.occurredAt)}</td>
                    <td><Link to={item.destinationPath}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <INNOState compact title="No recent activity" description="Your latest workspace activity will appear here." />
        )}
      </section>
      {data.partialFailures.length ? (
        <INNOState
          compact
          kind="partial"
          title="Some workspace signals are temporarily unavailable"
          description={'Could not load attention data from: ' + data.partialFailures.join(', ')}
        />
      ) : null}
    </div>
  );
}

export function WorkspaceContinuePage() {
  const query = useQuery({
    queryKey: ['platform', 'workspace', 'continue'],
    queryFn: getWorkspaceContinue,
  });

  return (
    <INNOPage
      eyebrow="Workspace"
      title="Continue Working"
      description="Open resources you were recently working with across permitted apps."
    >
      {query.isPending ? <LoadingState label="Loading recent work…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? <section className="prod-panel"><ActivityFeed items={query.data.items} /></section> : null}
    </INNOPage>
  );
}
export function WorkspaceAttentionPage() {
  const query = useQuery({
    queryKey: ['platform', 'workspace', 'attention'],
    queryFn: getWorkspaceAttention,
    refetchOnWindowFocus: true,
  });

  return (
    <INNOPage
      eyebrow="Workspace"
      title="Needs Attention"
      description="Cross-app items prioritized from the resources you are permitted to access."
    >
      {query.isPending ? <LoadingState label="Loading attention items…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <section className="prod-panel">
            <div className="prod-panel-head">
              <div><h3>Attention queue</h3><p>Live signals from enabled modules.</p></div>
              <INNOStatus tone={query.data.totalCount ? 'warning' : 'success'}>{query.data.totalCount} items</INNOStatus>
            </div>
            <AttentionFeed items={query.data.items} />
          </section>
          {query.data.partialFailures.length ? (
            <INNOState
              compact
              kind="partial"
              title="Partial workspace data"
              description={'Unavailable providers: ' + query.data.partialFailures.join(', ')}
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
export function WorkspaceRecentPage() {
  const query = useQuery({
    queryKey: ['platform', 'activity'],
    queryFn: () => getWorkspaceActivity(50),
  });

  return (
    <INNOPage
      eyebrow="Workspace"
      title="Recent Activity"
      description="Review your latest resource activity across INNO.One."
    >
      {query.isPending ? <LoadingState label="Loading recent activity…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data?.items.length ? (
        <section className="prod-panel">
          <INNOTableWrap>
            <table className="inno-table workspace-recent-table">
              <thead><tr><th>Item</th><th>App</th><th>Activity</th><th>Last Used</th><th>Action</th></tr></thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.sourceModule + ':' + item.resourceId + ':' + item.occurredAt}>
                    <td><b>{item.title}</b></td>
                    <td>{moduleLabel(item.sourceModule)}</td>
                    <td>{item.activity}</td>
                    <td>{relativeTime(item.occurredAt)}</td>
                    <td><Link to={item.destinationPath}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        </section>
      ) : query.data ? (
        <INNOState title="No recent activity" description="Your latest resource activity will appear here as you use INNO.One." />
      ) : null}
    </INNOPage>
  );
}
