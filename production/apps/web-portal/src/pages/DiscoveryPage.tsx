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

function splitRanges(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function DiscoveryPage() {
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
      eyebrow="Devices"
      title="Network Discovery"
      description="Scan approved private IPv4 ranges to find reachable endpoints that are not yet managed by INNO.One."
      actions={canManage ? (
        <INNOButton
          type="button"
          busy={create.isPending}
          disabled={ranges.length === 0 || operationStatus === 'queued' || operationStatus === 'running'}
          onClick={() => create.mutate()}
        >
          {operationStatus === 'queued' || operationStatus === 'running' ? 'Scanning…' : 'Run Scan'}
        </INNOButton>
      ) : undefined}
    >

      <div className="discovery-layout">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>Run scan</h3><p>Private/loopback IPv4 only · maximum 512 addresses per scan.</p></div>
            {operationStatus ? <INNOStatus tone={operationStatus === 'succeeded' ? 'success' : operationStatus === 'failed' ? 'danger' : 'info'}>{operationStatus}</INNOStatus> : null}
          </div>
          <div className="editor-form">
            <label className="field-block field-wide">
              <span>Network ranges</span>
              <textarea
                rows={4}
                value={rangeInput}
                onChange={(event) => setRangeInput(event.target.value)}
                placeholder={'Example: 10.20.1.0/24\n10.20.3.0/24'}
                disabled={!canManage || create.isPending || operationStatus === 'queued' || operationStatus === 'running'}
              />
              <small>Public ranges are rejected server-side.</small>
            </label>
            {create.isError ? <ErrorState error={create.error} /> : null}
          </div>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Current scan</h3><p>Canonical progress from the shared INNO.One operation resource.</p></div></div>
          {!current ? (
            <div className="compact-empty">No scan started in this session.</div>
          ) : (
            <div className="scan-summary">
              <div className="scan-progress-track" aria-label={'Scan progress ' + progress + '%'}>
                <span style={{ width: progress + '%' }} />
              </div>
              <div className="scan-metrics">
                <div><b>{current.addressesScanned}</b><span>Addresses scanned</span></div>
                <div><b>{current.devicesFound}</b><span>Devices found</span></div>
                <div><b>{current.unmanagedCount}</b><span>Unmanaged</span></div>
              </div>
              {operation.data ? (
                <div className="table-meta">
                  Operation {operation.data.operationId} · {operation.data.originModule}
                </div>
              ) : null}
              <div className="table-meta">{current.ranges.join(' · ')}</div>
            </div>
          )}
        </section>
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title="Discovery results"
          description="Reachable endpoints from the current completed scan."
          meta={results.data ? <INNOStatus>{results.data.totalItems} results</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search discovery results" value={search} onChange={setSearch} placeholder="Search IP, hostname or OS…" />
          <INNOSelectField label="Management status" value={resultStatus} onChange={setResultStatus}>
            <option value="all">Status: All</option>
            <option value="unmanaged">Unmanaged</option>
            <option value="managed">Managed</option>
          </INNOSelectField>
        </INNOCollectionToolbar>

        {!scanId ? (
          <INNOCollectionState kind="empty" title="Run discovery to see results" description="Start a scan above using one or more approved private CIDR ranges." />
        ) : scan.isPending || current?.status === 'queued' || current?.status === 'running' ? (
          <CollectionLoadingState label="Discovery scan in progress…" />
        ) : scan.isError ? (
          <CollectionErrorState error={scan.error} retry={() => void scan.refetch()} />
        ) : current?.status === 'failed' ? (
          <INNOCollectionState kind="error" title="Discovery scan failed" description="The scan could not be completed. Review the scan settings and try again." />
        ) : results.isPending ? (
          <CollectionLoadingState label="Loading discovery results…" />
        ) : results.isError ? (
          <CollectionErrorState error={results.error} retry={() => void results.refetch()} />
        ) : results.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || resultStatus !== 'all' ? 'no-results' : 'empty'}
            title={search || resultStatus !== 'all' ? 'No discovery results found' : 'No endpoints matched'}
            description={search || resultStatus !== 'all' ? 'Try another search or clear the filters.' : 'No reachable endpoints were returned by this scan.'}
            action={search || resultStatus !== 'all' ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setResultStatus('all'); }}>Clear filters</INNOButton> : undefined}
          />
        ) : (
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>IP Address</th><th>Hostname</th><th>Detected OS</th><th>Vendor</th><th>Discovery</th><th>Status</th></tr></thead>
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
