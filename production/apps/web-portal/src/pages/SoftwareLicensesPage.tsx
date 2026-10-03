import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar,
  INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOState,
  INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer,
} from '@inno/ui';
import { getSoftwareLicenses } from '../api/client';
import type { SoftwareLicenseItem } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';

function money(value: number, currency = 'THB') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function utilization(item: SoftwareLicenseItem) {
  if (item.entitledSeats <= 0) return item.usedSeats > 0 ? 100 : 0;
  return Math.round((item.usedSeats / item.entitledSeats) * 100);
}

export function SoftwareLicensesPage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [compliance, setCompliance] = useState('all');
  const [vendor, setVendor] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, compliance, vendor]);

  const query = useQuery({
    queryKey: ['assets', 'software-licenses', page, deferredSearch, compliance, vendor],
    queryFn: () => getSoftwareLicenses({
      page,
      pageSize,
      search: deferredSearch,
      compliance,
      vendor,
    }),
  });

  const summary = query.data?.summary;

  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Software Licenses"
      description="Monitor purchased software entitlements against detected endpoint usage."
    >
      <div className="production-stat-strip license-stat-strip">
        <div>
          <span>Products</span>
          <b>{summary?.products ?? '—'}</b>
          <small>Tracked license products</small>
        </div>
        <div>
          <span>Purchased seats</span>
          <b>{summary?.purchasedSeats ?? '—'}</b>
          <small>Current entitlements</small>
        </div>
        <div>
          <span>Installed</span>
          <b>{summary?.installedSeats ?? '—'}</b>
          <small>Detected seat usage</small>
        </div>
        <div>
          <span>Estimated gap cost</span>
          <b>{summary ? money(summary.estimatedGapCost) : '—'}</b>
          <small>{summary ? summary.overusedProducts + ' overused products' : 'Compliance summary'}</small>
        </div>
      </div>

      <INNOCollection className="license-collection">
        <INNOCollectionHeader
          title="License products"
          description="Open a product to review entitlement, renewal details and detected allocations."
          meta={query.data ? <INNOStatus>{query.data.totalItems} products</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label="Search software licenses"
            value={search}
            onChange={setSearch}
            placeholder="Search product, vendor, model or contract…"
          />
          <INNOSelectField label="Compliance filter" value={compliance} onChange={setCompliance}>
            <option value="all">Compliance: All</option>
            <option value="compliant">Compliant</option>
            <option value="overused">Overused</option>
          </INNOSelectField>
          <INNOSelectField label="Vendor filter" value={vendor} onChange={setVendor}>
            <option value="all">Vendor: All</option>
            {query.data?.vendors.map((value) => <option key={value} value={value}>{value}</option>)}
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>Open a product for details</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading software licenses…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              kind={search || compliance !== 'all' || vendor !== 'all' ? 'no-results' : 'empty'}
              title="No license products found"
              description="Try another search or clear the filters."
              action={
                <INNOButton
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setCompliance('all');
                    setVendor('all');
                  }}
                >
                  Clear filters
                </INNOButton>
              }
            />
          </div>
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table className="license-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Vendor</th>
                    <th className="numeric-column">Purchased</th>
                    <th className="numeric-column">Used</th>
                    <th>Utilization</th>
                    <th>Compliance</th>
                    <th className="numeric-column">Estimated gap cost</th>
                    <th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.productName}</b><div className="table-meta">{item.licenseModel}</div></td>
                      <td>{item.vendor}</td>
                      <td className="numeric-column">{item.entitledSeats}</td>
                      <td className="numeric-column">{item.usedSeats}</td>
                      <td>
                        <div className="license-utilization">
                          <span>{utilization(item)}%</span>
                          <div><i style={{ width: Math.min(utilization(item), 100) + '%' }} /></div>
                        </div>
                      </td>
                      <td>
                        <INNOStatus tone={item.compliance === 'overused' ? 'danger' : 'success'}>
                          {item.compliance === 'overused'
                            ? Math.abs(item.seatBalance) + ' seats over'
                            : item.seatBalance + ' available'}
                        </INNOStatus>
                      </td>
                      <td className="numeric-column">{money(item.estimatedGapCost, item.currency)}</td>
                      <td className="action-column">
                        <RouterRowAction
                          to={'/assets/software-licenses/' + item.id}
                          ariaLabel={'Open ' + item.productName}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
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
