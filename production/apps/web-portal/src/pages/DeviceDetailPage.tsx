import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOIcon, INNOResourceHeader, INNOResourceSummary, INNOResourceSummaryItem, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOSurfaceTabs, INNOTableWrap } from '@inno/ui';
import { getDevice, getDeviceHardwareInventory, getDeviceNetworkInventory, getDevicePerformance, getDeviceSoftwareInventory } from '../api/client';
import { CollectionErrorState, CollectionLoadingState, ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function metric(value?: number | null, suffix = '') {
  return value == null ? '—' : `${value}${suffix}`;
}

function relativeTime(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 1) return relative.format(0, 'minute');
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function isOlderThanHours(value: string | null | undefined, hours: number) {
  return Boolean(value) && Date.now() - new Date(value!).getTime() > hours * 60 * 60 * 1000;
}

function memoryPercent(used?: number | null, total?: number | null) {
  if (used == null || total == null || total <= 0) return null;
  return Math.round(Math.max(0, Math.min(100, (used / total) * 100)));
}

function sparklinePoints(values: Array<number | null | undefined>) {
  const valid = values.map((value, index) => ({ value, index })).filter((item) => item.value != null);
  if (valid.length === 0) return '';
  const denominator = Math.max(values.length - 1, 1);
  return valid.map((item) => {
    const x = (item.index / denominator) * 500;
    const y = 112 - (Math.max(0, Math.min(100, item.value!)) / 100) * 96;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

type Step45STab = 'overview' | 'hardware' | 'software' | 'performance' | 'network';
const step45sTabs: Step45STab[] = ['overview', 'hardware', 'software', 'performance', 'network'];

export function DeviceDetailPage() {
  const { t: t45n, locale } = useStep45NI18n();
  const { deviceId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: Step45STab = step45sTabs.includes(requestedTab as Step45STab)
    ? requestedTab as Step45STab
    : 'overview';
  const setActiveTab = (tab: Step45STab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };
  const [softwareSearch, setSoftwareSearch] = useState('');
  const [publisher, setPublisher] = useState('all');
  const query = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => getDevice(deviceId),
    enabled: Boolean(deviceId),
  });
  const hardwareQuery = useQuery({
    queryKey: ['device', deviceId, 'hardware-inventory'],
    queryFn: () => getDeviceHardwareInventory(deviceId),
    enabled: Boolean(deviceId) && (activeTab === 'overview' || activeTab === 'hardware'),
  });
  const softwareQuery = useQuery({
    queryKey: ['device', deviceId, 'software-inventory'],
    queryFn: () => getDeviceSoftwareInventory(deviceId),
    enabled: Boolean(deviceId) && activeTab === 'software',
  });
  const performanceQuery = useQuery({
    queryKey: ['device', deviceId, 'performance', '5m', 5],
    queryFn: () => getDevicePerformance(deviceId, '5m', 5),
    enabled: Boolean(deviceId) && activeTab === 'performance',
    refetchInterval: activeTab === 'performance' ? 5000 : false,
  });
  const networkQuery = useQuery({
    queryKey: ['device', deviceId, 'network-inventory'],
    queryFn: () => getDeviceNetworkInventory(deviceId),
    enabled: Boolean(deviceId) && activeTab === 'network',
    refetchInterval: activeTab === 'network' ? 60000 : false,
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
    return <div className="page-loading-wrap"><LoadingState label={t45n('devices.step45n.deviceDetail.loadingDevice')} /></div>;
  }

  if (query.isError) {
    return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  }

  const device = query.data;
  const hardware = hardwareQuery.data?.inventoryStatus !== 'not_reported' ? hardwareQuery.data : null;
  const manufacturer = hardware?.manufacturer ?? device.manufacturer;
  const deviceModel = hardware?.model ?? device.model;
  const deviceType = device.type === 'desktop'
    ? t45n('devices.shared.deviceType.desktop')
    : device.type === 'server'
      ? t45n('devices.shared.deviceType.server')
      : device.type === 'notebook'
        ? t45n('devices.shared.deviceType.notebook')
        : device.type;
  const model = [manufacturer, deviceModel].filter(Boolean).join(' ') || deviceType;
  const group = device.groups[0]?.name ?? device.organization?.name ?? 'Unassigned';
  const softwareIsStale = isOlderThanHours(softwareQuery.data?.observedAt, 24);
  const performance = performanceQuery.data;
  const performanceCpuPoints = sparklinePoints(
    performance?.points.map((point) => point.cpuPercent) ?? [],
  );
  const performanceMemoryPoints = sparklinePoints(
    performance?.points.map((point) => memoryPercent(point.memoryUsedGb, point.memoryTotalGb)) ?? [],
  );
  const latestMemoryPercent = memoryPercent(performance?.memoryUsedGb, performance?.memoryTotalGb);

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/devices">{t45n('navigation.devices')}</Link><span>›</span><span>{device.name}</span>
      </div>

      <INNOResourceHeader
        icon={<INNOIcon token="nav.devices" size={20} />}
        title={device.name}
        status={<INNOStatus tone={device.status === 'online' ? 'success' : 'neutral'} dot>{device.status === 'online' ? t45n('devices.shared.status.online') : t45n('devices.shared.status.offline')}</INNOStatus>}
        meta={<><span>{model}</span><span>·</span><span>{device.operatingSystem ?? t45n('assets.step45n.assetDetail.unknownOs')}</span><span>·</span><span>{group}</span></>}
      />

      {device.isOffline ? (
        <INNOState
          banner
          kind="offline"
          title={t45n('devices.step45n.deviceDetail.resourceOffline')}
          description={t45n('devices.step45n.deviceDetail.showingTheLatestCachedInventoryLastSeen') + ' ' + relativeTime(device.lastSeenAt, locale) + t45n('devices.step45n.deviceDetail.liveOnlyActionsAreUnavailableUntilTheDevice')}
        />
      ) : null}

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('devices.step45n.deviceDetail.cpu')} value={metric(device.cpuPercent, '%')} detail={device.isOffline ? t45n('devices.step45r.deviceDetail.cachedSnapshot') : t45n('devices.step45r.deviceDetail.currentSnapshot')} />
        <INNOResourceSummaryItem label={t45n('devices.step45n.deviceDetail.memory')} value={device.memoryUsedGb != null && device.memoryTotalGb != null ? `${device.memoryUsedGb} / ${device.memoryTotalGb} GB` : '—'} detail={t45n('devices.step45n.deviceDetail.inventorySummary')} />
        <INNOResourceSummaryItem label={t45n('devices.step45n.deviceDetail.disk')} value={device.diskUsedGb != null && device.diskTotalGb != null ? `${device.diskUsedGb} / ${device.diskTotalGb} GB` : '—'} detail={t45n('devices.step45n.deviceDetail.inventorySummary')} />
        <INNOResourceSummaryItem label={t45n('devices.step45n.deviceDetail.lastSeen')} value={relativeTime(device.lastSeenAt, locale)} detail={device.agentVersion ? t45n('devices.step45r.deviceDetail.agentVersion', { version: device.agentVersion }) : t45n('devices.step45r.deviceDetail.agentVersionUnknown')} />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel={t45n('devices.step45n.deviceDetail.deviceDetailSections')}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as Step45STab)}
        items={[
          { id: 'overview', label: t45n('navigation.overview') },
          { id: 'hardware', label: t45n('devices.step45r.deviceDetail.hardware') },
          { id: 'software', label: t45n('devices.step45n.deviceDetail.software') },
          { id: 'performance', label: t45n('devices.step45s.deviceDetail.performance') },
          { id: 'network', label: t45n('devices.step45s.deviceDetail.network') },
        ]}
      />

      <div hidden={activeTab !== 'overview'}>
        <div className="device-overview-grid">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>{t45n('devices.step45n.deviceDetail.deviceInformation')}</h3>
              <p>{t45n('devices.step45n.deviceDetail.canonicalInnoOneDeviceIdentityAndCachedEndpoint')}</p>
            </div>
            <span className="prod-tag success">{t45n('devices.step45n.deviceDetail.managed')}</span>
          </div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>{t45n('devices.step45n.deviceDetail.hostname')}</span><b>{device.name}</b></div>
            <div className="kv-row"><span>{t45n('assets.step45n.assetDetail.assignedUser')}</span><b>{device.assignedUser ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('devices.step45n.deviceDetail.brandModel')}</span><b>{model}</b></div>
            <div className="kv-row"><span>{t45n('devices.step45n.deviceDetail.serialNumber')}</span><b>{hardware?.serialNumber ?? device.serialNumber ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('devices.step45n.deviceDetail.ipAddress')}</span><b>{hardware?.ipAddress ?? device.ipAddress ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('devices.step45n.deviceDetail.macAddress')}</span><b>{hardware?.macAddress ?? device.macAddress ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('devices.shared.field.operatingSystem')}</span><b>{hardware?.operatingSystem ?? device.operatingSystem ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('devices.shared.field.deviceGroup')}</span><b>{group}</b></div>
          </div>
        </section>

        <div className="panel-stack">
          <section className="prod-panel">
            <div className="prod-panel-head">
              <div>
                <h3>{t45n('devices.step45n.deviceDetail.inventorySummary')}</h3>
                <p>{t45n('devices.step45n.deviceDetail.normalizedDataOwnedByTheDevicesModule')}</p>
              </div>
            </div>
            <div className="summary-grid">
              <div><span>{t45n('devices.step45n.deviceDetail.processor')}</span><b>{hardware?.processor ?? device.processor ?? '—'}</b></div>
              <div><span>{t45n('devices.step45n.deviceDetail.bios')}</span><b>{hardware?.biosVersion ?? device.biosVersion ?? '—'}</b></div>
              <div><span>{t45n('devices.step45n.deviceDetail.loggedOnUser')}</span><b>{device.loggedOnUser ?? '—'}</b></div>
              <div><span>{t45n('reports.column.name')}</span><b>{device.assetReference ?? '—'}</b></div>
            </div>
          </section>

          <section className="prod-panel">
            <div className="prod-panel-head">
              <div>
                <h3>{t45n('navigation.management')}</h3>
                <p>{t45n('devices.step45n.deviceDetail.vendorIdentifiersRemainBehindTheAdapterBoundary')}</p>
              </div>
            </div>
            <div className="settings-stack">
              <div className="settings-row">
                <div><b>{t45n('devices.step45n.deviceDetail.managementEngine')}</b><span>{t45n('devices.step45n.deviceDetail.mappedFromCanonicalInnoOneDeviceId')}</span></div>
                <span className="prod-tag">{device.managementEngine ?? t45n('devices.step45n.deviceDetail.unmapped')}</span>
              </div>
              <div className="settings-row">
                <div><b>{t45n('profile.organization')}</b><span>{t45n('devices.step45n.deviceDetail.authorizationRelationship')}</span></div>
                <b>{device.organization?.name ?? '—'}</b>
              </div>
              <div className="settings-row">
                <div><b>{t45n('profile.location')}</b><span>{t45n('devices.step45n.deviceDetail.authorizationRelationship')}</span></div>
                <b>{device.location?.name ?? '—'}</b>
              </div>
            </div>
          </section>
        </div>
        </div>
      </div>

      <div hidden={activeTab !== 'hardware'}>
        {activeTab !== 'hardware' ? null : hardwareQuery.isPending ? (
          <div className="device-tab-loading-wrap"><LoadingState label={t45n('devices.step45r.deviceDetail.loadingHardware')} /></div>
        ) : hardwareQuery.isError ? (
          <div className="page-error-wrap"><ErrorState error={hardwareQuery.error} retry={() => void hardwareQuery.refetch()} /></div>
        ) : hardwareQuery.data.inventoryStatus === 'not_reported' ? (
          <INNOState
            kind="empty"
            title={t45n('devices.step45r.deviceDetail.hardwareNotReported')}
            description={t45n('devices.step45r.deviceDetail.hardwareNotReportedDescription')}
          />
        ) : (
          <div className="panel-stack">
            {hardwareQuery.data.isStale ? (
              <INNOState
                banner
                kind="partial"
                title={t45n('devices.step45r.deviceDetail.stale')}
                description={t45n('devices.step45r.deviceDetail.staleEvidenceDescription')}
              />
            ) : hardwareQuery.data.inventoryStatus === 'partial' ? (
              <INNOState
                banner
                kind="partial"
                title={t45n('devices.step45r.deviceDetail.partialEvidence')}
                description={t45n('devices.step45r.deviceDetail.partialEvidenceDescription')}
              />
            ) : null}

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>{t45n('devices.step45r.deviceDetail.hardwareInventory')}</h3>
                  <p>{t45n('devices.step45r.deviceDetail.hardwareDescription')}</p>
                </div>
                <INNOStatus tone={hardwareQuery.data.isStale ? 'warning' : hardwareQuery.data.inventoryStatus === 'complete' ? 'success' : 'warning'}>
                  {hardwareQuery.data.isStale
                    ? t45n('devices.step45r.deviceDetail.stale')
                    : hardwareQuery.data.inventoryStatus === 'complete'
                      ? t45n('devices.step45r.deviceDetail.fresh')
                      : t45n('devices.step45r.deviceDetail.partialEvidence')}
                </INNOStatus>
              </div>
              <div className="summary-grid device-hardware-grid">
                <div><span>{t45n('devices.step45r.deviceDetail.manufacturer')}</span><b>{hardwareQuery.data.manufacturer ?? '—'}</b></div>
                <div><span>{t45n('devices.step45r.deviceDetail.model')}</span><b>{hardwareQuery.data.model ?? '—'}</b></div>
                <div><span>{t45n('devices.step45n.deviceDetail.serialNumber')}</span><b>{hardwareQuery.data.serialNumber ?? '—'}</b></div>
                <div><span>{t45n('devices.step45n.deviceDetail.processor')}</span><b>{hardwareQuery.data.processor ?? '—'}</b></div>
                <div><span>{t45n('devices.step45n.deviceDetail.bios')}</span><b>{hardwareQuery.data.biosVersion ?? '—'}</b></div>
                <div><span>{t45n('devices.shared.field.operatingSystem')}</span><b>{hardwareQuery.data.operatingSystem ?? '—'}</b></div>
                <div><span>{t45n('devices.step45r.deviceDetail.memoryCapacity')}</span><b>{hardwareQuery.data.memoryTotalGb != null ? t45n('devices.step45r.deviceDetail.gbValue', { value: hardwareQuery.data.memoryTotalGb }) : '—'}</b></div>
                <div><span>{t45n('devices.step45r.deviceDetail.memorySlots')}</span><b>{hardwareQuery.data.memorySlotsUsed != null && hardwareQuery.data.memorySlotsTotal != null ? t45n('devices.step45r.deviceDetail.slotsUsed', { used: hardwareQuery.data.memorySlotsUsed, total: hardwareQuery.data.memorySlotsTotal }) : '—'}</b></div>
                <div><span>{t45n('devices.step45n.deviceDetail.ipAddress')}</span><b>{hardwareQuery.data.ipAddress ?? '—'}</b></div>
                <div><span>{t45n('devices.step45n.deviceDetail.macAddress')}</span><b>{hardwareQuery.data.macAddress ?? '—'}</b></div>
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>{t45n('devices.step45r.deviceDetail.inventoryEvidence')}</h3>
                  <p>{hardwareQuery.data.source ?? '—'}</p>
                </div>
              </div>
              <div className="settings-stack">
                <div className="settings-row">
                  <div><b>{t45n('devices.step45r.deviceDetail.observedAt')}</b><span>{t45n('devices.step45r.deviceDetail.source')}</span></div>
                  <b>{hardwareQuery.data.observedAt ? relativeTime(hardwareQuery.data.observedAt, locale) : '—'}</b>
                </div>
                <div className="settings-row">
                  <div><b>{t45n('devices.step45r.deviceDetail.receivedAt')}</b><span>{hardwareQuery.data.sourceInstance ?? hardwareQuery.data.source ?? '—'}</span></div>
                  <b>{hardwareQuery.data.receivedAt ? relativeTime(hardwareQuery.data.receivedAt, locale) : '—'}</b>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <div hidden={activeTab !== 'software'}>
        <INNOCollection className="device-software-card">
        <INNOCollectionHeader
          title={t45n('devices.step45n.deviceDetail.installedSoftware')}
          description={t45n('devices.step45n.deviceDetail.latestDevicesOwnedObservationUsedAsEvidenceFor')}
          meta={softwareQuery.data ? (
            <INNOStatus tone={softwareQuery.data.inventoryStatus === 'complete' ? 'success' : softwareQuery.data.inventoryStatus === 'partial' ? 'warning' : 'neutral'}>
              {softwareQuery.data.inventoryStatus === 'not_reported' ? t45n('devices.step45n.deviceDetail.notReported') : softwareQuery.data.inventoryStatus}
            </INNOStatus>
          ) : undefined}
        />
        {softwareIsStale && softwareQuery.data?.inventoryStatus !== 'not_reported' ? (
          <INNOState
            banner
            kind="partial"
            title={t45n('devices.step45r.deviceDetail.stale')}
            description={t45n('devices.step45r.deviceDetail.softwareStaleDescription')}
          />
        ) : null}
        {softwareQuery.data && softwareQuery.data.inventoryStatus !== 'not_reported' ? (
          <INNOCollectionToolbar>
            <INNOSearchField label={t45n('devices.step45n.deviceDetail.searchInstalledSoftware')} value={softwareSearch} onChange={setSoftwareSearch} placeholder={t45n('devices.step45n.deviceDetail.searchInstalledSoftware2')} />
            <INNOSelectField label={t45n('devices.step45n.deviceDetail.publisherFilter')} value={publisher} onChange={setPublisher}>
              <option value="all">{t45n('devices.step45n.deviceDetail.allPublishers')}</option>
              {publishers.map((item) => <option key={item} value={item}>{item}</option>)}
            </INNOSelectField>
            <span className="toolbar-spacer" />
            <span className="collection-scope">{t45n('devices.step45n.inventoryQuery.observed')}{' '}{relativeTime(softwareQuery.data.observedAt, locale)}</span>
          </INNOCollectionToolbar>
        ) : null}
        {softwareQuery.isPending ? (
          <CollectionLoadingState label={t45n('devices.step45n.deviceDetail.loadingInstalledSoftware')} />
        ) : softwareQuery.isError ? (
          <CollectionErrorState error={softwareQuery.error} retry={() => void softwareQuery.refetch()} />
        ) : softwareQuery.data.inventoryStatus === 'not_reported' ? (
          <INNOCollectionState kind="empty" title={t45n('devices.step45n.deviceDetail.softwareInventoryNotReported')} description={t45n('devices.step45n.deviceDetail.noSoftwareObservationHasBeenReportedBaselineEvaluation')} />
        ) : visibleSoftware.length === 0 ? (
          <INNOCollectionState
            kind="no-results"
            title={t45n('devices.step45n.deviceDetail.noInstalledSoftwareFound')}
            description={t45n('devices.step45n.deviceDetail.tryAnotherSoftwareNameOrPublisher')}
            action={<INNOButton variant="secondary" onClick={() => { setSoftwareSearch(''); setPublisher('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>}
          />
        ) : (
          <>
            <div className="software-evidence-bar">
              <span><b>{t45n('reports.table.source')}</b> {(softwareQuery.data.source ?? 'unknown').replaceAll('_', ' ')}</span>
              <span><b>{t45n('devices.step45n.deviceDetail.evidence')}</b> {softwareQuery.data.inventoryStatus === 'complete' ? t45n('devices.step45n.deviceDetail.completeSnapshot') : t45n('devices.step45n.deviceDetail.partialSnapshotAbsenceIsUnknown')}</span>
            </div>
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>{t45n('devices.step45n.deviceDetail.software')}</th><th>{t45n('devices.step45n.deviceDetail.publisher')}</th><th>{t45n('reports.runs.version')}</th><th>{t45n('devices.step45n.deviceDetail.architecture')}</th></tr></thead>
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

      <div hidden={activeTab !== 'performance'}>
        {activeTab !== 'performance' ? null : performanceQuery.isPending ? (
          <div className="device-tab-loading-wrap"><LoadingState label={t45n('devices.step45s.deviceDetail.loadingPerformance')} /></div>
        ) : performanceQuery.isError ? (
          <div className="page-error-wrap"><ErrorState error={performanceQuery.error} retry={() => void performanceQuery.refetch()} /></div>
        ) : performanceQuery.data.status === 'no_data' ? (
          <INNOState
            kind="empty"
            title={t45n('devices.step45s.deviceDetail.noPerformanceData')}
            description={t45n('devices.step45s.deviceDetail.noPerformanceDataDescription')}
          />
        ) : (
          <div className="panel-stack">
            {performanceQuery.data.isStale ? (
              <INNOState
                banner
                kind="partial"
                title={t45n('devices.step45s.deviceDetail.performanceStale')}
                description={t45n('devices.step45s.deviceDetail.performanceStaleDescription')}
              />
            ) : null}

            <div className="device-performance-grid">
              <section className="prod-panel device-performance-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>{t45n('devices.step45s.deviceDetail.cpuUsage')}</h3>
                    <p>{t45n('devices.step45s.deviceDetail.lastFiveMinutes')} · {t45n('devices.step45s.deviceDetail.fiveSecondInterval')}</p>
                  </div>
                  <INNOStatus tone={performanceQuery.data.isLive ? 'success' : 'warning'}>
                    {performanceQuery.data.isLive ? t45n('devices.step45s.deviceDetail.live') : t45n('devices.step45r.deviceDetail.stale')}
                  </INNOStatus>
                </div>
                <div className="performance-current-value">
                  {performanceQuery.data.cpuPercent != null
                    ? t45n('devices.step45s.deviceDetail.percentValue', { value: performanceQuery.data.cpuPercent })
                    : '—'}
                </div>
                {performanceCpuPoints ? (
                  <svg className="performance-sparkline" viewBox="0 0 500 120" preserveAspectRatio="none" aria-label={t45n('devices.step45s.deviceDetail.cpuUsage')}>
                    <line className="gridline" x1="0" y1="32" x2="500" y2="32" />
                    <line className="gridline" x1="0" y1="64" x2="500" y2="64" />
                    <line className="gridline" x1="0" y1="96" x2="500" y2="96" />
                    <polyline points={performanceCpuPoints} />
                  </svg>
                ) : (
                  <div className="performance-no-window">{t45n('devices.step45s.deviceDetail.noSamplesInWindow')}</div>
                )}
              </section>

              <section className="prod-panel device-performance-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>{t45n('devices.step45s.deviceDetail.memoryUsage')}</h3>
                    <p>
                      {performanceQuery.data.memoryUsedGb != null && performanceQuery.data.memoryTotalGb != null
                        ? t45n('devices.step45s.deviceDetail.gbPairValue', { used: performanceQuery.data.memoryUsedGb, total: performanceQuery.data.memoryTotalGb })
                        : t45n('devices.step45s.deviceDetail.latestSample')}
                    </p>
                  </div>
                  <INNOStatus tone={performanceQuery.data.isLive ? 'success' : 'warning'}>
                    {latestMemoryPercent != null
                      ? t45n('devices.step45s.deviceDetail.percentValue', { value: latestMemoryPercent })
                      : performanceQuery.data.isLive
                        ? t45n('devices.step45s.deviceDetail.live')
                        : t45n('devices.step45r.deviceDetail.stale')}
                  </INNOStatus>
                </div>
                {performanceMemoryPoints ? (
                  <svg className="performance-sparkline" viewBox="0 0 500 120" preserveAspectRatio="none" aria-label={t45n('devices.step45s.deviceDetail.memoryUsage')}>
                    <line className="gridline" x1="0" y1="32" x2="500" y2="32" />
                    <line className="gridline" x1="0" y1="64" x2="500" y2="64" />
                    <line className="gridline" x1="0" y1="96" x2="500" y2="96" />
                    <polyline points={performanceMemoryPoints} />
                  </svg>
                ) : (
                  <div className="performance-no-window">{t45n('devices.step45s.deviceDetail.noSamplesInWindow')}</div>
                )}
              </section>
            </div>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>{t45n('devices.step45s.deviceDetail.latestSample')}</h3>
                  <p>{performanceQuery.data.source === 'endpoint_agent' ? t45n('devices.step45s.deviceDetail.endpointAgentTelemetry') : (performanceQuery.data.source ?? '—').replaceAll('_', ' ')}</p>
                </div>
                <INNOStatus tone={performanceQuery.data.isLive ? 'success' : 'warning'}>
                  {performanceQuery.data.latestObservedAt ? relativeTime(performanceQuery.data.latestObservedAt, locale) : '—'}
                </INNOStatus>
              </div>
              <div className="summary-grid">
                <div><span>{t45n('devices.step45s.deviceDetail.cpuUsage')}</span><b>{performanceQuery.data.cpuPercent != null ? t45n('devices.step45s.deviceDetail.percentValue', { value: performanceQuery.data.cpuPercent }) : '—'}</b></div>
                <div><span>{t45n('devices.step45s.deviceDetail.memoryUsage')}</span><b>{performanceQuery.data.memoryUsedGb != null && performanceQuery.data.memoryTotalGb != null ? t45n('devices.step45s.deviceDetail.gbPairValue', { used: performanceQuery.data.memoryUsedGb, total: performanceQuery.data.memoryTotalGb }) : '—'}</b></div>
                <div><span>{t45n('devices.step45s.deviceDetail.diskUsage')}</span><b>{performanceQuery.data.diskUsedGb != null && performanceQuery.data.diskTotalGb != null ? t45n('devices.step45s.deviceDetail.gbPairValue', { used: performanceQuery.data.diskUsedGb, total: performanceQuery.data.diskTotalGb }) : '—'}</b></div>
              </div>
            </section>
          </div>
        )}
      </div>

      <div hidden={activeTab !== 'network'}>
        {activeTab !== 'network' ? null : networkQuery.isPending ? (
          <div className="device-tab-loading-wrap"><LoadingState label={t45n('devices.step45s.deviceDetail.loadingNetwork')} /></div>
        ) : networkQuery.isError ? (
          <div className="page-error-wrap"><ErrorState error={networkQuery.error} retry={() => void networkQuery.refetch()} /></div>
        ) : networkQuery.data.inventoryStatus === 'not_reported' ? (
          <INNOState
            kind="empty"
            title={t45n('devices.step45s.deviceDetail.networkNotReported')}
            description={t45n('devices.step45s.deviceDetail.networkNotReportedDescription')}
          />
        ) : (
          <div className="panel-stack">
            {networkQuery.data.isStale ? (
              <INNOState
                banner
                kind="partial"
                title={t45n('devices.step45r.deviceDetail.stale')}
                description={t45n('devices.step45s.deviceDetail.networkStaleDescription')}
              />
            ) : null}
            <div className="device-network-grid">
              <section className="prod-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>{t45n('devices.step45s.deviceDetail.networkConfiguration')}</h3>
                    <p>{t45n('devices.step45s.deviceDetail.networkDescription')}</p>
                  </div>
                  <INNOStatus tone={networkQuery.data.isStale ? 'warning' : 'success'}>
                    {networkQuery.data.isStale ? t45n('devices.step45r.deviceDetail.stale') : t45n('devices.step45r.deviceDetail.fresh')}
                  </INNOStatus>
                </div>
                <div className="kv-grid production-kv-grid">
                  <div className="kv-row"><span>{t45n('devices.step45n.deviceDetail.ipAddress')}</span><b>{networkQuery.data.ipAddress ?? '—'}</b></div>
                  <div className="kv-row"><span>{t45n('devices.step45s.deviceDetail.subnet')}</span><b>{networkQuery.data.subnetMask ?? '—'}</b></div>
                  <div className="kv-row"><span>{t45n('devices.step45s.deviceDetail.gateway')}</span><b>{networkQuery.data.gateway ?? '—'}</b></div>
                  <div className="kv-row"><span>{t45n('devices.step45s.deviceDetail.dns')}</span><b>{networkQuery.data.dnsServers.length ? networkQuery.data.dnsServers.join(', ') : '—'}</b></div>
                  <div className="kv-row"><span>{t45n('devices.step45n.deviceDetail.macAddress')}</span><b>{networkQuery.data.macAddress ?? '—'}</b></div>
                  <div className="kv-row"><span>{t45n('devices.step45s.deviceDetail.adapter')}</span><b>{networkQuery.data.adapterName ?? '—'}</b></div>
                </div>
              </section>

              <section className="prod-panel">
                <div className="prod-panel-head">
                  <div>
                    <h3>{t45n('devices.step45s.deviceDetail.connectivity')}</h3>
                    <p>{t45n('devices.step45s.deviceDetail.networkEvidence')}</p>
                  </div>
                </div>
                <div className="summary-grid">
                  <div>
                    <span>{t45n('devices.step45s.deviceDetail.agentLatency')}</span>
                    <b>{networkQuery.data.agentLatencyMs != null ? t45n('devices.step45s.deviceDetail.msValue', { value: networkQuery.data.agentLatencyMs }) : t45n('devices.step45s.deviceDetail.notObserved')}</b>
                  </div>
                  <div>
                    <span>{t45n('devices.step45s.deviceDetail.packetLoss')}</span>
                    <b>{networkQuery.data.packetLossPercent != null ? t45n('devices.step45s.deviceDetail.percentValue', { value: networkQuery.data.packetLossPercent }) : t45n('devices.step45s.deviceDetail.notObserved')}</b>
                  </div>
                </div>
                <div className="settings-stack network-evidence-stack">
                  <div className="settings-row">
                    <div><b>{t45n('devices.step45r.deviceDetail.observedAt')}</b><span>{networkQuery.data.source ?? '—'}</span></div>
                    <b>{networkQuery.data.observedAt ? relativeTime(networkQuery.data.observedAt, locale) : '—'}</b>
                  </div>
                  <div className="settings-row">
                    <div><b>{t45n('devices.step45r.deviceDetail.receivedAt')}</b><span>{networkQuery.data.sourceInstance ?? networkQuery.data.source ?? '—'}</span></div>
                    <b>{networkQuery.data.receivedAt ? relativeTime(networkQuery.data.receivedAt, locale) : '—'}</b>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
