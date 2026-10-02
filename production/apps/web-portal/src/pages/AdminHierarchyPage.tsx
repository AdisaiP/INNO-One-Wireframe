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

type Kind = 'organization' | 'location';

export function AdminHierarchyPage({ kind }: { kind: Kind }) {
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
      if (!selected) throw new Error('Select a record.');
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
      eyebrow="Admin Center · Organization"
      title={title}
      description={isOrganization
        ? 'Maintain the canonical organization hierarchy used by access scopes and resource ownership.'
        : 'Maintain the reusable location hierarchy used by users, devices, assets, and access scopes.'}
      actions={canManage ? (
        <INNOButton type="button" onClick={beginCreate}>New {isOrganization ? 'Unit' : 'Location'}</INNOButton>
      ) : undefined}
    >
      <INNOCollection className="admin-hierarchy-collection">
          <INNOCollectionHeader
            title={isOrganization ? 'Organization Tree' : 'Location Tree'}
            description={isOrganization
              ? 'Select a hierarchy node to inspect or edit the canonical organization structure.'
              : 'Select a hierarchy node to inspect or edit nested places.'}
            meta={query.data ? <INNOStatus>{query.data.length} records</INNOStatus> : undefined}
          />
          <INNOCollectionToolbar>
            <INNOSearchField label={'Search ' + title.toLowerCase()} value={search} onChange={setSearch} placeholder="Search name or code…" />
          </INNOCollectionToolbar>
          {query.isPending ? <CollectionLoadingState label={'Loading ' + title.toLowerCase() + '…'} /> : null}
          {query.isError ? <CollectionErrorState error={query.error} retry={() => void query.refetch()} /> : null}
          {query.data && records.length === 0 ? (
            <INNOCollectionState
              kind="empty"
              title="Nothing here yet"
              description="Create the first hierarchy record when you are ready."
            />
          ) : null}
          {query.data && records.length > 0 && !hasSearchMatch ? (
            <INNOCollectionState
              kind="no-results"
              title="No records found"
              description="Try another search."
              action={<INNOButton variant="secondary" onClick={() => setSearch('')}>Clear search</INNOButton>}
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
              emptyContent="No hierarchy records match this search."
            />
          ) : null}
        </INNOCollection>

      <INNODrawer
        open={createMode || Boolean(selected)}
        title={createMode ? 'New ' + (isOrganization ? 'Organization Unit' : 'Location') : selected?.name ?? title}
        description={createMode
          ? 'Create a canonical administration master while keeping the hierarchy visible behind this drawer.'
          : 'Inspect or edit the selected hierarchy record.'}
        onClose={closeEditor}
        size="md"
        footer={(
          <>
            <INNOButton type="button" variant="secondary" onClick={closeEditor}>Cancel</INNOButton>
            <INNOButton
              type="submit"
              form="admin-hierarchy-editor"
              busy={mutation.isPending}
              disabled={!canManage || !form.code.trim() || !form.name.trim()}
            >
              Save
            </INNOButton>
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
            <label className="field-block"><span>Code</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="field-block"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field-block">
              <span>Parent</span>
              <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">No parent</option>
                {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="field-block">
              <span>Status</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
