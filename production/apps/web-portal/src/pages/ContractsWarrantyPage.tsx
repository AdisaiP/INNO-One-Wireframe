import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RouterRowAction } from '../components/RouterRowAction';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar,
  INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOState,
  INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { getAssetContracts } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}
function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ContractsWarrantyPage() {
  const { t: t45n } = useStep45NI18n();
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
      eyebrow={t45n('assets.step45n.assetCustomFields.assetsManagement')}
      title={t45n('navigation.contractsWarranty')}
      description={t45n('assets.step45n.contractsWarranty.trackVendorsServiceTermsWarrantyCoverageAndUpcoming')}
    >
      <div className="production-stat-strip contract-stat-strip">
        <div><span>{t45n('assets.step45n.contractsWarranty.activeContracts')}</span><b>{summary?.activeContracts ?? '—'}</b><small>{t45n('assets.step45n.contractsWarranty.moreThan90DaysRemaining')}</small></div>
        <div><span>{t45n('assets.step45n.contractsWarranty.expiring90Days')}</span><b>{summary?.expiringWithin90Days ?? '—'}</b><small>{t45n('assets.step45n.contractsWarranty.requiresRenewalReview')}</small></div>
        <div><span>{t45n('assets.step45n.contractDetail.coveredAssets')}</span><b>{summary?.coveredAssets ?? '—'}</b><small>{t45n('assets.step45n.contractsWarranty.activeOrExpiringCoverage')}</small></div>
        <div><span>{t45n('assets.step45n.contractsWarranty.uncoveredAssets')}</span><b>{summary?.uncoveredAssets ?? '—'}</b><small>{t45n('assets.step45n.contractsWarranty.needsWarrantyReview')}</small></div>
      </div>

      <INNOCollection className="contract-collection">
        <INNOCollectionHeader
          title={t45n('assets.step45n.contractsWarranty.contracts')}
          description={t45n('assets.step45n.contractsWarranty.serviceAndWarrantyAgreementsInTheCurrentAssets')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('assets.step45n.contractsWarranty.contracts2')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('assets.step45n.contractsWarranty.searchContracts')} value={search} onChange={setSearch} placeholder={t45n('assets.step45n.contractsWarranty.searchContractVendorOrService')} />
          <INNOSelectField label={t45n('assets.step45n.assetInventory.statusFilter')} value={status} onChange={setStatus}>
            <option value="all">{t45n('admin.step45n.adminUsers.statusAll')}</option>
            <option value="active">{t45n('reports.status.active')}</option>
            <option value="expiring">{t45n('assets.step45n.contractsWarranty.expiring')}</option>
            <option value="expired">{t45n('assets.step45n.contractsWarranty.expired')}</option>
          </INNOSelectField>
          <INNOSelectField label={t45n('assets.step45n.contractsWarranty.fiscalYearFilter')} value={fiscalYear} onChange={setFiscalYear}>
            <option value="all">{t45n('assets.step45n.contractsWarranty.fiscalYearAll')}</option>
            {query.data?.fiscalYears.map((value) => <option key={value} value={value}>{value}</option>)}
          </INNOSelectField>
        </INNOCollectionToolbar>

        {query.isPending ? <div className="collection-state"><LoadingState label={t45n('assets.step45n.contractsWarranty.loadingContracts')} /></div> : null}
        {query.isError ? <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div> : null}
        {query.data?.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              kind={search || status !== 'all' || fiscalYear !== 'all' ? 'no-results' : 'empty'}
              title={t45n('assets.step45n.contractsWarranty.noContractsFound')}
              description={search || status !== 'all' || fiscalYear !== 'all' ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters') : t45n('assets.step45n.contractsWarranty.noContractsAreCurrentlyVisible')}
              action={search || status !== 'all' || fiscalYear !== 'all'
                ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setFiscalYear('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
                : undefined}
            />
          </div>
        ) : null}
        {query.data?.items.length ? (
          <>
            <INNOTableWrap width="xwide">
              <table className="contract-table">
                <thead><tr><th>{t45n('assets.step45n.contractsWarranty.contract')}</th><th>{t45n('assets.step45n.contractsWarranty.fiscalYear')}</th><th>{t45n('assets.automation.editor.licenseField.vendor')}</th><th>{t45n('assets.step45n.contractsWarranty.period')}</th><th>{t45n('assets.step45n.contractsWarranty.service')}</th><th className="numeric-column">{t45n('navigation.assets')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
                <tbody>{query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.contractNumber}</b></td>
                    <td>{item.fiscalYear}</td>
                    <td>{item.vendor}</td>
                    <td>{displayDate(item.startAt)} – {displayDate(item.endAt)}</td>
                    <td>{item.serviceType}</td>
                    <td className="numeric-column">{item.coveredAssets.length}</td>
                    <td><INNOStatus tone={item.status === 'expired' ? 'danger' : item.status === 'expiring' ? 'warning' : 'success'}>{statusLabel(item.status)}</INNOStatus></td>
                    <td className="action-column"><RouterRowAction to={'/assets/contracts/' + item.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + item.contractNumber} /></td>
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
