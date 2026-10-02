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

function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}
function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ContractDetailPage() {
  const { contractId = '' } = useParams();
  const canManage = usePermission('assets.contract.manage');
  const query = useQuery({
    queryKey: ['assets', 'contract', contractId],
    queryFn: () => getAssetContract(contractId),
    enabled: !!contractId,
  });

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading contract…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  if (!query.data) return <main className="inno-page"><INNOState kind="error" title="Contract not found" /></main>;
  const contract = query.data;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/contracts">Contracts & Warranty</Link><span>›</span><span>{contract.contractNumber}</span>
      </div>

      <INNOResourceHeader
        title={contract.contractNumber}
        status={<INNOStatus tone={contract.status === 'expired' ? 'danger' : contract.status === 'expiring' ? 'warning' : 'success'}>{statusLabel(contract.status)}</INNOStatus>}
        meta={<><span>{contract.vendor}</span><span>·</span><span>{contract.fiscalYear}</span></>}
        actions={canManage ? <Link className="inno-btn inno-btn-secondary" to={'/assets/contracts/' + contract.id + '/edit'}>Edit Contract</Link> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Fiscal year" value={contract.fiscalYear} detail={contract.vendor} />
        <INNOResourceSummaryItem label="Start date" value={displayDate(contract.startAt)} detail="Coverage begins" />
        <INNOResourceSummaryItem label="End date" value={displayDate(contract.endAt)} detail={contract.status === 'expired' ? 'Expired' : contract.daysRemaining + ' days remaining'} />
        <INNOResourceSummaryItem label="Covered assets" value={contract.coveredAssets.length} detail={contract.serviceType} />
      </INNOResourceSummary>
      <INNOCollection>
        <INNOCollectionHeader title="Contract terms" description="Service, warranty and vendor support details." />
        <div className="contract-kv-grid">
          <div className="contract-kv-wide"><span>Service condition</span><b>{contract.serviceCondition ?? '—'}</b></div>
          <div className="contract-kv-wide"><span>Warranty terms</span><b>{contract.warrantyTerms ?? '—'}</b></div>
          <div className="contract-kv-wide"><span>Contact</span><b>{[contract.contactName, contract.contactPhone, contract.contactEmail].filter(Boolean).join(' · ') || '—'}</b></div>
        </div>
      </INNOCollection>

      <INNOCollection>
        <INNOCollectionHeader title="Covered assets" description={contract.coveredAssets.length + ' assets in this contract.'} />
        {contract.coveredAssets.length ? (
          <INNOTableWrap width="wide">
            <table className="supporting-table">
              <thead><tr><th>Asset</th><th>Model</th><th>Owner</th><th>Status</th><th className="action-column">Action</th></tr></thead>
              <tbody>{contract.coveredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                  <td>{asset.brandModel || '—'}</td>
                  <td>{asset.owner ?? 'Unassigned'}</td>
                  <td><INNOStatus tone="success">{statusLabel(asset.coverageStatus)}</INNOStatus></td>
                  <td className="action-column"><RouterRowAction to={'/assets/' + asset.id} ariaLabel={'Open ' + asset.assetTag} /></td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : <div className="collection-state"><INNOState kind="empty" title="No covered assets" description="This contract does not currently cover any visible Asset." /></div>}
      </INNOCollection>
    </main>
  );
}
