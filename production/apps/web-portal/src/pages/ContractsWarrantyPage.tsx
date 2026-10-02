import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar,
  INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOState,
  INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { getAssetContracts } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}
function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ContractsWarrantyPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [fiscalYear, setFiscalYear] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch, status, fiscalYear]);

  const query = useQuery({
    queryKey: ['assets', 'contracts', page, deferredSearch, status, fiscalYear],
    queryFn: () => getAssetContracts({
      page, pageSize: 25, search: deferredSearch, status, fiscalYear,
    }),
  });

  const summary = query.data?.summary;
  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Contracts & Warranty"
      description="Track vendors, service terms, warranty coverage and upcoming expirations."
    >
      <div className="production-stat-strip contract-stat-strip">
        <div><span>Active contracts</span><b>{summary?.activeContracts ?? '—'}</b><small>More than 90 days remaining</small></div>
        <div><span>Expiring ≤ 90 days</span><b>{summary?.expiringWithin90Days ?? '—'}</b><small>Requires renewal review</small></div>
        <div><span>Covered assets</span><b>{summary?.coveredAssets ?? '—'}</b><small>Active or expiring coverage</small></div>
        <div><span>Uncovered assets</span><b>{summary?.uncoveredAssets ?? '—'}</b><small>Needs warranty review</small></div>
      </div>

      <INNOCollection className="contract-collection">
        <INNOCollectionHeader
          title="Contracts"
          description="Service and warranty agreements in the current Assets scope."
          meta={query.data ? <INNOStatus>{query.data.totalItems} contracts</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search contracts" value={search} onChange={setSearch} placeholder="Search contract, vendor or service…" />
          <INNOSelectField label="Status filter" value={status} onChange={setStatus}>
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="expired">Expired</option>
          </INNOSelectField>
          <INNOSelectField label="Fiscal year filter" value={fiscalYear} onChange={setFiscalYear}>
            <option value="all">Fiscal year: All</option>
            {query.data?.fiscalYears.map((value) => <option key={value} value={value}>{value}</option>)}
          </INNOSelectField>
        </INNOCollectionToolbar>

        {query.isPending ? <div className="collection-state"><LoadingState label="Loading contracts…" /></div> : null}
        {query.isError ? <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div> : null}
        {query.data?.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              kind={search || status !== 'all' || fiscalYear !== 'all' ? 'no-results' : 'empty'}
              title="No contracts found"
              description={search || status !== 'all' || fiscalYear !== 'all' ? 'Try another search or clear the filters.' : 'No contracts are currently visible.'}
              action={search || status !== 'all' || fiscalYear !== 'all'
                ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setFiscalYear('all'); }}>Clear filters</INNOButton>
                : undefined}
            />
          </div>
        ) : null}
        {query.data?.items.length ? (
          <>
            <INNOTableWrap width="xwide">
              <table className="contract-table">
                <thead><tr><th>Contract</th><th>Fiscal Year</th><th>Vendor</th><th>Period</th><th>Service</th><th className="numeric-column">Assets</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                <tbody>{query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.contractNumber}</b></td>
                    <td>{item.fiscalYear}</td>
                    <td>{item.vendor}</td>
                    <td>{displayDate(item.startAt)} – {displayDate(item.endAt)}</td>
                    <td>{item.serviceType}</td>
                    <td className="numeric-column">{item.coveredAssets.length}</td>
                    <td><INNOStatus tone={item.status === 'expired' ? 'danger' : item.status === 'expiring' ? 'warning' : 'success'}>{statusLabel(item.status)}</INNOStatus></td>
                    <td className="action-column"><Link className="inno-row-action" to={'/assets/contracts/' + item.id} aria-label={'Open ' + item.contractNumber}>Open</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination page={query.data.page} totalPages={query.data.totalPages} totalItems={query.data.totalItems} pageSize={query.data.pageSize} onPageChange={setPage} />
          </>
        ) : null}
      </INNOCollection>
    </INNOPage>
  );
}
