import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOResourceHeader, INNOStatus } from '@inno/ui';
import { getDevice, getDeviceSoftwareInventory } from '../api/client';
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
  const softwareQuery = useQuery({
    queryKey: ['device', deviceId, 'software-inventory'],
    queryFn: () => getDeviceSoftwareInventory(deviceId),
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

      <INNOResourceHeader
        title={device.name}
        status={<INNOStatus tone={device.status === 'online' ? 'success' : 'neutral'} dot>{device.status}</INNOStatus>}
        meta={<><span>{model}</span><span>·</span><span>{device.operatingSystem ?? 'Unknown OS'}</span><span>·</span><span>{group}</span></>}
      />

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

      <section className="collection-card device-software-card">
        <div className="collection-head">
          <div>
            <h2>Installed software</h2>
            <p>Latest Devices-owned observation used as evidence for software baselines.</p>
          </div>
          {softwareQuery.data ? (
            <span className={'prod-tag ' + (softwareQuery.data.inventoryStatus === 'complete' ? 'success' : '')}>
              {softwareQuery.data.inventoryStatus === 'not_reported'
                ? 'Not reported'
                : softwareQuery.data.inventoryStatus}
            </span>
          ) : null}
        </div>
        {softwareQuery.isPending ? (
          <div className="collection-state"><LoadingState label="Loading installed software…" /></div>
        ) : softwareQuery.isError ? (
          <div className="collection-state"><ErrorState error={softwareQuery.error} retry={() => void softwareQuery.refetch()} /></div>
        ) : softwareQuery.data.inventoryStatus === 'not_reported' ? (
          <div className="compact-empty">
            No software observation has been reported. Baseline evaluation remains unknown.
          </div>
        ) : (
          <>
            <div className="software-evidence-bar">
              <span><b>Observed</b> {lastSeen(softwareQuery.data.observedAt)}</span>
              <span><b>Source</b> {(softwareQuery.data.source ?? 'unknown').replaceAll('_', ' ')}</span>
              <span><b>Evidence</b> {softwareQuery.data.inventoryStatus === 'complete' ? 'Complete snapshot' : 'Partial snapshot · absence is unknown'}</span>
            </div>
            <div className="production-table-wrap">
              <table className="production-table">
                <thead><tr><th>Software</th><th>Publisher</th><th>Version</th><th>Architecture</th></tr></thead>
                <tbody>{softwareQuery.data.packages.map((item) => (
                  <tr key={item.productKey}>
                    <td><b>{item.displayName}</b><div className="table-meta">{item.productKey}</div></td>
                    <td>{item.publisher ?? '—'}</td>
                    <td>{item.version ?? '—'}</td>
                    <td>{item.architecture ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
