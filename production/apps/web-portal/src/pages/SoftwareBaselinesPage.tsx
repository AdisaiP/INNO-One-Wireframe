import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOPage,
  INNOSearchField,
  INNOSelectField,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getSoftwareBaselines } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function SoftwareBaselinesPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('assets.baseline.manage');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');

  const query = useQuery({
    queryKey: ['assets', 'software-baselines', deferredSearch, status],
    queryFn: () => getSoftwareBaselines({ search: deferredSearch, status }),
  });

  const items = query.data?.items ?? [];

  return (
    <INNOPage
      eyebrow={t45n('assets.step45n.assetCustomFields.assetsManagement')}
      title={t45n('navigation.softwareBaselines')}
      description={t45n('devices.step45n.softwareBaselines.defineRequiredSoftwareAndReviewEvidenceBackedCompliance')}
      actions={canManage ? (
        <Link className="inno-link-button" to="/assets/software-baselines/new">{t45n('devices.step45n.softwareBaselineEditor.newBaseline')}</Link>
      ) : undefined}
    >
      <div className="baseline-info" role="status">
        {t45n('devices.step45n.softwareBaselines.evaluationUsesDevicesObservationsFromTheLast24')}</div>

      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('devices.step45n.softwareBaselines.baselineDefinitions')}
          description={query.data ? query.data.totalItems + ' ' + t45n('devices.step45n.softwareBaselines.matchingDefinitions') : t45n('devices.step45n.softwareBaselines.requiredSoftwarePolicies')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('devices.step45n.softwareBaselines.baselines')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('devices.step45n.softwareBaselines.searchBaselines')} value={search} onChange={setSearch} placeholder={t45n('devices.step45n.softwareBaselines.searchCodeOrName')} />
          <INNOSelectField label={t45n('assets.step45n.assetInventory.statusFilter')} value={status} onChange={setStatus}>
            <option value="all">{t45n('devices.step45n.softwareBaselines.allStatuses')}</option>
            <option value="draft">{t45n('workflow.status.draft')}</option>
            <option value="active">{t45n('reports.status.active')}</option>
            <option value="inactive">{t45n('admin.step45n.adminAccessScopeEdit.inactive')}</option>
          </INNOSelectField>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label={t45n('devices.step45n.softwareBaselines.loadingSoftwareBaselines')} />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : items.length ? (
          <INNOTableWrap width="wide">
            <table>
              <thead>
                <tr>
                  <th>{t45n('devices.step45n.softwareBaselines.baseline')}</th>
                  <th>{t45n('devices.step45n.softwareBaselineDetail.targetCategory')}</th>
                  <th>{t45n('devices.step45n.softwareBaselineDetail.requiredSoftware')}</th>
                  <th>{t45n('reports.runs.status')}</th>
                  <th>{t45n('devices.step45n.softwareBaselineDetail.evaluation')}</th>
                  <th>{t45n('reports.table.updated')}</th>
                  <th className="action-column">{t45n('reports.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.name}</b><div className="table-meta">{item.code}</div></td>
                    <td>{item.targetCategory || t45n('devices.step45n.softwareBaselineDetail.allAssetCategories')}</td>
                    <td>{item.requiredPackages.length}</td>
                    <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
                    <td><INNOStatus tone={item.evaluationStatus === 'current' ? 'success' : item.evaluationStatus === 'stale' ? 'warning' : 'neutral'}>{item.evaluationStatus.replaceAll('_', ' ')}</INNOStatus></td>
                    <td>{new Date(item.updatedAt).toLocaleString()}</td>
                    <td className="action-column">
                      <RouterRowAction
                        to={'/assets/software-baselines/' + item.id}
                        ariaLabel={t45n('common.step45n.search.open') + ' ' + item.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <INNOCollectionState
            kind={search || status !== 'all' ? 'no-results' : 'empty'}
            title={search || status !== 'all' ? t45n('devices.step45n.softwareBaselines.noMatchingBaselines') : t45n('devices.step45n.softwareBaselines.noSoftwareBaselinesYet')}
            description={search || status !== 'all'
              ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters')
              : t45n('devices.step45n.softwareBaselines.createTheFirstBaselineWhenRequiredSoftwarePolicy')}
            action={search || status !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); }}>{t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
              : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
