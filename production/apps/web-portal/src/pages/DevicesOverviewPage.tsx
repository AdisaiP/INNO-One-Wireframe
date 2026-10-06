import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOIcon,
  INNOPage,
  INNOResourceSummary,
  INNOResourceSummaryItem,
  INNOState,
  INNOStatus,
} from '@inno/ui';
import { getDeviceOverview } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatLastSeen(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value));
}

export function DevicesOverviewPage() {
  const query = useQuery({
    queryKey: ['devices', 'overview'],
    queryFn: getDeviceOverview,
    refetchInterval: 30_000,
  });

  if (query.isPending) {
    return <main className="inno-page"><LoadingState label="Loading Devices overview…" /></main>;
  }

  if (query.isError) {
    return <main className="inno-page"><ErrorState error={query.error} retry={() => void query.refetch()} /></main>;
  }

  const data = query.data;

  return (
    <INNOPage
      eyebrow="Devices"
      title="Fleet Overview"
      description="Current managed-endpoint connectivity, inventory distribution, and alert state inside your effective scope."
      actions={<Link className="inno-link-button" to="/devices">View all devices</Link>}
    >
      <INNOResourceSummary>
        <INNOResourceSummaryItem
          label="All devices"
          value={String(data.totalDevices)}
          detail={data.deviceGroups + ' groups · ' + data.deviceTypes + ' device types'}
        />
        <INNOResourceSummaryItem
          label="Online"
          value={String(data.onlineDevices)}
          detail={data.onlinePercent + '% connected'}
        />
        <INNOResourceSummaryItem
          label="Offline"
          value={String(data.offlineDevices)}
          detail={data.offlineOver24Hours + ' offline more than 24h'}
        />
        <INNOResourceSummaryItem
          label="Need attention"
          value={String(data.activeAlerts)}
          detail={data.criticalAlerts + ' critical alerts'}
        />
      </INNOResourceSummary>

      <div className="device-overview-grid">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>Endpoint status</h3>
              <p>Current connectivity across managed devices.</p>
            </div>
            <Link to="/devices/alerts">
              <INNOStatus tone={data.criticalAlerts > 0 ? 'danger' : data.activeAlerts > 0 ? 'warning' : 'success'}>
                {data.activeAlerts} active alerts
              </INNOStatus>
            </Link>
          </div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>Online</span><b>{data.onlineDevices} · {data.onlinePercent}%</b></div>
            <div className="kv-row"><span>Offline</span><b>{data.offlineDevices}</b></div>
            <div className="kv-row"><span>Offline &gt; 24h</span><b>{data.offlineOver24Hours}</b></div>
            <div className="kv-row"><span>Critical alerts</span><b>{data.criticalAlerts}</b></div>
          </div>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Operating systems</h3><p>By managed endpoint.</p></div></div>
          <div className="bar-list">
            {data.operatingSystems.length === 0 ? (
              <INNOState title="No operating-system inventory" description="Operating-system distribution appears after managed devices report inventory." />
            ) : data.operatingSystems.map((item) => (
              <div className="bar-row" key={item.label}>
                <span>{item.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: item.percent + '%' }} /></div>
                <b>{item.count} · {item.percent}%</b>
              </div>
            ))}
          </div>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Manufacturers</h3><p>Hardware inventory reported by managed endpoints.</p></div></div>
          <div className="bar-list">
            {data.manufacturers.length === 0 ? (
              <INNOState title="No manufacturer inventory" description="Manufacturer distribution appears after hardware inventory is collected." />
            ) : data.manufacturers.map((item) => (
              <div className="bar-row" key={item.label}>
                <span>{item.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: item.percent + '%' }} /></div>
                <b>{item.count} · {item.percent}%</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="prod-panel">
        <div className="prod-panel-head">
          <div><h3>Managed devices</h3><p>Recently observed endpoints in your effective scope.</p></div>
          <Link to="/devices">View all devices</Link>
        </div>
        {data.recentDevices.length === 0 ? (
          <INNOState title="No managed devices" description="Devices appear here after they are enrolled and visible in your effective access scope." />
        ) : (
          <div className="activity-list">
            {data.recentDevices.map((device) => (
              <Link className="activity-item" key={device.id} to={'/devices/' + device.id}>
                <div className="activity-icon"><INNOIcon token={device.type.includes('server') ? 'device.server' : 'device.desktop'} size={18} /></div>
                <div>
                  <div className="activity-title">{device.name}</div>
                  <div className="activity-meta">{[device.group, device.operatingSystem, formatLastSeen(device.lastSeenAt)].filter(Boolean).join(' · ')}</div>
                </div>
                <INNOStatus tone={device.status === 'online' ? 'success' : 'neutral'} dot>{device.status}</INNOStatus>
              </Link>
            ))}
          </div>
        )}
      </section>
    </INNOPage>
  );
}
