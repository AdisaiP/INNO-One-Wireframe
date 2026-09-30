import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOPage, INNOSearchField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarSpacer } from '@inno/ui';
import { getAssetOwners } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

export function AssetOwnersPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({ queryKey: ['assets', 'owners', deferredSearch], queryFn: () => getAssetOwners({ search: deferredSearch, pageSize: 100 }) });
  return (
    <INNOPage
      eyebrow="Assets · Ownership"
      title="User Profiles"
      description="Find a user and open their current asset ownership context."
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Users"
          description="Platform users with assets visible in your scope."
          meta={query.data ? <INNOStatus>{query.data.totalItems} users</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search owners" value={search} onChange={setSearch} placeholder="Search name, employee ID or email…" />
          <INNOToolbarSpacer />
          <span className="collection-scope">Authorization filtered server-side</span>
        </INNOCollectionToolbar>
        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading users…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state"><INNOState kind={search ? 'no-results' : 'empty'} title={search ? 'No users found' : 'No users in scope'} description={search ? 'Try another name, employee ID or email.' : 'No Platform users with visible Asset ownership are available.'} /></div>
        ) : (
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>User</th><th>Employee ID</th><th>Organization</th><th>Owned assets</th><th>Last ownership change</th><th className="action-column">Action</th></tr></thead>
              <tbody>{query.data.items.map((owner) => <tr key={owner.id}><td><b>{owner.fullName}</b><div className="table-meta">{owner.email}</div></td><td>{owner.employeeId}</td><td>{owner.organization ?? '—'}</td><td>{owner.assetCount}</td><td>{owner.lastOwnershipAt ? new Date(owner.lastOwnershipAt).toLocaleString() : '—'}</td><td className="action-column"><Link className="device-row-action" to={'/assets/owners/' + owner.id} aria-label={'Open ' + owner.fullName}><INNOIcon token="action.next" size={14} /></Link></td></tr>)}</tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
