import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOIcon, INNOCollection, INNOCollectionHeader, INNOResourceHeader, INNOResourceSummary, INNOResourceSummaryItem, INNOState, INNOStatus, INNOSurfaceTabs, INNOTableWrap } from '@inno/ui';
import { getAssetOwner } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AssetOwnerDetailPage() {
  const { t: t45n } = useStep45NI18n();
  const { userId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'assets'>('overview');
  const query = useQuery({ queryKey: ['assets', 'owner', userId], queryFn: () => getAssetOwner(userId), enabled: Boolean(userId) });

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('assets.step45n.assetOwnerDetail.loadingOwner')} /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const owner = query.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb"><Link to="/assets/owners">{t45n('navigation.assetOwners')}</Link><span>›</span><span>{owner.fullName}</span></div>

      <INNOResourceHeader
        icon={<INNOIcon token="section.userProfiles" size={20} />}
        title={owner.fullName}
        status={<INNOStatus>{owner.assets.length} {t45n('assets.step45n.assetInventory.assets')}</INNOStatus>}
        meta={<><span>{owner.employeeId}</span><span>·</span><span>{owner.email}</span></>}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('navigation.assets')} value={owner.assets.length} detail="Currently assigned" />
        <INNOResourceSummaryItem label={t45n('profile.organization')} value={owner.organization ?? '—'} detail="Platform identity" />
        <INNOResourceSummaryItem label={t45n('profile.location')} value={owner.location ?? '—'} detail="Primary site" />
        <INNOResourceSummaryItem label={t45n('profile.email')} value={owner.email} detail="Read-only identity" />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel={t45n('assets.step45n.assetOwnerDetail.assetOwnerDetailSections')}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'assets')}
        items={[
          { id: 'overview', label: t45n('navigation.overview') },
          { id: 'assets', label: t45n('navigation.assets') },
        ]}
      />

      <div hidden={activeTab !== 'overview'}>
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>{t45n('assets.step45n.assetOwnerDetail.ownershipProfile')}</h3><p>{t45n('assets.step45n.assetOwnerDetail.identityFieldsAreReadOnlyHereUserAdministration')}</p></div>
          </div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>{t45n('profile.employeeId')}</span><b>{owner.employeeId}</b></div>
            <div className="kv-row"><span>{t45n('profile.email')}</span><b>{owner.email}</b></div>
            <div className="kv-row"><span>{t45n('profile.organization')}</span><b>{owner.organization ?? '—'}</b></div>
            <div className="kv-row"><span>{t45n('profile.location')}</span><b>{owner.location ?? '—'}</b></div>
          </div>
        </section>
      </div>

      <div hidden={activeTab !== 'assets'}>
        <INNOCollection>
          <INNOCollectionHeader title={t45n('assets.step45n.assetOwnerDetail.ownedAssets')} description={t45n('assets.step45n.assetOwnerDetail.assetsCurrentlyAssignedToThisUser')} meta={<INNOStatus>{owner.assets.length} {t45n('assets.step45n.assetInventory.assets')}</INNOStatus>} />
          {owner.assets.length === 0 ? (
            <div className="collection-state"><INNOState kind="empty" title={t45n('assets.step45n.assetOwnerDetail.noOwnedAssets')} description={t45n('assets.step45n.assetOwnerDetail.noVisibleAssetsAreCurrentlyAssignedToThis')} /></div>
          ) : (
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>{t45n('reports.column.name')}</th><th>{t45n('reports.column.model')}</th><th>{t45n('reports.runs.status')}</th><th>{t45n('reports.table.updated')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
                <tbody>
                  {owner.assets.map((asset) => (
                    <tr key={asset.id}>
                      <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                      <td>{asset.brandModel || '—'}</td>
                      <td><INNOStatus>{asset.status.replaceAll('_', ' ')}</INNOStatus></td>
                      <td>{new Date(asset.assignedAt).toLocaleString()}</td>
                      <td className="action-column"><RouterRowAction to={'/assets/' + asset.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + asset.assetTag} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
          )}
        </INNOCollection>
      </div>
    </main>
  );
}
