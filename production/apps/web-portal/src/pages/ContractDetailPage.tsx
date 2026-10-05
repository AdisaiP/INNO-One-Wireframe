import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOCollection, INNOCollectionHeader, INNOResourceHeader, INNOResourceSummary,
  INNOResourceSummaryItem, INNOState, INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { getAssetContract } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}
function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ContractDetailPage() {
  const { t: t45n } = useStep45NI18n();
  const { contractId = '' } = useParams();
  const canManage = usePermission('assets.contract.manage');
  const query = useQuery({
    queryKey: ['assets', 'contract', contractId],
    queryFn: () => getAssetContract(contractId),
    enabled: !!contractId,
  });

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('assets.step45n.contractDetail.loadingContract')} /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  if (!query.data) return <main className="inno-page"><INNOState kind="error" title={t45n('assets.step45n.contractDetail.contractNotFound')} /></main>;
  const contract = query.data;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/contracts">{t45n('navigation.contractsWarranty')}</Link><span>›</span><span>{contract.contractNumber}</span>
      </div>

      <INNOResourceHeader
        title={contract.contractNumber}
        status={<INNOStatus tone={contract.status === 'expired' ? 'danger' : contract.status === 'expiring' ? 'warning' : 'success'}>{statusLabel(contract.status)}</INNOStatus>}
        meta={<><span>{contract.vendor}</span><span>·</span><span>{contract.fiscalYear}</span></>}
        actions={canManage ? <Link className="inno-btn inno-btn-secondary" to={'/assets/contracts/' + contract.id + '/edit'}>{t45n('assets.step45n.contractDetail.editContract')}</Link> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('assets.step45n.contractDetail.fiscalYear')} value={contract.fiscalYear} detail={contract.vendor} />
        <INNOResourceSummaryItem label={t45n('assets.step45n.contractDetail.startDate')} value={displayDate(contract.startAt)} detail="Coverage begins" />
        <INNOResourceSummaryItem label={t45n('assets.step45n.contractDetail.endDate')} value={displayDate(contract.endAt)} detail={contract.status === 'expired' ? 'Expired' : contract.daysRemaining + ' days remaining'} />
        <INNOResourceSummaryItem label={t45n('assets.step45n.contractDetail.coveredAssets')} value={contract.coveredAssets.length} detail={contract.serviceType} />
      </INNOResourceSummary>
      <INNOCollection>
        <INNOCollectionHeader title={t45n('assets.step45n.contractDetail.contractTerms')} description={t45n('assets.step45n.contractDetail.serviceWarrantyAndVendorSupportDetails')} />
        <div className="contract-kv-grid">
          <div className="contract-kv-wide"><span>{t45n('assets.step45n.contractDetail.serviceCondition')}</span><b>{contract.serviceCondition ?? '—'}</b></div>
          <div className="contract-kv-wide"><span>{t45n('assets.step45n.contractDetail.warrantyTerms')}</span><b>{contract.warrantyTerms ?? '—'}</b></div>
          <div className="contract-kv-wide"><span>{t45n('assets.step45n.contractDetail.contact')}</span><b>{[contract.contactName, contract.contactPhone, contract.contactEmail].filter(Boolean).join(' · ') || '—'}</b></div>
        </div>
      </INNOCollection>

      <INNOCollection>
        <INNOCollectionHeader title={t45n('assets.step45n.contractDetail.coveredAssets')} description={contract.coveredAssets.length + ' ' + t45n('assets.step45n.contractDetail.assetsInThisContract')} />
        {contract.coveredAssets.length ? (
          <INNOTableWrap width="wide">
            <table className="supporting-table">
              <thead><tr><th>{t45n('reports.column.name')}</th><th>{t45n('reports.column.model')}</th><th>{t45n('reports.column.owner')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
              <tbody>{contract.coveredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                  <td>{asset.brandModel || '—'}</td>
                  <td>{asset.owner ?? t45n('assets.automation.editor.owner.unassigned')}</td>
                  <td><INNOStatus tone="success">{statusLabel(asset.coverageStatus)}</INNOStatus></td>
                  <td className="action-column"><RouterRowAction to={'/assets/' + asset.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + asset.assetTag} /></td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : <div className="collection-state"><INNOState kind="empty" title={t45n('assets.step45n.contractDetail.noCoveredAssets')} description={t45n('assets.step45n.contractDetail.thisContractDoesNotCurrentlyCoverAnyVisible')} /></div>}
      </INNOCollection>
    </main>
  );
}
