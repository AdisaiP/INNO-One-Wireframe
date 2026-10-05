import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOCollection, INNOCollectionHeader, INNOPage, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getAssetOverview } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AssetsOverviewPage() {
  const { t: t45n } = useStep45NI18n();
  const query = useQuery({ queryKey: ['assets', 'overview'], queryFn: getAssetOverview });

  return (
    <INNOPage
      eyebrow={t45n('navigation.assets')}
      title={t45n('assets.step45n.assetsOverview.assetOverview')}
      description={t45n('assets.step45n.assetsOverview.trackAssetOwnershipInventoryStatusAndAttentionItems')}
      actions={<Link className="inno-link-button" to="/assets/inventory">{t45n('assets.step45n.assetsOverview.viewAssetInventory')}</Link>}
      illustration={<img src="/illustrations/asset-inventory.svg" alt="" />}
    >

      {query.isPending ? <LoadingState label={t45n('assets.step45n.assetsOverview.loadingAssets')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>{t45n('assets.step45n.assetsOverview.allAssets')}</span><b>{query.data.totalAssets}</b><small>{t45n('assets.step45n.assetsOverview.visibleInYourScope')}</small></div>
            <div><span>{t45n('assets.automation.editor.lifecycle.in_use')}</span><b>{query.data.inUse}</b><small>{query.data.unassigned} {t45n('assets.step45n.assetsOverview.unassigned')}</small></div>
            <div><span>{t45n('assets.automation.editor.lifecycle.stock')}</span><b>{query.data.inStock}</b><small>{t45n('assets.step45n.assetsOverview.availableInventory')}</small></div>
            <div><span>{t45n('assets.step45n.assetsOverview.repairReview')}</span><b>{query.data.repair}</b><small>{query.data.warrantyExpiring} {t45n('assets.step45n.assetsOverview.warrantiesExpireWithin90Days')}</small></div>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title={t45n('assets.step45n.assetsOverview.recentlyUpdatedAssets')}
              description={t45n('assets.step45n.assetsOverview.latestInventoryOrOwnershipChanges')}
              meta={<Link className="open-resource" to="/assets/inventory">{t45n('assets.step45n.assetsOverview.viewAll')}</Link>}
            />
            {query.data.recentAssets.length === 0 ? (
              <div className="collection-state"><INNOState kind="empty" title={t45n('assets.step45n.assetsOverview.noRecentAssetChanges')} description={t45n('assets.step45n.assetsOverview.recentInventoryAndOwnershipUpdatesWillAppearHere')} /></div>
            ) : (
              <INNOTableWrap width="wide">
                <table>
                  <thead><tr><th>{t45n('reports.column.name')}</th><th>{t45n('reports.column.category')}</th><th>{t45n('reports.runs.status')}</th><th>{t45n('reports.table.updated')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
                  <tbody>
                    {query.data.recentAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                        <td>{asset.category}</td>
                        <td><INNOStatus>{statusLabel(asset.status)}</INNOStatus></td>
                        <td>{new Date(asset.updatedAt).toLocaleString()}</td>
                        <td className="action-column"><RouterRowAction to={'/assets/' + asset.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + asset.assetTag} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
            )}
          </INNOCollection>
        </>
      ) : null}
    </INNOPage>
  );
}
