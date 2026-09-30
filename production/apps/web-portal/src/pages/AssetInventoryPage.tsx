import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
import { getAssets } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';

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
    <INNOPage
      eyebrow="Assets"
      title="Asset Inventory"
      description="Find registered assets and inventory synchronized from managed endpoints."
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Assets"
          description={query.data ? query.data.totalItems + ' assets in scope' : 'Asset register'}
          meta={query.data ? <INNOStatus>{query.data.totalItems} assets</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search assets" value={search} onChange={setSearch} placeholder="Search tag, name, serial, model…" />
          <INNOSelectField label="Category filter" value={category} onChange={setCategory}>
            <option value="all">Category: All</option>
            <option>Computer</option>
            <option>Notebook</option>
            <option>Monitor</option>
            <option>Printer</option>
          </INNOSelectField>
          <INNOSelectField label="Status filter" value={status} onChange={setStatus}>
            <option value="all">Status: All</option>
            <option value="in_use">In use</option>
            <option value="stock">Stock</option>
            <option value="repair">Repair</option>
            <option value="retired">Retired</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>Authorization filtered server-side</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label="Loading assets…" />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || category !== 'all' || status !== 'all' ? 'no-results' : 'empty'}
            title={search || category !== 'all' || status !== 'all' ? 'No assets found' : 'No assets in scope'}
            description={search || category !== 'all' || status !== 'all'
              ? 'Try another search or clear the filters.'
              : 'No registered asset is visible inside your effective resource scope.'}
            action={search || category !== 'all' || status !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); }}>Clear filters</INNOButton>
              : undefined}
          />
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr><th>Asset</th><th>Category</th><th>Brand / Model</th><th>Owner</th><th>Location</th><th>Registered</th><th>Status</th><th className="action-column">Action</th></tr>
                </thead>
                <tbody>{query.data.items.map((asset) => (
                  <tr key={asset.id}>
                    <td><b>{asset.assetTag}</b><div className="table-meta">{asset.serialNumber ?? asset.name}</div></td>
                    <td>{asset.category}</td>
                    <td>{asset.brandModel || '—'}</td>
                    <td>{asset.owner ?? '—'}</td>
                    <td>{asset.location ?? asset.organization ?? '—'}</td>
                    <td>{new Date(asset.registeredAt).toLocaleDateString()}</td>
                    <td><INNOStatus>{statusLabel(asset.status)}</INNOStatus></td>
                    <td className="action-column"><Link className="inno-row-action" to={'/assets/' + asset.id} aria-label={'Open ' + asset.assetTag}>Open</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalItems={query.data.totalItems}
              pageSize={query.data.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
