import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOCollection, INNOCollectionHeader, INNOPage, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getAssetOwnership } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AssetOwnershipPage() {
  const { t: t45n } = useStep45NI18n();
  const query = useQuery({ queryKey: ['assets', 'ownership'], queryFn: getAssetOwnership });
  return (
    <INNOPage
      eyebrow={t45n('assets.step45n.assetOwners.assetsOwnership')}
      title={t45n('assets.step45n.assetOwnership.assetOwnership')}
      description={t45n('assets.step45n.assetOwnership.reviewAssetAssignmentsOwnerContextAndAgentSubmitted')}
    >
      {query.isPending ? <LoadingState label={t45n('assets.step45n.assetOwnership.loadingOwnership')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? <>
        <div className="production-stat-strip">
          <div><span>{t45n('assets.automation.editor.owner.assigned')}</span><b>{query.data.assignedAssets}</b><small>{t45n('assets.step45n.assetOwnership.assetsWithAnOwner')}</small></div>
          <div><span>{t45n('assets.step45n.assetOwnership.confirmed')}</span><b>{query.data.confirmedOwnership}</b><small>{t45n('assets.step45n.assetOwnership.currentOwnershipRecords')}</small></div>
          <div><span>{t45n('assets.step45n.assetOwnership.pendingConfirmation')}</span><b>{query.data.pendingSubmissions}</b><small>{t45n('assets.step45n.assetOwnership.fromEndpointAgent')}</small></div>
          <div><span>{t45n('assets.automation.editor.owner.unassigned')}</span><b>{query.data.unassignedAssets}</b><small>{t45n('assets.step45n.assetOwnership.needAnOwnerOrPool')}</small></div>
        </div>
        <div className="asset-ownership-overview-grid">
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>{t45n('navigation.assetOwners')}</h3><p>{t45n('assets.step45n.assetOwnership.openOwnershipProfilesForPeopleWithAssetsIn')}</p></div><Link className="open-resource" to="/assets/owners">{t45n('assets.step45n.assetOwnership.viewAssetOwners')}</Link></div>
            <div className="settings-stack"><div className="settings-row"><div><b>{t45n('assets.step45n.assetOwnership.identitySource')}</b><span>{t45n('assets.step45n.assetOwnership.namesEmailAndOrganizationAreReadOnlyHere')}</span></div><INNOStatus tone="success">{t45n('common.status.connected')}</INNOStatus></div></div>
          </section>
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>{t45n('navigation.agentSubmissions')}</h3><p>{t45n('assets.step45n.assetOwnership.reviewDurableOwnershipConfirmationsFromTheEndpointAgent')}</p></div><Link className="open-resource" to="/assets/ownership/submissions">{t45n('assets.step45n.assetOwnership.reviewQueue')}</Link></div>
            <div className="settings-stack"><div className="settings-row"><div><b>{t45n('assets.step45n.assetOwnership.pendingReview')}</b><span>{t45n('assets.step45n.assetOwnership.endpointAgentRemainsASeparateClientSurface')}</span></div><b>{query.data.pendingSubmissions}</b></div></div>
          </section>
        </div>
        <INNOCollection>
          <INNOCollectionHeader title={t45n('assets.step45n.assetOwnership.recentOwnershipChanges')} description={t45n('assets.step45n.assetOwnership.latestAssignmentHistoryVisibleInYourScope')} />
          {query.data.recentChanges.length === 0 ? (
            <div className="collection-state"><INNOState kind="empty" title={t45n('assets.step45n.assetOwnership.noOwnershipChangesYet')} description={t45n('assets.step45n.assetOwnership.assignmentHistoryWillAppearAfterOwnershipChangesAre')} /></div>
          ) : (
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>{t45n('reports.column.name')}</th><th>{t45n('assets.step45n.assetDetail.previousOwner')}</th><th>{t45n('reports.column.owner')}</th><th>{t45n('assets.step45n.assetDetail.reason')}</th><th>{t45n('common.status.effective')}</th></tr></thead>
                <tbody>{query.data.recentChanges.map((item) => <tr key={item.assetId + item.effectiveAt}><td><Link className="open-resource" to={'/assets/' + item.assetId}>{item.assetTag}</Link></td><td>{item.previousOwner ?? t45n('assets.automation.editor.owner.unassigned')}</td><td>{item.owner ?? t45n('assets.automation.editor.owner.unassigned')}</td><td>{item.reasonCode.replaceAll('_', ' ')}</td><td>{new Date(item.effectiveAt).toLocaleString()}</td></tr>)}</tbody>
              </table>
            </INNOTableWrap>
          )}
        </INNOCollection>
      </> : null}
    </INNOPage>
  );
}
