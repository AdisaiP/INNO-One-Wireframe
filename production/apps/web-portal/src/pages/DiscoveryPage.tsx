import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { INNOButton, INNOPage, INNOState } from '@inno/ui';
import {
  createDiscoveryScan,
  getDiscoveryResults,
  getDiscoveryScan,
} from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
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
  const [search, setSearch] = useState('');
  const [resultStatus, setResultStatus] = useState('unmanaged');
  const ranges = useMemo(() => splitRanges(rangeInput), [rangeInput]);

  const create = useMutation({
    mutationFn: () => createDiscoveryScan(ranges),
    onSuccess: (operation) => {
      setScanId(operation.resource.scanId);
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
  const progress = current?.progress ?? (create.isPending ? 1 : 0);

  return (
    <INNOPage eyebrow="Devices" title="Network Discovery">
      <div className="page-intro-row">
        <p className="page-helper">
          Scan approved private IPv4 ranges to find reachable endpoints that are not yet managed by INNO.One.
        </p>
      </div>

      <div className="discovery-layout">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>Run scan</h3><p>Private/loopback IPv4 only · maximum 512 addresses per scan.</p></div>
            {current ? <span className={'prod-tag ' + (current.status === 'succeeded' ? 'success' : '')}>{current.status}</span> : null}
          </div>
          <div className="editor-form">
            <label className="field-block field-wide">
              <span>Network ranges</span>
              <textarea
                rows={4}
                value={rangeInput}
                onChange={(event) => setRangeInput(event.target.value)}
                placeholder={'Example: 10.20.1.0/24\n10.20.3.0/24'}
                disabled={!canManage || create.isPending || current?.status === 'running'}
              />
              <small>Public ranges are rejected server-side.</small>
            </label>
            {create.isError ? <ErrorState error={create.error} /> : null}
            <div className="editor-footer">
              {canManage ? (
                <INNOButton
                  type="button"
                  disabled={ranges.length === 0 || create.isPending || current?.status === 'running'}
                  onClick={() => create.mutate()}
                >
                  {current?.status === 'running' ? 'Scanning…' : create.isPending ? 'Starting…' : 'Run Scan'}
                </INNOButton>
              ) : null}
            </div>
          </div>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Current scan</h3><p>Durable operation progress from the Devices service.</p></div></div>
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
              <div className="table-meta">{current.ranges.join(' · ')}</div>
            </div>
          )}
        </section>
      </div>

      <section className="collection-card">
        <div className="collection-head">
          <div><h2>Discovery results</h2><p>Reachable endpoints from the current completed scan.</p></div>
          {results.data ? <span className="prod-tag">{results.data.totalItems} results</span> : null}
        </div>
        <div className="collection-toolbar">
          <label className="search-field"><span className="sr-only">Search discovery results</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search IP, hostname or OS…" /></label>
          <label><span className="sr-only">Management status</span><select value={resultStatus} onChange={(event) => setResultStatus(event.target.value)}><option value="all">Status: All</option><option value="unmanaged">Unmanaged</option><option value="managed">Managed</option></select></label>
        </div>

        {!scanId ? (
          <div className="collection-state"><INNOState title="Run discovery to see results" description="Start a scan above using one or more approved private CIDR ranges." /></div>
        ) : scan.isPending || current?.status === 'queued' || current?.status === 'running' ? (
          <div className="collection-state"><LoadingState label="Discovery scan in progress…" /></div>
        ) : scan.isError ? (
          <div className="collection-state"><ErrorState error={scan.error} retry={() => void scan.refetch()} /></div>
        ) : current?.status === 'failed' ? (
          <div className="collection-state"><INNOState title="Discovery scan failed" description={current.errorCode ?? 'The scan could not be completed.'} /></div>
        ) : results.isPending ? (
          <div className="collection-state"><LoadingState label="Loading discovery results…" /></div>
        ) : results.isError ? (
          <div className="collection-state"><ErrorState error={results.error} retry={() => void results.refetch()} /></div>
        ) : results.data.items.length === 0 ? (
          <div className="collection-state"><INNOState title={search ? 'No discovery results found' : 'No endpoints matched'} description="No reachable endpoints match the current result filter." /></div>
        ) : (
          <div className="production-table-wrap">
            <table className="production-table">
              <thead><tr><th>IP Address</th><th>Hostname</th><th>Detected OS</th><th>Vendor</th><th>Discovery</th><th>Status</th></tr></thead>
              <tbody>
                {results.data.items.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.ipAddress}</b></td>
                    <td>{row.hostname ?? '—'}</td>
                    <td>{row.detectedOperatingSystem ?? '—'}</td>
                    <td>{row.vendor ?? '—'}</td>
                    <td>{row.discoveryMethod}</td>
                    <td><span className={'prod-tag ' + (row.managementStatus === 'managed' ? 'success' : '')}>{row.managementStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </INNOPage>
  );
}
