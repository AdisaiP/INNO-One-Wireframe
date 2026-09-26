import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOPage, INNOState } from '@inno/ui';
import { createDeviceGroup, getDeviceGroups } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission, useProfile } from '../app/ProfileContext';

export function DeviceGroupsPage() {
  const profile = useProfile();
  const canManage = usePermission('devices.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [type, setType] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
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

  const create = useMutation({
    mutationFn: () => createDeviceGroup({
      name,
      code: code || undefined,
      description: description || undefined,
      organizationId: profile.organization?.id,
      locationId: profile.location?.id,
    }),
    onSuccess: async () => {
      setName('');
      setCode('');
      setDescription('');
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });

  return (
    <INNOPage eyebrow="Devices" title="Device Groups">
      <div className="page-intro-row">
        <p className="page-helper">
          Manage static endpoint groups and keep their membership synchronized with the remote device engine.
        </p>
        {canManage ? (
          <INNOButton type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? 'Cancel' : 'New Device Group'}
          </INNOButton>
        ) : null}
      </div>

      {showCreate ? (
        <section className="prod-panel create-panel">
          <div className="prod-panel-head">
            <div>
              <h3>New Device Group</h3>
              <p>Creates the canonical INNO.One group and provisions its MeshCentral group when available.</p>
            </div>
          </div>
          <form
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
                <input required value={name} onChange={(event) => setName(event.target.value)} />
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
            <div className="editor-footer">
              <INNOButton type="submit" disabled={!name.trim() || create.isPending}>
                {create.isPending ? 'Creating…' : 'Create Group'}
              </INNOButton>
            </div>
          </form>
        </section>
      ) : null}

      <section className="collection-card">
        <div className="collection-head">
          <div>
            <h2>Groups</h2>
            <p>{groups.data ? groups.data.totalItems + ' groups in your effective scope' : 'Managed endpoint groups'}</p>
          </div>
        </div>
        <div className="collection-toolbar">
          <label className="search-field">
            <span className="sr-only">Search device groups</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search group name or code…" />
          </label>
          <label>
            <span className="sr-only">Group type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">Type: All</option>
              <option value="static">Static</option>
            </select>
          </label>
          <span className="toolbar-spacer" />
          <span className="collection-scope">Dynamic rules remain hidden until their rule engine is implemented</span>
        </div>

        {groups.isPending ? (
          <div className="collection-state"><LoadingState label="Loading device groups…" /></div>
        ) : groups.isError ? (
          <div className="collection-state"><ErrorState error={groups.error} retry={() => void groups.refetch()} /></div>
        ) : groups.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title={search ? 'No groups found' : 'No device groups in scope'}
              description={search ? 'Try another search.' : 'Create a static group to organize managed endpoints.'}
            />
          </div>
        ) : (
          <>
            <div className="production-table-wrap">
              <table className="production-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Type</th>
                    <th>Organization</th>
                    <th>Location</th>
                    <th>Devices</th>
                    <th>Online</th>
                    <th>Sync</th>
                    <th className="action-column">Action</th>
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
                      <td><span className={'prod-tag ' + (group.syncStatus === 'synced' ? 'success' : '')}>{group.syncStatus}</span></td>
                      <td className="action-column"><Link className="open-resource" to={'/devices/groups/' + group.id}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="collection-footer">
              <span>{groups.data.totalItems} total groups</span>
              <div className="pagination-actions">
                <INNOButton variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</INNOButton>
                <span>Page {page} of {Math.max(groups.data.totalPages, 1)}</span>
                <INNOButton variant="secondary" disabled={page >= groups.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</INNOButton>
              </div>
            </div>
          </>
        )}
      </section>
    </INNOPage>
  );
}
