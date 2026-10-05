import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RouterRowAction } from '../components/RouterRowAction';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOPage, INNOSearchField, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
import { getAssetOwners } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AssetOwnersPage() {
  const { t: t45n } = useStep45NI18n();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({ queryKey: ['assets', 'owners', deferredSearch], queryFn: () => getAssetOwners({ search: deferredSearch, pageSize: 100 }) });
  return (
    <INNOPage
      eyebrow={t45n('assets.step45n.assetOwners.assetsOwnership')}
      title={t45n('navigation.assetOwners')}
      description={t45n('assets.step45n.assetOwners.findAnAssetOwnerAndOpenTheirOwnership')}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('assets.step45n.assetOwners.assetOwners')}
          description={t45n('assets.step45n.assetOwners.peopleWithAssetOwnershipContextVisibleInYour')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('assets.step45n.assetOwners.owners')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('assets.step45n.assetOwners.searchOwners')} value={search} onChange={setSearch} placeholder={t45n('admin.step45n.adminUsers.searchNameEmployeeIdOrEmail')} />
          <INNOToolbarSpacer />
          <INNOToolbarMeta>{t45n('assets.step45n.assetInventory.authorizationFilteredServerSide')}</INNOToolbarMeta>
        </INNOCollectionToolbar>
        {query.isPending ? (
          <CollectionLoadingState label={t45n('assets.step45n.assetOwners.loadingAssetOwners')} />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search ? t45n('assets.step45n.assetOwners.noAssetOwnersFound') : t45n('assets.step45n.assetOwners.noAssetOwnersInScope')}
            description={search ? t45n('assets.step45n.assetOwners.tryAnotherNameEmployeeIdOrEmail') : t45n('assets.step45n.assetOwners.noPeopleWithVisibleAssetOwnershipContextAre')}
            action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>{t45n('assets.automation.clearSearch')}</INNOButton> : undefined}
          />
        ) : (
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>{t45n('assets.step45n.assetOwners.assetOwner')}</th><th>{t45n('profile.employeeId')}</th><th>{t45n('profile.organization')}</th><th>{t45n('assets.step45n.assetOwners.ownedAssets')}</th><th>{t45n('assets.step45n.assetOwners.lastOwnershipChange')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
              <tbody>{query.data.items.map((owner) => <tr key={owner.id}><td><b>{owner.fullName}</b><div className="table-meta">{owner.email}</div></td><td>{owner.employeeId}</td><td>{owner.organization ?? '—'}</td><td>{owner.assetCount}</td><td>{owner.lastOwnershipAt ? new Date(owner.lastOwnershipAt).toLocaleString() : '—'}</td><td className="action-column"><RouterRowAction to={'/assets/owners/' + owner.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + owner.fullName} /></td></tr>)}</tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
