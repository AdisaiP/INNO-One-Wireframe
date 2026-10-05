import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNODrawer,
  INNOPage,
  INNOSearchField,
  INNOStatus,
  INNOTree,
} from '@inno/ui';
import {
  createAdminLocation,
  createAdminOrganizationUnit,
  getAdminLocations,
  getAdminOrganizationTree,
  updateAdminLocation,
  updateAdminOrganizationUnit,
} from '../api/client';
import type { AdminHierarchyItem } from '../api/types';
import { CollectionErrorState, CollectionLoadingState, ErrorState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

type Kind = 'organization' | 'location';

export function AdminHierarchyPage({ kind }: { kind: Kind }) {
  const { t: t45n } = useStep45NI18n();
  const isOrganization = kind === 'organization';
  const canManage = usePermission(isOrganization ? 'admin.organization.manage' : 'admin.locations.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', parentId: '', status: 'active' });
  const title = isOrganization ? 'Organization Structure' : 'Locations';
  const queryKey = ['admin', kind];
  const query = useQuery({
    queryKey,
    queryFn: isOrganization ? getAdminOrganizationTree : getAdminLocations,
  });

  const records = query.data ?? [];
  const term = search.trim().toLowerCase();
  const hasSearchMatch = !term || records.some((item) =>
    item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term),
  );
  const selected = records.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setCreateMode(false);
    setForm({
      code: selected.code,
      name: selected.name,
      parentId: selected.parentId ?? '',
      status: selected.status,
    });
  }, [selected]);

  const mutation = useMutation({
    mutationFn: async () => {
      const input = {
        code: form.code.trim(),
        name: form.name.trim(),
        parentId: form.parentId || null,
        status: form.status,
      };
      if (createMode) {
        return isOrganization
          ? createAdminOrganizationUnit(input)
          : createAdminLocation(input);
      }
      if (!selected) throw new Error(t45n('admin.step45n.adminHierarchy.selectARecord'));
      return isOrganization
        ? updateAdminOrganizationUnit(selected.id, selected.eTag, input)
        : updateAdminLocation(selected.id, selected.eTag, input);
    },
    onSuccess: async () => {
      setSelectedId('');
      setCreateMode(false);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });

  function beginCreate() {
    setSelectedId('');
    setCreateMode(true);
    setForm({ code: '', name: '', parentId: '', status: 'active' });
  }

  function closeEditor() {
    setSelectedId('');
    setCreateMode(false);
  }

  const parentOptions = (query.data ?? []).filter((item) => item.id !== selected?.id);

  return (
    <INNOPage
      eyebrow={t45n('admin.step45n.adminHierarchy.adminCenterOrganization')}
      title={title}
      description={isOrganization
        ? t45n('admin.step45n.adminHierarchy.maintainTheCanonicalOrganizationHierarchyUsedByAccess')
        : t45n('admin.step45n.adminHierarchy.maintainTheReusableLocationHierarchyUsedByUsers')}
      actions={canManage ? (
        <INNOButton type="button" onClick={beginCreate}>{t45n('admin.step45n.adminHierarchy.new')}{' '}{isOrganization ? t45n('admin.step45n.adminHierarchy.unit') : t45n('profile.location')}</INNOButton>
      ) : undefined}
    >
      <INNOCollection className="admin-hierarchy-collection">
          <INNOCollectionHeader
            title={isOrganization ? t45n('admin.step45n.adminHierarchy.organizationTree') : t45n('admin.step45n.adminHierarchy.locationTree')}
            description={isOrganization
              ? t45n('admin.step45n.adminHierarchy.selectAHierarchyNodeToInspectOrEdit')
              : t45n('admin.step45n.adminHierarchy.selectAHierarchyNodeToInspectOrEdit2')}
            meta={query.data ? <INNOStatus>{query.data.length} {t45n('admin.step45n.adminAudit.records')}</INNOStatus> : undefined}
          />
          <INNOCollectionToolbar>
            <INNOSearchField label={t45n('navigation.search') + ' ' + title.toLowerCase()} value={search} onChange={setSearch} placeholder={t45n('admin.step45n.adminAccessScopeEdit.searchNameOrCode')} />
          </INNOCollectionToolbar>
          {query.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminHierarchy.loading') + ' ' + title.toLowerCase() + '…'} /> : null}
          {query.isError ? <CollectionErrorState error={query.error} retry={() => void query.refetch()} /> : null}
          {query.data && records.length === 0 ? (
            <INNOCollectionState
              kind="empty"
              title={t45n('admin.step45n.adminHierarchy.nothingHereYet')}
              description={t45n('admin.step45n.adminHierarchy.createTheFirstHierarchyRecordWhenYouAre')}
            />
          ) : null}
          {query.data && records.length > 0 && !hasSearchMatch ? (
            <INNOCollectionState
              kind="no-results"
              title={t45n('admin.step45n.adminHierarchy.noRecordsFound')}
              description={t45n('reports.noResults.description')}
              action={<INNOButton variant="secondary" onClick={() => setSearch('')}>{t45n('assets.automation.clearSearch')}</INNOButton>}
            />
          ) : null}
          {records.length > 0 && hasSearchMatch ? (
            <INNOTree
              key={kind}
              items={records}
              getId={(item) => item.id}
              getParentId={(item) => item.parentId}
              getLabel={(item) => item.name}
              getDescription={(item) => item.code}
              getSearchText={(item) => item.name + ' ' + item.code}
              renderMeta={(item) => (
                <INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus>
              )}
              selectedId={selectedId}
              onSelect={(id) => {
                setCreateMode(false);
                setSelectedId(id);
              }}
              search={search}
              ariaLabel={title}
              emptyContent={t45n('admin.step45n.adminHierarchy.noHierarchyRecordsMatchThisSearch')}
            />
          ) : null}
        </INNOCollection>

      <INNODrawer
        open={createMode || Boolean(selected)}
        title={createMode ? t45n('admin.step45n.adminHierarchy.new') + ' ' + (isOrganization ? t45n('admin.step45n.adminHierarchy.organizationUnit') : t45n('profile.location')) : selected?.name ?? title}
        description={createMode
          ? t45n('admin.step45n.adminHierarchy.createACanonicalAdministrationMasterWhileKeepingThe')
          : t45n('admin.step45n.adminHierarchy.inspectOrEditTheSelectedHierarchyRecord')}
        onClose={closeEditor}
        size="md"
        footer={(
          <>
            <INNOButton type="button" variant="secondary" onClick={closeEditor}>{t45n('reports.action.cancel')}</INNOButton>
            <INNOButton
              type="submit"
              form="admin-hierarchy-editor"
              busy={mutation.isPending}
              disabled={!canManage || !form.code.trim() || !form.name.trim()}
            >
              {t45n('common.actions.save')}</INNOButton>
          </>
        )}
      >
        <form
          id="admin-hierarchy-editor"
          className="overlay-editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mutation.isPending) mutation.mutate();
          }}
        >
          <div className="editor-grid">
            <label className="field-block"><span>{t45n('admin.step45n.adminHierarchy.code')}</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('admin.step45n.adminHierarchy.name')}</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field-block">
              <span>{t45n('admin.step45n.adminHierarchy.parent')}</span>
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">{t45n('admin.step45n.adminHierarchy.noParent')}</option>
                {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="field-block">
              <span>{t45n('reports.runs.status')}</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">{t45n('reports.status.active')}</option>
                <option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option>
              </select>
            </label>
          </div>
          {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        </form>
      </INNODrawer>
    </INNOPage>
  );
}

export function AdminOrganizationPage() {
  return <AdminHierarchyPage kind="organization" />;
}

export function AdminLocationsPage() {
  return <AdminHierarchyPage kind="location" />;
}
