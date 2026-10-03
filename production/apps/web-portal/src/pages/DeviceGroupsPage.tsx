import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RouterRowAction } from '../components/RouterRowAction';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNODialog,
  INNOPage,
  INNOPagination,
  INNOSearchField,
  INNOSelectField,
  INNOStatus,
  INNOTableWrap,
  INNOToolbarMeta,
  INNOToolbarSpacer,
} from '@inno/ui';
import { createDeviceGroup, getDeviceGroups } from '../api/client';
import { CollectionErrorState, CollectionLoadingState, ErrorState } from '../components/Feedback';
import { usePermission, useProfile } from '../app/ProfileContext';

export function DeviceGroupsPage() {
  const profile = useProfile();
  const canManage = usePermission('devices.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [type, setType] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => setPage(1), [deferredSearch, type]);

  const groups = useQuery({
    queryKey: ['device-groups', page, deferredSearch, type],
    queryFn: () => getDeviceGroups({
      page,
      pageSize: 25,
      search: deferredSearch,
      type,
      status: 'active',
    }),
  });

  const closeCreate = () => {
    if (create.isPending) return;
    setCreateOpen(false);
    setName('');
    setCode('');
    setDescription('');
  };

  const create = useMutation({
    mutationFn: () => createDeviceGroup({
      name,
      code: code || undefined,
      description: description || undefined,
      organizationId: profile.organization?.id,
      locationId: profile.location?.id,
    }),
    onSuccess: async () => {
      closeCreate();
      await queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });

  return (
    <INNOPage
      eyebrow="Devices"
      title="Device Groups"
      description="Manage static endpoint groups and keep their membership synchronized with the remote device engine."
      actions={canManage ? (
        <INNOButton type="button" onClick={() => setCreateOpen(true)}>
          New Device Group
        </INNOButton>
      ) : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Groups"
          description={groups.data ? groups.data.totalItems + ' groups in your effective scope' : 'Managed endpoint groups'}
          meta={groups.data ? <INNOStatus>{groups.data.totalItems} groups</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search device groups" value={search} onChange={setSearch} placeholder="Search group name or code…" />
          <INNOSelectField label="Group type" value={type} onChange={setType}>
            <option value="all">Type: All</option>
            <option value="static">Static</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>Dynamic groups are hidden until the rule engine is implemented</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {groups.isPending ? (
          <CollectionLoadingState label="Loading device groups…" />
        ) : groups.isError ? (
          <CollectionErrorState error={groups.error} retry={() => void groups.refetch()} />
        ) : groups.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || type !== 'all' ? 'no-results' : 'empty'}
            title={search || type !== 'all' ? 'No groups found' : 'No device groups in scope'}
            description={search || type !== 'all' ? 'Try another search or filter.' : 'Create a static group to organize managed endpoints.'}
            action={search || type !== 'all' ? (
              <INNOButton variant="secondary" onClick={() => { setSearch(''); setType('all'); }}>Clear filters</INNOButton>
            ) : undefined}
          />
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr>
                    <th>Group</th><th>Type</th><th>Organization</th><th>Location</th><th>Devices</th><th>Online</th><th>Sync</th><th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.data.items.map((group) => (
                    <tr key={group.id}>
                      <td><b>{group.name}</b><div className="table-meta">{group.code}</div></td>
                      <td>{group.groupType}</td>
                      <td>{group.organization ?? '—'}</td>
                      <td>{group.location ?? '—'}</td>
                      <td>{group.members}</td>
                      <td>{group.online}</td>
                      <td><INNOStatus tone={group.syncStatus === 'synced' ? 'success' : 'neutral'}>{group.syncStatus}</INNOStatus></td>
                      <td className="action-column"><RouterRowAction to={'/devices/groups/' + group.id} ariaLabel={'Open ' + group.name} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={page}
              totalPages={groups.data.totalPages}
              totalItems={groups.data.totalItems}
              pageSize={groups.data.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </INNOCollection>

      <INNODialog
        open={createOpen}
        title="New Device Group"
        description="Create a static managed-endpoint group in the current organization scope."
        onClose={closeCreate}
        size="md"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={create.isPending} onClick={closeCreate}>Cancel</INNOButton>
          <INNOButton type="submit" form="device-group-create-form" busy={create.isPending} disabled={!name.trim()}>Create Group</INNOButton>
        </>}
      >
        <form
          id="device-group-create-form"
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || create.isPending) return;
            create.mutate();
          }}
        >
          <div className="editor-grid">
            <label className="field-block">
              <span>Group name</span>
              <input data-autofocus required value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field-block">
              <span>Code</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Generated if empty" />
            </label>
            <label className="field-block field-wide">
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>
          </div>
          <div className="editor-scope-note">
            Scope: {profile.organization?.name ?? 'Current organization'}
            {profile.location?.name ? ' · ' + profile.location.name : ''}
          </div>
          {create.isError ? <ErrorState error={create.error} /> : null}
        </form>
      </INNODialog>
    </INNOPage>
  );
}
