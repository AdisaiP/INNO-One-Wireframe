import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOIcon, INNOResourceHeader, INNOResourceSummary, INNOResourceSummaryItem, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOSurfaceTabs, INNOTableWrap } from '@inno/ui';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'software'>('overview');
  const [softwareSearch, setSoftwareSearch] = useState('');
  const [publisher, setPublisher] = useState('all');
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
  const publishers = useMemo(
    () => Array.from(new Set((softwareQuery.data?.packages ?? []).map((item) => item.publisher).filter((value): value is string => Boolean(value)))).sort(),
    [softwareQuery.data?.packages],
  );
  const visibleSoftware = useMemo(() => {
    const needle = softwareSearch.trim().toLowerCase();
    return (softwareQuery.data?.packages ?? []).filter((item) => {
      if (publisher !== 'all' && item.publisher !== publisher) return false;
      if (!needle) return true;
      return [item.displayName, item.productKey, item.publisher, item.version]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [publisher, softwareQuery.data?.packages, softwareSearch]);

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
        icon={<INNOIcon token="nav.devices" size={20} />}
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

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="CPU" value={metric(device.cpuPercent, '%')} detail={device.isOffline ? 'cached' : 'current snapshot'} />
        <INNOResourceSummaryItem label="Memory" value={device.memoryUsedGb != null && device.memoryTotalGb != null ? `${device.memoryUsedGb} / ${device.memoryTotalGb} GB` : '—'} detail="normalized inventory" />
        <INNOResourceSummaryItem label="Disk" value={device.diskUsedGb != null && device.diskTotalGb != null ? `${device.diskUsedGb} / ${device.diskTotalGb} GB` : '—'} detail="used / total" />
        <INNOResourceSummaryItem label="Last seen" value={lastSeen(device.lastSeenAt)} detail={device.agentVersion ? `Agent ${device.agentVersion}` : 'Agent version unknown'} />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel="Device detail sections"
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'software')}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'software', label: 'Software' },
        ]}
      />

      <div hidden={activeTab !== 'overview'}>
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
      </div>

      <div hidden={activeTab !== 'software'}>
        <INNOCollection className="device-software-card">
        <INNOCollectionHeader
          title="Installed software"
          description="Latest Devices-owned observation used as evidence for software baselines."
          meta={softwareQuery.data ? (
            <INNOStatus tone={softwareQuery.data.inventoryStatus === 'complete' ? 'success' : softwareQuery.data.inventoryStatus === 'partial' ? 'warning' : 'neutral'}>
              {softwareQuery.data.inventoryStatus === 'not_reported' ? 'Not reported' : softwareQuery.data.inventoryStatus}
            </INNOStatus>
          ) : undefined}
        />
        {softwareQuery.data && softwareQuery.data.inventoryStatus !== 'not_reported' ? (
          <INNOCollectionToolbar>
            <INNOSearchField label="Search installed software" value={softwareSearch} onChange={setSoftwareSearch} placeholder="Search installed software…" />
            <INNOSelectField label="Publisher filter" value={publisher} onChange={setPublisher}>
              <option value="all">All publishers</option>
              {publishers.map((item) => <option key={item} value={item}>{item}</option>)}
            </INNOSelectField>
            <span className="toolbar-spacer" />
            <span className="collection-scope">Observed {lastSeen(softwareQuery.data.observedAt)}</span>
          </INNOCollectionToolbar>
        ) : null}
        {softwareQuery.isPending ? (
          <div className="collection-state"><LoadingState label="Loading installed software…" /></div>
        ) : softwareQuery.isError ? (
          <div className="collection-state"><ErrorState error={softwareQuery.error} retry={() => void softwareQuery.refetch()} /></div>
        ) : softwareQuery.data.inventoryStatus === 'not_reported' ? (
          <div className="collection-state"><INNOState kind="empty" title="Software inventory not reported" description="No software observation has been reported. Baseline evaluation remains unknown." /></div>
        ) : visibleSoftware.length === 0 ? (
          <div className="collection-state"><INNOState kind="no-results" title="No installed software found" description="Try another software name or publisher." /></div>
        ) : (
          <>
            <div className="software-evidence-bar">
              <span><b>Source</b> {(softwareQuery.data.source ?? 'unknown').replaceAll('_', ' ')}</span>
              <span><b>Evidence</b> {softwareQuery.data.inventoryStatus === 'complete' ? 'Complete snapshot' : 'Partial snapshot · absence is unknown'}</span>
            </div>
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>Software</th><th>Publisher</th><th>Version</th><th>Architecture</th></tr></thead>
                <tbody>{visibleSoftware.map((item) => (
                  <tr key={item.productKey}>
                    <td><b>{item.displayName}</b><div className="table-meta">{item.productKey}</div></td>
                    <td>{item.publisher ?? '—'}</td>
                    <td>{item.version ?? '—'}</td>
                    <td>{item.architecture ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </INNOTableWrap>
          </>
        )}
        </INNOCollection>
      </div>
    </main>
  );
}
