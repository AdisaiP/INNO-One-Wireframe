import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOIcon, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOStatus, INNOTableWrap, INNOToolbarSpacer } from '@inno/ui';
import { getDevices } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { RouterRowAction } from '../components/RouterRowAction';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function formatLastSeen(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diffMinutes < 1) return relative.format(0, 'minute');
  if (diffMinutes < 60) return relative.format(-diffMinutes, 'minute');
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

function typeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type DeviceColumn = 'type' | 'status' | 'user' | 'os' | 'group' | 'lastSeen';

function DeviceTypeGlyph({ type }: { type: string }) {
  const kind = type.toLowerCase();
  const token = kind.includes('server')
    ? 'device.server'
    : kind.includes('notebook') || kind.includes('laptop')
      ? 'device.laptop'
      : kind.includes('virtual') || kind.includes('vm')
        ? 'device.virtual'
        : 'device.desktop';
  return <span className="device-type-glyph" aria-hidden="true"><INNOIcon token={token} size={15} /></span>;
}

export function DevicesPage() {
  const { t: t45n, locale } = useStep45NI18n();
  const canDeploy = usePermission('devices.deploy');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [os, setOs] = useState('all');
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState<Record<DeviceColumn, boolean>>({
    type: true,
    status: true,
    user: true,
    os: true,
    group: true,
    lastSeen: true,
  });
  const pageSize = 25;

  useEffect(() => setPage(1), [deferredSearch, status, os]);

  const toggleColumn = (column: DeviceColumn) => {
    setColumns((current) => ({ ...current, [column]: !current[column] }));
  };

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
      eyebrow={t45n('navigation.devices')}
      title={t45n('devices.step45n.devices.allDevices')}
      description={t45n('devices.step45n.devices.findFilterAndOpenManagedEndpointsInsideYour')}
      actions={
        <>
          <Link className="inno-link-button secondary" to="/devices/discovery">{t45n('devices.step45n.devices.discover')}</Link>
          {canDeploy ? <Link className="inno-link-button" to="/devices/add">{t45n('devices.step45n.devices.addDevice')}</Link> : null}
        </>
      }
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('navigation.devices')}
          description={query.data ? t45n('devices.step45n.devices.inScopeCount', { count: query.data.totalItems }) : t45n('devices.step45n.devices.managedEndpoints')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('devices.step45n.deviceGroupDetail.devices')}</INNOStatus> : undefined}
        />

        <INNOCollectionToolbar>
          <INNOSearchField
            label={t45n('devices.step45n.devices.searchDevices')}
            value={search}
            onChange={setSearch}
            placeholder={t45n('devices.step45n.devices.searchNameIpSerialOs')}
          />
          <INNOSelectField label={t45n('assets.step45n.assetInventory.statusFilter')} value={status} onChange={setStatus}>
            <option value="all">{t45n('admin.step45n.adminUsers.statusAll')}</option>
            <option value="online">{t45n('devices.automation.editor.status.online')}</option>
            <option value="offline">{t45n('devices.automation.editor.status.offline')}</option>
          </INNOSelectField>
          <INNOSelectField label={t45n('devices.step45n.devices.operatingSystemFilter')} value={os} onChange={setOs}>
            <option value="all">{t45n('devices.step45n.devices.osAll')}</option>
            <option value="Windows 11">{t45n('devices.step45n.devices.windows11')}</option>
            <option value="Windows 10">{t45n('devices.step45n.devices.windows10')}</option>
            <option value="Windows Server">{t45n('devices.step45n.devices.windowsServer')}</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <details className="device-columns-menu">
            <summary className="inno-btn inno-btn--secondary">{t45n('reports.editor.columns')}</summary>
            <div className="device-columns-popover" role="group" aria-label={t45n('devices.step45n.devices.visibleDeviceColumns')}>
              {([
                ['type', t45n('reports.column.type')],
                ['status', t45n('reports.runs.status')],
                ['user', t45n('common.user')],
                ['os', t45n('devices.step45n.devices.os')],
                ['group', t45n('admin.settings.table.group')],
                ['lastSeen', t45n('reports.column.lastSeenAt')],
              ] as Array<[DeviceColumn, string]>).map(([column, label]) => (
                <label key={column}>
                  <input type="checkbox" checked={columns[column]} onChange={() => toggleColumn(column)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label={t45n('devices.step45n.devices.loadingDevices')} />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || status !== 'all' || os !== 'all' ? 'no-results' : 'empty'}
            title={search || status !== 'all' || os !== 'all' ? t45n('devices.step45n.devices.noDevicesFound') : t45n('devices.step45n.devices.noDevicesInScope')}
            description={search || status !== 'all' || os !== 'all'
              ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters')
              : t45n('devices.step45n.devices.noManagedEndpointIsVisibleInsideYourEffective')}
            action={search || status !== 'all' || os !== 'all' ? (
              <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setOs('all'); }}>
                {t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
            ) : undefined}
          />
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr>
                    <th>{t45n('reports.column.hostname')}</th>
                    {columns.type ? <th>{t45n('reports.column.type')}</th> : null}
                    {columns.status ? <th>{t45n('reports.runs.status')}</th> : null}
                    {columns.user ? <th>{t45n('common.user')}</th> : null}
                    {columns.os ? <th>{t45n('devices.step45n.devices.os')}</th> : null}
                    {columns.group ? <th>{t45n('admin.settings.table.group')}</th> : null}
                    {columns.lastSeen ? <th>{t45n('reports.column.lastSeenAt')}</th> : null}
                    <th className="action-column">{t45n('reports.table.action')}</th>
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
                      {columns.type ? <td><span className="device-type-cell"><DeviceTypeGlyph type={device.type} />{typeLabel(device.type)}</span></td> : null}
                      {columns.status ? <td><INNOStatus tone={device.status === 'online' ? 'success' : 'neutral'} dot>{device.status === 'online' ? t45n('devices.automation.editor.status.online') : t45n('devices.automation.editor.status.offline')}</INNOStatus></td> : null}
                      {columns.user ? <td>{device.user ?? '—'}</td> : null}
                      {columns.os ? <td>{device.operatingSystem ?? '—'}</td> : null}
                      {columns.group ? <td>{device.group ?? device.organization ?? '—'}</td> : null}
                      {columns.lastSeen ? <td>{formatLastSeen(device.lastSeenAt, locale)}</td> : null}
                      <td className="action-column">
                        <RouterRowAction to={`/devices/${device.id}`} ariaLabel={t45n('devices.step45n.devices.openDevice', { name: device.name })} />
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
