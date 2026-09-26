import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getDevice } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function metric(value?: number | null, suffix = '') {
  return value == null ? '—' : `${value}${suffix}`;
}

function lastSeen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleString();
}

export function DeviceDetailPage() {
  const { deviceId = '' } = useParams();
  const query = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => getDevice(deviceId),
    enabled: Boolean(deviceId),
  });

  if (query.isPending) {
    return <div className="page-loading-wrap"><LoadingState label="Loading device…" /></div>;
  }

  if (query.isError) {
    return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  }

  const device = query.data;
  const model = [device.manufacturer, device.model].filter(Boolean).join(' ') || device.type;
  const group = device.groups[0]?.name ?? device.organization?.name ?? 'Unassigned';

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/devices">Devices</Link><span>›</span><span>{device.name}</span>
      </div>

      <div className="resource-head production-resource-head">
        <div>
          <div className="resource-title-line">
            <h1>{device.name}</h1>
            <span className={`status-dot ${device.status}`}>{device.status}</span>
          </div>
          <div className="resource-meta-line">
            <span>{model}</span><span>·</span><span>{device.operatingSystem ?? 'Unknown OS'}</span><span>·</span><span>{group}</span>
          </div>
        </div>
      </div>

      {device.isOffline ? (
        <div className="offline-banner" role="status">
          <b>Resource offline</b>
          <span>Showing the latest cached inventory. Last seen {lastSeen(device.lastSeenAt)}.</span>
        </div>
      ) : null}

      <div className="stat-strip production-stat-strip">
        <div><span>CPU</span><b>{metric(device.cpuPercent, '%')}</b><small>{device.isOffline ? 'cached' : 'current snapshot'}</small></div>
        <div><span>Memory</span><b>{device.memoryUsedGb != null && device.memoryTotalGb != null ? `${device.memoryUsedGb} / ${device.memoryTotalGb} GB` : '—'}</b><small>normalized inventory</small></div>
        <div><span>Disk</span><b>{device.diskUsedGb != null && device.diskTotalGb != null ? `${device.diskUsedGb} / ${device.diskTotalGb} GB` : '—'}</b><small>used / total</small></div>
        <div><span>Last seen</span><b>{lastSeen(device.lastSeenAt)}</b><small>{device.agentVersion ? `Agent ${device.agentVersion}` : 'Agent version unknown'}</small></div>
      </div>

      <div className="overview-label">Overview</div>

      <div className="device-overview-grid">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>Device information</h3>
              <p>Canonical INNO.One device identity and cached endpoint inventory.</p>
            </div>
            <span className="prod-tag success">Managed</span>
          </div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>Hostname</span><b>{device.name}</b></div>
            <div className="kv-row"><span>Assigned user</span><b>{device.assignedUser ?? '—'}</b></div>
            <div className="kv-row"><span>Brand / model</span><b>{model}</b></div>
            <div className="kv-row"><span>Serial number</span><b>{device.serialNumber ?? '—'}</b></div>
            <div className="kv-row"><span>IP address</span><b>{device.ipAddress ?? '—'}</b></div>
            <div className="kv-row"><span>MAC address</span><b>{device.macAddress ?? '—'}</b></div>
            <div className="kv-row"><span>Operating system</span><b>{device.operatingSystem ?? '—'}</b></div>
            <div className="kv-row"><span>Device group</span><b>{group}</b></div>
          </div>
        </section>

        <div className="panel-stack">
          <section className="prod-panel">
            <div className="prod-panel-head">
              <div>
                <h3>Inventory summary</h3>
                <p>Normalized data owned by the Devices module.</p>
              </div>
            </div>
            <div className="summary-grid">
              <div><span>Processor</span><b>{device.processor ?? '—'}</b></div>
              <div><span>BIOS</span><b>{device.biosVersion ?? '—'}</b></div>
              <div><span>Logged-on user</span><b>{device.loggedOnUser ?? '—'}</b></div>
              <div><span>Asset</span><b>{device.assetReference ?? '—'}</b></div>
            </div>
          </section>

          <section className="prod-panel">
            <div className="prod-panel-head">
              <div>
                <h3>Management</h3>
                <p>Vendor identifiers remain behind the adapter boundary.</p>
              </div>
            </div>
            <div className="settings-stack">
              <div className="settings-row">
                <div><b>Management engine</b><span>Mapped from canonical INNO.One Device ID</span></div>
                <span className="prod-tag">{device.managementEngine ?? 'Unmapped'}</span>
              </div>
              <div className="settings-row">
                <div><b>Organization</b><span>Authorization relationship</span></div>
                <b>{device.organization?.name ?? '—'}</b>
              </div>
              <div className="settings-row">
                <div><b>Location</b><span>Authorization relationship</span></div>
                <b>{device.location?.name ?? '—'}</b>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
