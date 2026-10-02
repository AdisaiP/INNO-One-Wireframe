import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RouterRowAction } from '../components/RouterRowAction';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOPage, INNOSearchField, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
import { getAssetOwners } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';

export function AssetOwnersPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({ queryKey: ['assets', 'owners', deferredSearch], queryFn: () => getAssetOwners({ search: deferredSearch, pageSize: 100 }) });
  return (
    <INNOPage
      eyebrow="Assets · Ownership"
      title="Asset Owners"
      description="Find an asset owner and open their ownership profile. Identity administration remains in Admin Center."
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Asset owners"
          description="People with asset ownership context visible in your scope."
          meta={query.data ? <INNOStatus>{query.data.totalItems} owners</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search owners" value={search} onChange={setSearch} placeholder="Search name, employee ID or email…" />
          <INNOToolbarSpacer />
          <INNOToolbarMeta>Authorization filtered server-side</INNOToolbarMeta>
        </INNOCollectionToolbar>
        {query.isPending ? (
          <CollectionLoadingState label="Loading asset owners…" />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search ? 'No asset owners found' : 'No asset owners in scope'}
            description={search ? 'Try another name, employee ID or email.' : 'No people with visible asset ownership context are available.'}
            action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>Clear search</INNOButton> : undefined}
          />
        ) : (
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>Asset owner</th><th>Employee ID</th><th>Organization</th><th>Owned assets</th><th>Last ownership change</th><th className="action-column">Action</th></tr></thead>
              <tbody>{query.data.items.map((owner) => <tr key={owner.id}><td><b>{owner.fullName}</b><div className="table-meta">{owner.email}</div></td><td>{owner.employeeId}</td><td>{owner.organization ?? '—'}</td><td>{owner.assetCount}</td><td>{owner.lastOwnershipAt ? new Date(owner.lastOwnershipAt).toLocaleString() : '—'}</td><td className="action-column"><RouterRowAction to={'/assets/owners/' + owner.id} ariaLabel={'Open ' + owner.fullName} /></td></tr>)}</tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
