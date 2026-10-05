import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNODialog,
  INNOIcon,
  INNOResourceHeader,
  INNOResourceSummary,
  INNOResourceSummaryItem,
  INNOSearchField,
  INNOSelectField,
  INNOStatus,
  INNOSurfaceTabs,
  INNOTableWrap,
} from '@inno/ui';
import { getDeviceGroup, getDeviceGroupMembers, updateDeviceGroup } from '../api/client';
import { CollectionErrorState, CollectionLoadingState, ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { RouterRowAction } from '../components/RouterRowAction';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function formatLastSeen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.round(minutes / 60) + 'h ago';
  return date.toLocaleString();
}

export function DeviceGroupDetailPage() {
  const { t: t45n } = useStep45NI18n();
  const { groupId = '' } = useParams();
  const canManage = usePermission('devices.manage');
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'members'>('overview');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [memberStatus, setMemberStatus] = useState('all');

  const group = useQuery({
    queryKey: ['device-group', groupId],
    queryFn: () => getDeviceGroup(groupId),
    enabled: Boolean(groupId),
  });

  useEffect(() => {
    if (!group.data) return;
    setName(group.data.name);
    setDescription(group.data.description ?? '');
    setStatus(group.data.status);
  }, [group.data]);

  const members = useQuery({
    queryKey: ['device-group-members', groupId, deferredSearch, memberStatus],
    queryFn: () => getDeviceGroupMembers(groupId, {
      page: 1,
      pageSize: 50,
      search: deferredSearch,
      status: memberStatus,
    }),
    enabled: Boolean(groupId),
  });

  const closeEdit = () => {
    if (update.isPending) return;
    if (group.data) {
      setName(group.data.name);
      setDescription(group.data.description ?? '');
      setStatus(group.data.status);
    }
    setEditOpen(false);
  };

  const update = useMutation({
    mutationFn: () => updateDeviceGroup(groupId, group.data?.eTag ?? '', {
      name,
      description,
      status,
    }),
    onSuccess: async () => {
      setEditOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['device-group', groupId] }),
        queryClient.invalidateQueries({ queryKey: ['device-groups'] }),
      ]);
    },
  });

  if (group.isPending) {
    return <div className="page-loading-wrap"><LoadingState label={t45n('devices.step45n.deviceGroupDetail.loadingDeviceGroup')} /></div>;
  }
  if (group.isError) {
    return <div className="page-error-wrap"><ErrorState error={group.error} retry={() => void group.refetch()} /></div>;
  }

  const data = group.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/devices/groups">{t45n('navigation.deviceGroups')}</Link><span>›</span><span>{data.name}</span>
      </div>

      <INNOResourceHeader
        icon={<INNOIcon token="section.groups" size={20} />}
        title={data.name}
        status={<><INNOStatus tone={data.status === 'active' ? 'success' : 'neutral'} dot>{data.status}</INNOStatus><INNOStatus tone={data.syncStatus === 'synced' ? 'success' : 'neutral'}>{data.syncStatus}</INNOStatus></>}
        meta={<><span>{data.code}</span><span>·</span><span>{data.groupType}</span>{data.description ? <><span>·</span><span>{data.description}</span></> : null}</>}
        actions={canManage ? <INNOButton variant="secondary" onClick={() => setEditOpen(true)}>{t45n('devices.step45n.deviceGroupDetail.editGroup')}</INNOButton> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('devices.step45n.deviceGroupDetail.members')} value={data.members} detail="Managed endpoints" />
        <INNOResourceSummaryItem label={t45n('devices.shared.status.online')} value={data.online} detail="Current connection state" />
        <INNOResourceSummaryItem label={t45n('profile.organization')} value={data.organization?.name ?? '—'} detail="Authorization scope" />
        <INNOResourceSummaryItem label={t45n('profile.location')} value={data.location?.name ?? '—'} detail="Primary site" />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel={t45n('devices.step45n.deviceGroupDetail.deviceGroupDetailSections')}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'members')}
        items={[
          { id: 'overview', label: t45n('navigation.overview') },
          { id: 'members', label: t45n('devices.step45n.deviceGroupDetail.members') },
        ]}
      />

      <div hidden={activeTab !== 'overview'}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>{t45n('devices.step45n.deviceGroupDetail.groupInformation')}</h3><p>{t45n('devices.step45n.deviceGroupDetail.canonicalGroupIdentityAndScope')}</p></div></div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>{t45n('admin.step45n.adminHierarchy.code')}</span><b>{data.code}</b></div>
            <div className="kv-row"><span>{t45n('reports.column.type')}</span><b>{data.groupType}</b></div>
            <div className="kv-row"><span>{t45n('reports.editor.descriptionField')}</span><b>{data.description || '—'}</b></div>
            <div className="kv-row"><span>{t45n('devices.step45n.deviceGroupDetail.syncStatus')}</span><b>{data.syncStatus}</b></div>
          </div>
        </section>
      </div>

      <div hidden={activeTab !== 'members'}>
        <INNOCollection>
          <INNOCollectionHeader
            title={t45n('devices.step45n.deviceGroupDetail.groupMembers')}
            description={t45n('devices.step45n.deviceGroupDetail.devicesCurrentlyResolvedIntoThisStaticGroup')}
            meta={<INNOStatus>{members.data?.totalItems ?? data.members} {t45n('devices.step45n.deviceGroupDetail.devices')}</INNOStatus>}
          />
          <INNOCollectionToolbar>
            <INNOSearchField label={t45n('devices.step45n.deviceGroupDetail.searchGroupMembers')} value={search} onChange={setSearch} placeholder={t45n('devices.step45n.deviceGroupDetail.searchDeviceOrOwner')} />
            <INNOSelectField label={t45n('devices.step45n.deviceGroupDetail.memberStatus')} value={memberStatus} onChange={setMemberStatus}>
              <option value="all">{t45n('admin.step45n.adminUsers.statusAll')}</option>
              <option value="online">{t45n('devices.shared.status.online')}</option>
              <option value="offline">{t45n('devices.shared.status.offline')}</option>
            </INNOSelectField>
          </INNOCollectionToolbar>

          {members.isPending ? (
            <CollectionLoadingState label={t45n('devices.step45n.deviceGroupDetail.loadingGroupMembers')} />
          ) : members.isError ? (
            <CollectionErrorState error={members.error} retry={() => void members.refetch()} />
          ) : members.data.items.length === 0 ? (
            <INNOCollectionState
              kind={search || memberStatus !== 'all' ? 'no-results' : 'empty'}
              title={search || memberStatus !== 'all' ? t45n('devices.step45n.deviceGroupDetail.noGroupMembersFound') : t45n('devices.step45n.deviceGroupDetail.noMembersYet')}
              description={search || memberStatus !== 'all' ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters') : t45n('devices.step45n.deviceGroupDetail.membershipUpdatesAsManagedEndpointsSynchronizeIntoThis')}
              action={search || memberStatus !== 'all'
                ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setMemberStatus('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
                : undefined}
            />
          ) : (
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>{t45n('reports.column.hostname')}</th><th>{t45n('reports.column.type')}</th><th>{t45n('common.user')}</th><th>{t45n('profile.organization')}</th><th>{t45n('reports.runs.status')}</th><th>{t45n('reports.column.lastSeenAt')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
                <tbody>
                  {members.data.items.map((device) => (
                    <tr key={device.id}>
                      <td><b>{device.name}</b><div className="table-meta">{device.ipAddress ?? '—'}</div></td>
                      <td>{device.type}</td>
                      <td>{device.user ?? '—'}</td>
                      <td>{device.organization ?? '—'}</td>
                      <td><INNOStatus tone={device.status === 'online' ? 'success' : 'neutral'} dot>{device.status}</INNOStatus></td>
                      <td>{formatLastSeen(device.lastSeenAt)}</td>
                      <td className="action-column"><RouterRowAction to={'/devices/' + device.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + device.name} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
          )}
        </INNOCollection>
      </div>

      <INNODialog
        open={editOpen}
        title={t45n('devices.step45n.deviceGroupDetail.editDeviceGroup')}
        description={t45n('devices.step45n.deviceGroupDetail.updateTheCompactGroupMetadataMembershipRemainsSection')}
        onClose={closeEdit}
        size="md"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={update.isPending} onClick={closeEdit}>{t45n('reports.action.cancel')}</INNOButton>
          <INNOButton type="submit" form="device-group-edit-form" busy={update.isPending} disabled={!name.trim()}>{t45n('devices.step45n.deviceGroupDetail.saveChanges')}</INNOButton>
        </>}
      >
        <form
          id="device-group-edit-form"
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!update.isPending) update.mutate();
          }}
        >
          <div className="editor-grid">
            <label className="field-block"><span>{t45n('devices.step45n.deviceGroupDetail.groupName')}</span><input data-autofocus required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field-block"><span>{t45n('reports.runs.status')}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">{t45n('reports.status.active')}</option><option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option></select></label>
            <label className="field-block field-wide"><span>{t45n('reports.editor.descriptionField')}</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          {update.isError ? <ErrorState error={update.error} /> : null}
        </form>
      </INNODialog>
    </main>
  );
}
