import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RouterRowAction } from '../components/RouterRowAction';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
import { getAssets } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function statusLabel(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

export function AssetInventoryPage() {
  const { t: t45n } = useStep45NI18n();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  useEffect(() => setPage(1), [deferredSearch, category, status]);

  const query = useQuery({
    queryKey: ['assets', 'inventory', page, deferredSearch, category, status],
    queryFn: () => getAssets({ page, pageSize, search: deferredSearch, category, status }),
  });

  return (
    <INNOPage
      eyebrow={t45n('navigation.assets')}
      title={t45n('navigation.assetInventory')}
      description={t45n('assets.step45n.assetInventory.findRegisteredAssetsAndInventorySynchronizedFromManaged')}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('navigation.assets')}
          description={query.data ? query.data.totalItems + ' ' + t45n('assets.step45n.assetInventory.assetsInScope') : t45n('assets.step45n.assetInventory.assetRegister')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('assets.step45n.assetInventory.assets')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('assets.step45n.assetInventory.searchAssets')} value={search} onChange={setSearch} placeholder={t45n('assets.step45n.assetInventory.searchTagNameSerialModel')} />
          <INNOSelectField label={t45n('assets.step45n.assetInventory.categoryFilter')} value={category} onChange={setCategory}>
            <option value="all">{t45n('assets.step45n.assetInventory.categoryAll')}</option>
            <option>{t45n('assets.step45n.assetEdit.computer')}</option>
            <option>{t45n('devices.shared.deviceType.notebook')}</option>
            <option>{t45n('assets.step45n.assetEdit.monitor')}</option>
            <option>{t45n('assets.step45n.assetEdit.printer')}</option>
          </INNOSelectField>
          <INNOSelectField label={t45n('assets.step45n.assetInventory.statusFilter')} value={status} onChange={setStatus}>
            <option value="all">{t45n('admin.step45n.adminUsers.statusAll')}</option>
            <option value="in_use">{t45n('assets.automation.editor.lifecycle.in_use')}</option>
            <option value="stock">{t45n('assets.step45n.assetEdit.stock')}</option>
            <option value="repair">{t45n('assets.automation.editor.lifecycle.repair')}</option>
            <option value="retired">{t45n('assets.automation.editor.lifecycle.retired')}</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>{t45n('assets.step45n.assetInventory.authorizationFilteredServerSide')}</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label={t45n('assets.step45n.assetInventory.loadingAssets')} />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || category !== 'all' || status !== 'all' ? 'no-results' : 'empty'}
            title={search || category !== 'all' || status !== 'all' ? t45n('assets.step45n.assetInventory.noAssetsFound') : t45n('assets.step45n.assetInventory.noAssetsInScope')}
            description={search || category !== 'all' || status !== 'all'
              ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters')
              : t45n('assets.step45n.assetInventory.noRegisteredAssetIsVisibleInsideYourEffective')}
            action={search || category !== 'all' || status !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
              : undefined}
          />
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr><th>{t45n('reports.column.name')}</th><th>{t45n('reports.column.category')}</th><th>{t45n('assets.step45n.assetInventory.brandModel')}</th><th>{t45n('reports.column.owner')}</th><th>{t45n('profile.location')}</th><th>{t45n('reports.column.registeredAt')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr>
                </thead>
                <tbody>{query.data.items.map((asset) => (
                  <tr key={asset.id}>
                    <td><b>{asset.assetTag}</b><div className="table-meta">{asset.serialNumber ?? asset.name}</div></td>
                    <td>{asset.category}</td>
                    <td>{asset.brandModel || '—'}</td>
                    <td>{asset.owner ?? '—'}</td>
                    <td>{asset.location ?? asset.organization ?? '—'}</td>
                    <td>{new Date(asset.registeredAt).toLocaleDateString()}</td>
                    <td><INNOStatus>{statusLabel(asset.status)}</INNOStatus></td>
                    <td className="action-column"><RouterRowAction to={'/assets/' + asset.id} ariaLabel={t45n('common.step45n.search.open') + ' ' + asset.assetTag} /></td>
                  </tr>
                ))}</tbody>
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
