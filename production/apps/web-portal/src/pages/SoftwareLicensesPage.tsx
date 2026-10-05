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
import { useI18n as useStep45NI18n } from '@inno/i18n';

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
  const { t: t45n } = useStep45NI18n();
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
      eyebrow={t45n('assets.step45n.assetCustomFields.assetsManagement')}
      title={t45n('navigation.softwareLicenses')}
      description={t45n('devices.step45n.softwareLicenses.monitorPurchasedSoftwareEntitlementsAgainstDetectedEndpointUsage')}
    >
      <div className="production-stat-strip license-stat-strip">
        <div>
          <span>{t45n('devices.step45n.softwareLicenses.products')}</span>
          <b>{summary?.products ?? '—'}</b>
          <small>{t45n('devices.step45n.softwareLicenses.trackedLicenseProducts')}</small>
        </div>
        <div>
          <span>{t45n('devices.step45n.softwareLicenseDetail.purchasedSeats')}</span>
          <b>{summary?.purchasedSeats ?? '—'}</b>
          <small>{t45n('devices.step45n.softwareLicenses.currentEntitlements')}</small>
        </div>
        <div>
          <span>{t45n('admin.step45n.adminApps.installed')}</span>
          <b>{summary?.installedSeats ?? '—'}</b>
          <small>{t45n('devices.step45n.softwareLicenses.detectedSeatUsage')}</small>
        </div>
        <div>
          <span>{t45n('devices.step45n.softwareLicenses.estimatedGapCost')}</span>
          <b>{summary ? money(summary.estimatedGapCost) : '—'}</b>
          <small>{summary ? summary.overusedProducts + ' ' + t45n('devices.step45n.softwareLicenses.overusedProducts') : t45n('devices.step45n.softwareLicenses.complianceSummary')}</small>
        </div>
      </div>

      <INNOCollection className="license-collection">
        <INNOCollectionHeader
          title={t45n('devices.step45n.softwareLicenses.licenseProducts')}
          description={t45n('devices.step45n.softwareLicenses.openAProductToReviewEntitlementRenewalDetails')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('devices.step45n.softwareLicenses.products2')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label={t45n('devices.step45n.softwareLicenses.searchSoftwareLicenses')}
            value={search}
            onChange={setSearch}
            placeholder={t45n('devices.step45n.softwareLicenses.searchProductVendorModelOrContract')}
          />
          <INNOSelectField label={t45n('devices.step45n.softwareLicenses.complianceFilter')} value={compliance} onChange={setCompliance}>
            <option value="all">{t45n('devices.step45n.softwareLicenses.complianceAll')}</option>
            <option value="compliant">{t45n('assets.automation.editor.compliance.compliant')}</option>
            <option value="overused">{t45n('assets.automation.editor.compliance.overused')}</option>
          </INNOSelectField>
          <INNOSelectField label={t45n('devices.step45n.softwareLicenses.vendorFilter')} value={vendor} onChange={setVendor}>
            <option value="all">{t45n('devices.step45n.softwareLicenses.vendorAll')}</option>
            {query.data?.vendors.map((value) => <option key={value} value={value}>{value}</option>)}
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>{t45n('devices.step45n.softwareLicenses.openAProductForDetails')}</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label={t45n('devices.step45n.softwareLicenses.loadingSoftwareLicenses')} /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              kind={search || compliance !== 'all' || vendor !== 'all' ? 'no-results' : 'empty'}
              title={t45n('devices.step45n.softwareLicenses.noLicenseProductsFound')}
              description={t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters')}
              action={
                <INNOButton
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setCompliance('all');
                    setVendor('all');
                  }}
                >
                  {t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
              }
            />
          </div>
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table className="license-table">
                <thead>
                  <tr>
                    <th>{t45n('devices.step45n.softwareLicenses.product')}</th>
                    <th>{t45n('assets.automation.editor.licenseField.vendor')}</th>
                    <th className="numeric-column">{t45n('devices.step45n.softwareLicenses.purchased')}</th>
                    <th className="numeric-column">{t45n('devices.step45n.softwareLicenses.used')}</th>
                    <th>{t45n('devices.step45n.softwareLicenses.utilization')}</th>
                    <th>{t45n('assets.automation.editor.licenseField.compliance')}</th>
                    <th className="numeric-column">{t45n('devices.step45n.softwareLicenses.estimatedGapCost')}</th>
                    <th className="action-column">{t45n('reports.table.action')}</th>
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
                            ? Math.abs(item.seatBalance) + ' ' + t45n('devices.step45n.softwareLicenses.seatsOver')
                            : item.seatBalance + ' ' + t45n('common.step45n.apps.available')}
                        </INNOStatus>
                      </td>
                      <td className="numeric-column">{money(item.estimatedGapCost, item.currency)}</td>
                      <td className="action-column">
                        <RouterRowAction
                          to={'/assets/software-licenses/' + item.id}
                          ariaLabel={t45n('common.step45n.search.open') + ' ' + item.productName}
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
