import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOPage, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import {
  createDiscoveryScan,
  getDiscoveryResults,
  getDiscoveryScan,
  getOperation,
} from '../api/client';
import { CollectionErrorState, CollectionLoadingState, ErrorState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function splitRanges(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function DiscoveryPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('devices.manage');
  const [rangeInput, setRangeInput] = useState('');
  const [scanId, setScanId] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [resultStatus, setResultStatus] = useState('unmanaged');
  const ranges = useMemo(() => splitRanges(rangeInput), [rangeInput]);

  const create = useMutation({
    mutationFn: () => createDiscoveryScan(ranges),
    onSuccess: (operation) => {
      setScanId(operation.resource.scanId);
      setOperationId(operation.operationId);
    },
  });

  const operation = useQuery({
    queryKey: ['operation', operationId],
    queryFn: () => getOperation(operationId ?? ''),
    enabled: Boolean(operationId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 800 : false;
    },
  });

  const scan = useQuery({
    queryKey: ['discovery-scan', scanId],
    queryFn: () => getDiscoveryScan(scanId ?? ''),
    enabled: Boolean(scanId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 800 : false;
    },
  });

  const results = useQuery({
    queryKey: ['discovery-results', scanId, search, resultStatus],
    queryFn: () => getDiscoveryResults(scanId ?? '', {
      page: 1,
      pageSize: 50,
      search,
      status: resultStatus,
    }),
    enabled: Boolean(scanId) && scan.data?.status === 'succeeded',
  });

  const current = scan.data;
  const operationStatus = operation.data?.status ?? current?.status;
  const progress = operation.data?.progress ?? current?.progress ?? (create.isPending ? 1 : 0);

  return (
    <INNOPage
      eyebrow={t45n('navigation.devices')}
      title={t45n('devices.step45n.discovery.networkDiscovery')}
      description={t45n('devices.step45n.discovery.scanApprovedPrivateIpv4RangesToFindReachable')}
      actions={canManage ? (
        <INNOButton
          type="button"
          busy={create.isPending}
          disabled={ranges.length === 0 || operationStatus === 'queued' || operationStatus === 'running'}
          onClick={() => create.mutate()}
        >
          {operationStatus === 'queued' || operationStatus === 'running' ? t45n('devices.step45n.discovery.scanning') : t45n('devices.step45n.discovery.runScan')}
        </INNOButton>
      ) : undefined}
    >

      <div className="discovery-layout">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>{t45n('devices.step45n.discovery.runScan2')}</h3><p>{t45n('devices.step45n.discovery.privateLoopbackIpv4OnlyMaximum512AddressesPer')}</p></div>
            {operationStatus ? <INNOStatus tone={operationStatus === 'succeeded' ? 'success' : operationStatus === 'failed' ? 'danger' : 'info'}>{operationStatus}</INNOStatus> : null}
          </div>
          <div className="editor-form">
            <label className="field-block field-wide">
              <span>{t45n('devices.step45n.discovery.networkRanges')}</span>
              <textarea
                rows={4}
                value={rangeInput}
                onChange={(event) => setRangeInput(event.target.value)}
                placeholder={t45n('devices.step45n.discovery.example102010241020')}
                disabled={!canManage || create.isPending || operationStatus === 'queued' || operationStatus === 'running'}
              />
              <small>{t45n('devices.step45n.discovery.publicRangesAreRejectedServerSide')}</small>
            </label>
            {create.isError ? <ErrorState error={create.error} /> : null}
          </div>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>{t45n('devices.step45n.discovery.currentScan')}</h3><p>{t45n('devices.step45n.discovery.canonicalProgressFromTheSharedInnoOneOperation')}</p></div></div>
          {!current ? (
            <div className="compact-empty">{t45n('devices.step45n.discovery.noScanStartedInThisSession')}</div>
          ) : (
            <div className="scan-summary">
              <div className="scan-progress-track" aria-label={t45n('devices.step45n.discovery.scanProgress') + ' ' + progress + '%'}>
                <span style={{ width: progress + '%' }} />
              </div>
              <div className="scan-metrics">
                <div><b>{current.addressesScanned}</b><span>{t45n('devices.step45n.discovery.addressesScanned')}</span></div>
                <div><b>{current.devicesFound}</b><span>{t45n('devices.step45n.discovery.devicesFound')}</span></div>
                <div><b>{current.unmanagedCount}</b><span>{t45n('devices.step45n.discovery.unmanaged')}</span></div>
              </div>
              {operation.data ? (
                <div className="table-meta">
                  {t45n('devices.step45n.discovery.operation')}{' '}{operation.data.operationId} · {operation.data.originModule}
                </div>
              ) : null}
              <div className="table-meta">{current.ranges.join(' · ')}</div>
            </div>
          )}
        </section>
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('devices.step45n.discovery.discoveryResults')}
          description={t45n('devices.step45n.discovery.reachableEndpointsFromTheCurrentCompletedScan')}
          meta={results.data ? <INNOStatus>{results.data.totalItems} {t45n('devices.step45n.discovery.results')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('devices.step45n.discovery.searchDiscoveryResults')} value={search} onChange={setSearch} placeholder={t45n('devices.step45n.discovery.searchIpHostnameOrOs')} />
          <INNOSelectField label={t45n('devices.step45n.discovery.managementStatus')} value={resultStatus} onChange={setResultStatus}>
            <option value="all">{t45n('admin.step45n.adminUsers.statusAll')}</option>
            <option value="unmanaged">{t45n('devices.step45n.discovery.unmanaged')}</option>
            <option value="managed">{t45n('devices.step45n.deviceDetail.managed')}</option>
          </INNOSelectField>
        </INNOCollectionToolbar>

        {!scanId ? (
          <INNOCollectionState kind="empty" title={t45n('devices.step45n.discovery.runDiscoveryToSeeResults')} description={t45n('devices.step45n.discovery.startAScanAboveUsingOneOrMore')} />
        ) : scan.isPending || current?.status === 'queued' || current?.status === 'running' ? (
          <CollectionLoadingState label={t45n('devices.step45n.discovery.discoveryScanInProgress')} />
        ) : scan.isError ? (
          <CollectionErrorState error={scan.error} retry={() => void scan.refetch()} />
        ) : current?.status === 'failed' ? (
          <INNOCollectionState kind="error" title={t45n('devices.step45n.discovery.discoveryScanFailed')} description={t45n('devices.step45n.discovery.theScanCouldNotBeCompletedReviewThe')} />
        ) : results.isPending ? (
          <CollectionLoadingState label={t45n('devices.step45n.discovery.loadingDiscoveryResults')} />
        ) : results.isError ? (
          <CollectionErrorState error={results.error} retry={() => void results.refetch()} />
        ) : results.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || resultStatus !== 'all' ? 'no-results' : 'empty'}
            title={search || resultStatus !== 'all' ? t45n('devices.step45n.discovery.noDiscoveryResultsFound') : t45n('devices.step45n.discovery.noEndpointsMatched')}
            description={search || resultStatus !== 'all' ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters') : t45n('devices.step45n.discovery.noReachableEndpointsWereReturnedByThisScan')}
            action={search || resultStatus !== 'all' ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setResultStatus('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton> : undefined}
          />
        ) : (
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>{t45n('reports.column.ipAddress')}</th><th>{t45n('devices.step45n.deviceDetail.hostname')}</th><th>{t45n('devices.step45n.discovery.detectedOs')}</th><th>{t45n('assets.automation.editor.licenseField.vendor')}</th><th>{t45n('navigation.discovery')}</th><th>{t45n('reports.runs.status')}</th></tr></thead>
              <tbody>
                {results.data.items.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.ipAddress}</b></td>
                    <td>{row.hostname ?? '—'}</td>
                    <td>{row.detectedOperatingSystem ?? '—'}</td>
                    <td>{row.vendor ?? '—'}</td>
                    <td>{row.discoveryMethod}</td>
                    <td><INNOStatus tone={row.managementStatus === 'managed' ? 'success' : 'neutral'}>{row.managementStatus}</INNOStatus></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
