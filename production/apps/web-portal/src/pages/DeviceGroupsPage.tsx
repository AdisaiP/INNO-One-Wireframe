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
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function DeviceGroupsPage() {
  const { t: t45n } = useStep45NI18n();
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
      eyebrow={t45n('navigation.devices')}
      title={t45n('navigation.deviceGroups')}
      description={t45n('devices.step45n.deviceGroups.manageStaticEndpointGroupsAndKeepTheirMembership')}
      actions={canManage ? (
        <INNOButton type="button" onClick={() => setCreateOpen(true)}>
          {t45n('devices.step45n.deviceGroups.newDeviceGroup')}</INNOButton>
      ) : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('admin.settings.groups')}
          description={groups.data ? groups.data.totalItems + ' ' + t45n('devices.step45n.deviceGroups.groupsInYourEffectiveScope') : t45n('devices.step45n.deviceGroups.managedEndpointGroups')}
          meta={groups.data ? <INNOStatus>{groups.data.totalItems} {t45n('devices.step45n.deviceGroups.groups')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('devices.step45n.deviceGroups.searchDeviceGroups')} value={search} onChange={setSearch} placeholder={t45n('devices.step45n.deviceGroups.searchGroupNameOrCode')} />
          <INNOSelectField label={t45n('devices.step45n.deviceGroups.groupType')} value={type} onChange={setType}>
            <option value="all">{t45n('devices.step45n.deviceGroups.typeAll')}</option>
            <option value="static">{t45n('devices.step45n.deviceGroups.static')}</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>{t45n('devices.step45n.deviceGroups.dynamicGroupsAreHiddenUntilTheRuleEngine')}</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {groups.isPending ? (
          <CollectionLoadingState label={t45n('devices.step45n.agentDeployment.loadingDeviceGroups')} />
        ) : groups.isError ? (
          <CollectionErrorState error={groups.error} retry={() => void groups.refetch()} />
        ) : groups.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || type !== 'all' ? 'no-results' : 'empty'}
            title={search || type !== 'all' ? t45n('devices.step45n.deviceGroups.noGroupsFound') : t45n('devices.step45n.deviceGroups.noDeviceGroupsInScope')}
            description={search || type !== 'all' ? t45n('devices.step45n.deviceGroups.tryAnotherSearchOrFilter') : t45n('devices.step45n.deviceGroups.createAStaticGroupToOrganizeManagedEndpoints')}
            action={search || type !== 'all' ? (
              <INNOButton variant="secondary" onClick={() => { setSearch(''); setType('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
            ) : undefined}
          />
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr>
                    <th>{t45n('admin.settings.table.group')}</th><th>{t45n('reports.column.type')}</th><th>{t45n('profile.organization')}</th><th>{t45n('profile.location')}</th><th>{t45n('navigation.devices')}</th><th>{t45n('devices.automation.editor.status.online')}</th><th>{t45n('devices.step45n.deviceGroups.sync')}</th><th className="action-column">{t45n('reports.table.action')}</th>
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
                      <td className="action-column"><RouterRowAction to={'/devices/groups/' + group.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + group.name} /></td>
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
        title={t45n('devices.step45n.deviceGroups.newDeviceGroup')}
        description={t45n('devices.step45n.deviceGroups.createAStaticManagedEndpointGroupInThe')}
        onClose={closeCreate}
        size="md"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={create.isPending} onClick={closeCreate}>{t45n('reports.action.cancel')}</INNOButton>
          <INNOButton type="submit" form="device-group-create-form" busy={create.isPending} disabled={!name.trim()}>{t45n('devices.step45n.deviceGroups.createGroup')}</INNOButton>
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
              <span>{t45n('devices.step45n.deviceGroupDetail.groupName')}</span>
              <input data-autofocus required value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field-block">
              <span>{t45n('admin.step45n.adminHierarchy.code')}</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t45n('devices.step45n.deviceGroups.generatedIfEmpty')} />
            </label>
            <label className="field-block field-wide">
              <span>{t45n('reports.editor.descriptionField')}</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>
          </div>
          <div className="editor-scope-note">
            {t45n('devices.step45n.deviceGroups.scope')}{' '}{profile.organization?.name ?? t45n('devices.step45n.deviceGroups.currentOrganization')}
            {profile.location?.name ? ' · ' + profile.location.name : ''}
          </div>
          {create.isError ? <ErrorState error={create.error} /> : null}
        </form>
      </INNODialog>
    </INNOPage>
  );
}
