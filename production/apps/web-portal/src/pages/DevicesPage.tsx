import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarSpacer } from '@inno/ui';
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
    <INNOPage
      eyebrow="Devices"
      title="All Devices"
      description="Find, filter and open managed endpoints inside your effective access scope."
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Devices"
          description={query.data ? `${query.data.totalItems} managed endpoints in scope` : 'Managed endpoints'}
          meta={query.data ? <INNOStatus>{query.data.totalItems} devices</INNOStatus> : undefined}
        />

        <INNOCollectionToolbar>
          <INNOSearchField
            label="Search devices"
            value={search}
            onChange={setSearch}
            placeholder="Search name, IP, serial, OS…"
          />
          <INNOSelectField label="Status filter" value={status} onChange={setStatus}>
            <option value="all">Status: All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </INNOSelectField>
          <INNOSelectField label="Operating system filter" value={os} onChange={setOs}>
            <option value="all">OS: All</option>
            <option value="Windows 11">Windows 11</option>
            <option value="Windows 10">Windows 10</option>
            <option value="Windows Server">Windows Server</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <span className="collection-scope">Authorization filtered server-side</span>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading devices…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              kind={search || status !== 'all' || os !== 'all' ? 'no-results' : 'empty'}
              title={search || status !== 'all' || os !== 'all' ? 'No devices found' : 'No devices in scope'}
              description={search || status !== 'all' || os !== 'all'
                ? 'Try another search or clear the filters.'
                : 'No managed endpoint is visible inside your effective resource scope.'}
              action={search || status !== 'all' || os !== 'all' ? (
                <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setOs('all'); }}>
                  Clear filters
                </INNOButton>
              ) : undefined}
            />
          </div>
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table>
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
                      <td><INNOStatus tone={device.status === 'online' ? 'success' : 'neutral'} dot>{device.status}</INNOStatus></td>
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
            </INNOTableWrap>
            <INNOPagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalItems={query.data.totalItems}
              pageSize={query.data.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
