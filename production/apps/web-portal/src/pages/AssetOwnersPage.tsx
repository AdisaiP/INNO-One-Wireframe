import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOPage } from '@inno/ui';
import { getAssetOwners } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

export function AssetOwnersPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({ queryKey: ['assets', 'owners', deferredSearch], queryFn: () => getAssetOwners({ search: deferredSearch, pageSize: 100 }) });
  return (
    <INNOPage eyebrow="Assets · Ownership" title="User Profiles">
      <p className="page-helper">Find a user and open their current asset ownership context.</p>
      <section className="collection-card">
        <div className="collection-head"><div><h2>Users</h2><p>Platform users with assets visible in your scope.</p></div>{query.data ? <span className="prod-tag">{query.data.totalItems} users</span> : null}</div>
        <div className="collection-toolbar"><label className="search-field"><span className="sr-only">Search owners</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, employee ID or email…" /></label><span className="toolbar-spacer" /><span className="collection-scope">Authorization filtered server-side</span></div>
        {query.isPending ? <div className="collection-state"><LoadingState label="Loading users…" /></div> : query.isError ? <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div> : (
          <div className="production-table-wrap"><table className="production-table"><thead><tr><th>User</th><th>Employee ID</th><th>Organization</th><th>Owned assets</th><th>Last ownership change</th><th className="action-column">Action</th></tr></thead><tbody>{query.data.items.map((owner) => <tr key={owner.id}><td><b>{owner.fullName}</b><div className="table-meta">{owner.email}</div></td><td>{owner.employeeId}</td><td>{owner.organization ?? '—'}</td><td>{owner.assetCount}</td><td>{owner.lastOwnershipAt ? new Date(owner.lastOwnershipAt).toLocaleString() : '—'}</td><td className="action-column"><Link className="open-resource" to={'/assets/owners/' + owner.id}>Open</Link></td></tr>)}</tbody></table></div>
        )}
      </section>
    </INNOPage>
  );
}
