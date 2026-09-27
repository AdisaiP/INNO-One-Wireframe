import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOPage, INNOState } from '@inno/ui';
import { getAssets } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function statusLabel(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

export function AssetInventoryPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  useEffect(() => setPage(1), [deferredSearch, category, status]);

  const query = useQuery({
    queryKey: ['assets', 'inventory', page, deferredSearch, category, status],
    queryFn: () => getAssets({ page, pageSize, search: deferredSearch, category, status }),
  });

  return (
    <INNOPage eyebrow="Assets" title="Asset Inventory">
      <p className="page-helper">Find registered assets and inventory synchronized from managed endpoints.</p>
      <section className="collection-card">
        <div className="collection-head">
          <div><h2>Assets</h2><p>{query.data ? query.data.totalItems + ' assets in scope' : 'Asset register'}</p></div>
          {query.data ? <span className="prod-tag">{query.data.totalItems} assets</span> : null}
        </div>
        <div className="collection-toolbar">
          <label className="search-field"><span className="sr-only">Search assets</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tag, name, serial, model…" /></label>
          <label><span className="sr-only">Category filter</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Category: All</option><option>Computer</option><option>Notebook</option><option>Monitor</option><option>Printer</option></select></label>
          <label><span className="sr-only">Status filter</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Status: All</option><option value="in_use">In use</option><option value="stock">Stock</option><option value="repair">Repair</option><option value="retired">Retired</option></select></label>
          <span className="toolbar-spacer" /><span className="collection-scope">Authorization filtered server-side</span>
        </div>
        {query.isPending ? <div className="collection-state"><LoadingState label="Loading assets…" /></div> : query.isError ? <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div> : query.data.items.length === 0 ? (
          <div className="collection-state"><INNOState title="No assets found" description="Try another search or clear the filters." action={<div className="state-action"><INNOButton variant="secondary" onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); }}>Clear filters</INNOButton></div>} /></div>
        ) : <>
          <div className="production-table-wrap"><table className="production-table">
            <thead><tr><th>Asset</th><th>Category</th><th>Brand / Model</th><th>Owner</th><th>Location</th><th>Registered</th><th>Status</th><th className="action-column">Action</th></tr></thead>
            <tbody>{query.data.items.map((asset) => <tr key={asset.id}>
              <td><b>{asset.assetTag}</b><div className="table-meta">{asset.serialNumber ?? asset.name}</div></td>
              <td>{asset.category}</td><td>{asset.brandModel || '—'}</td><td>{asset.owner ?? '—'}</td><td>{asset.location ?? asset.organization ?? '—'}</td>
              <td>{new Date(asset.registeredAt).toLocaleDateString()}</td><td><span className="prod-tag">{statusLabel(asset.status)}</span></td>
              <td className="action-column"><Link className="open-resource" to={'/assets/' + asset.id}>Open</Link></td>
            </tr>)}</tbody>
          </table></div>
          <div className="collection-footer"><span>Showing {(query.data.page - 1) * query.data.pageSize + 1}–{Math.min(query.data.page * query.data.pageSize, query.data.totalItems)} of {query.data.totalItems}</span><div className="pagination-actions"><INNOButton variant="secondary" disabled={query.data.page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Previous</INNOButton><span>Page {query.data.page} of {Math.max(query.data.totalPages, 1)}</span><INNOButton variant="secondary" disabled={query.data.page >= query.data.totalPages} onClick={() => setPage((v) => v + 1)}>Next</INNOButton></div></div>
        </>}
      </section>
    </INNOPage>
  );
}
