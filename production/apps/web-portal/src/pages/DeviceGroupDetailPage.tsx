import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterStart, INNOResourceHeader, INNOResourceSummary, INNOResourceSummaryItem, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOSurfaceTabs, INNOTableWrap } from '@inno/ui';
import { getDeviceGroup, getDeviceGroupMembers, updateDeviceGroup } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

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
  const { groupId = '' } = useParams();
  const canManage = usePermission('devices.manage');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
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

  const update = useMutation({
    mutationFn: () => updateDeviceGroup(groupId, group.data?.eTag ?? '', {
      name,
      description,
      status,
    }),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['device-group', groupId] });
      await queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });

  function cancelEditing() {
    if (group.data) {
      setName(group.data.name);
      setDescription(group.data.description ?? '');
      setStatus(group.data.status);
    }
    setEditing(false);
  }

  if (group.isPending) {
    return <div className="page-loading-wrap"><LoadingState label="Loading device group…" /></div>;
  }

  if (group.isError) {
    return <div className="page-error-wrap"><ErrorState error={group.error} retry={() => void group.refetch()} /></div>;
  }

  const data = group.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/devices/groups">Device Groups</Link><span>›</span><span>{data.name}</span>
      </div>

      <INNOResourceHeader
        icon={<INNOIcon token="section.groups" size={20} />}
        title={data.name}
        status={<><INNOStatus tone={data.status === 'active' ? 'success' : 'neutral'} dot>{data.status}</INNOStatus><INNOStatus tone={data.syncStatus === 'synced' ? 'success' : 'neutral'}>{data.syncStatus}</INNOStatus></>}
        meta={<><span>{data.code}</span><span>·</span><span>{data.groupType}</span>{data.description ? <><span>·</span><span>{data.description}</span></> : null}</>}
        actions={canManage && !editing ? <INNOButton variant="secondary" onClick={() => { setActiveTab('overview'); setEditing(true); }}>Edit Group</INNOButton> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Members" value={data.members} detail="Managed endpoints" />
        <INNOResourceSummaryItem label="Online" value={data.online} detail="Current connection state" />
        <INNOResourceSummaryItem label="Organization" value={data.organization?.name ?? '—'} detail="Authorization scope" />
        <INNOResourceSummaryItem label="Location" value={data.location?.name ?? '—'} detail="Primary site" />
      </INNOResourceSummary>

      {!editing ? (
        <INNOSurfaceTabs
          ariaLabel="Device group detail sections"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as 'overview' | 'members')}
          items={[
            { id: 'overview', label: 'Overview' },
            { id: 'members', label: 'Members' },
          ]}
        />
      ) : null}

      <div hidden={activeTab !== 'overview'}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>{editing ? 'Edit group' : 'Group information'}</h3><p>{editing ? 'Changes are protected with the current resource ETag.' : 'Canonical group identity and scope.'}</p></div></div>
          {editing ? (
            <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (!update.isPending) update.mutate(); }}>
              <div className="editor-grid">
                <label className="field-block"><span>Group name</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label className="field-block"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="field-block field-wide"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              </div>
              {update.isError ? <ErrorState error={update.error} /> : null}
              <INNOEditorFooter>
                <INNOEditorFooterStart>
                  <INNOButton type="button" variant="secondary" disabled={update.isPending} onClick={cancelEditing}>Cancel</INNOButton>
                </INNOEditorFooterStart>
                <INNOEditorFooterEnd>
                  <INNOButton type="submit" busy={update.isPending} disabled={!name.trim()}>Save Changes</INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            </form>
          ) : (
            <div className="kv-grid production-kv-grid">
              <div className="kv-row"><span>Code</span><b>{data.code}</b></div>
              <div className="kv-row"><span>Type</span><b>{data.groupType}</b></div>
              <div className="kv-row"><span>Description</span><b>{data.description || '—'}</b></div>
              <div className="kv-row"><span>Sync status</span><b>{data.syncStatus}</b></div>
            </div>
          )}
        </section>
      </div>

      <div hidden={activeTab !== 'members'}>
      <INNOCollection>
        <INNOCollectionHeader
          title="Group members"
          description="Devices currently resolved into this static group."
          meta={<INNOStatus>{members.data?.totalItems ?? data.members} devices</INNOStatus>}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search group members" value={search} onChange={setSearch} placeholder="Search device or owner…" />
          <INNOSelectField label="Member status" value={memberStatus} onChange={setMemberStatus}>
            <option value="all">Status: All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </INNOSelectField>
        </INNOCollectionToolbar>

        {members.isPending ? (
          <div className="collection-state"><LoadingState label="Loading group members…" /></div>
        ) : members.isError ? (
          <div className="collection-state"><ErrorState error={members.error} retry={() => void members.refetch()} /></div>
        ) : members.data.items.length === 0 ? (
          <div className="collection-state"><INNOState kind={search || memberStatus !== 'all' ? 'no-results' : 'empty'} title={search || memberStatus !== 'all' ? 'No group members found' : 'No members yet'} description="Membership updates as managed endpoints synchronize into this group." /></div>
        ) : (
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>Device</th><th>Type</th><th>User</th><th>Organization</th><th>Status</th><th>Last Seen</th><th className="action-column">Action</th></tr></thead>
              <tbody>
                {members.data.items.map((device) => (
                  <tr key={device.id}>
                    <td><b>{device.name}</b><div className="table-meta">{device.ipAddress ?? '—'}</div></td>
                    <td>{device.type}</td>
                    <td>{device.user ?? '—'}</td>
                    <td>{device.organization ?? '—'}</td>
                    <td><INNOStatus tone={device.status === 'online' ? 'success' : 'neutral'} dot>{device.status}</INNOStatus></td>
                    <td>{formatLastSeen(device.lastSeenAt)}</td>
                    <td className="action-column"><Link className="device-row-action" to={'/devices/' + device.id} aria-label={'Open ' + device.name}><INNOIcon token="action.next" size={14} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>
      </div>
    </main>
  );
}
