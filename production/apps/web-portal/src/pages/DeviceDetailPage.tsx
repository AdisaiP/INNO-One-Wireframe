import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOIcon, INNOResourceHeader, INNOResourceSummary, INNOResourceSummaryItem, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOSurfaceTabs, INNOTableWrap } from '@inno/ui';
import { getDevice, getDeviceHardwareInventory, getDeviceSoftwareInventory } from '../api/client';
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

type Step45RTab = 'overview' | 'hardware' | 'software';
const step45rTabs: Step45RTab[] = ['overview', 'hardware', 'software'];

export function DeviceDetailPage() {
  const { t: t45n, locale } = useStep45NI18n();
  const { deviceId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: Step45RTab = step45rTabs.includes(requestedTab as Step45RTab)
    ? requestedTab as Step45RTab
    : 'overview';
  const setActiveTab = (tab: Step45RTab) => {
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
        onChange={(id) => setActiveTab(id as Step45RTab)}
        items={[
          { id: 'overview', label: t45n('navigation.overview') },
          { id: 'hardware', label: t45n('devices.step45r.deviceDetail.hardware') },
          { id: 'software', label: t45n('devices.step45n.deviceDetail.software') },
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
        {hardwareQuery.isPending ? (
          <div className="page-loading-wrap"><LoadingState label={t45n('devices.step45r.deviceDetail.loadingHardware')} /></div>
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
    </main>
  );
}
