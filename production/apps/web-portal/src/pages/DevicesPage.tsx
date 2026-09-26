import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOPage, INNOState } from '@inno/ui';
import { getDevices } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatLastSeen(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'Now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function typeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DevicesPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [os, setOs] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => setPage(1), [deferredSearch, status, os]);

  const query = useQuery({
    queryKey: ['devices', page, pageSize, deferredSearch, status, os],
    queryFn: () => getDevices({
      page,
      pageSize,
      search: deferredSearch,
      status,
      os,
      sort: 'lastSeenAt',
      order: 'desc',
    }),
  });

  return (
    <INNOPage eyebrow="Devices" title="All Devices">
      <p className="page-helper">Find, filter and open managed endpoints inside your effective access scope.</p>

      <section className="collection-card">
        <div className="collection-head">
          <div>
            <h2>Devices</h2>
            <p>{query.data ? `${query.data.totalItems} managed endpoints in scope` : 'Managed endpoints'}</p>
          </div>
          {query.data ? <span className="prod-tag">{query.data.totalItems} devices</span> : null}
        </div>

        <div className="collection-toolbar">
          <label className="search-field">
            <span className="sr-only">Search devices</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, IP, serial, OS…"
            />
          </label>
          <label>
            <span className="sr-only">Status filter</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Status: All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Operating system filter</span>
            <select value={os} onChange={(event) => setOs(event.target.value)}>
              <option value="all">OS: All</option>
              <option value="Windows 11">Windows 11</option>
              <option value="Windows 10">Windows 10</option>
              <option value="Windows Server">Windows Server</option>
            </select>
          </label>
          <span className="toolbar-spacer" />
          <span className="collection-scope">Authorization filtered server-side</span>
        </div>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading devices…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title={search || status !== 'all' || os !== 'all' ? 'No devices found' : 'No devices in scope'}
              description={search || status !== 'all' || os !== 'all'
                ? 'Try another search or clear the filters.'
                : 'No managed endpoint is visible inside your effective resource scope.'}
              action={search || status !== 'all' || os !== 'all' ? (
                <div className="state-action">
                  <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setOs('all'); }}>
                    Clear filters
                  </INNOButton>
                </div>
              ) : undefined}
            />
          </div>
        ) : (
          <>
            <div className="production-table-wrap">
              <table className="production-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>User</th>
                    <th>OS</th>
                    <th>Group</th>
                    <th>Last Seen</th>
                    <th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <b>{device.name}</b>
                        <div className="table-meta">
                          {[device.ipAddress, device.serialNumber].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td>{typeLabel(device.type)}</td>
                      <td><span className={`status-dot ${device.status}`}>{device.status}</span></td>
                      <td>{device.user ?? '—'}</td>
                      <td>{device.operatingSystem ?? '—'}</td>
                      <td>{device.group ?? device.organization ?? '—'}</td>
                      <td>{formatLastSeen(device.lastSeenAt)}</td>
                      <td className="action-column">
                        <Link className="open-resource" to={`/devices/${device.id}`} aria-label={`Open ${device.name}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="collection-footer">
              <span>
                Showing {(query.data.page - 1) * query.data.pageSize + 1}–
                {Math.min(query.data.page * query.data.pageSize, query.data.totalItems)} of {query.data.totalItems}
              </span>
              <div className="pagination-actions">
                <INNOButton
                  variant="secondary"
                  disabled={query.data.page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </INNOButton>
                <span>Page {query.data.page} of {Math.max(query.data.totalPages, 1)}</span>
                <INNOButton
                  variant="secondary"
                  disabled={query.data.page >= query.data.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </INNOButton>
              </div>
            </div>
          </>
        )}
      </section>
    </INNOPage>
  );
}
