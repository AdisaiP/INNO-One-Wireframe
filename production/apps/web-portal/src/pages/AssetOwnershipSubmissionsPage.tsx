import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOPage, INNORowActions, INNOSelectField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
import { decideOwnershipSubmission, getOwnershipSubmissions } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AssetOwnershipSubmissionsPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('assets.manage');
  const [status, setStatus] = useState('pending');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['assets', 'ownership-submissions', status], queryFn: () => getOwnershipSubmissions({ status, pageSize: 100 }) });
  const decision = useMutation({
    mutationFn: ({ id, eTag, value }: { id: string; eTag: string; value: 'confirmed' | 'rejected' }) => decideOwnershipSubmission(id, eTag, { decision: value }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['assets'] }); },
  });

  return <INNOPage
    eyebrow={t45n('assets.step45n.assetOwners.assetsOwnership')}
    title={t45n('navigation.agentSubmissions')}
    description={t45n('assets.step45n.assetOwnershipSubmissions.reviewOwnershipInformationSubmittedByTheSeparateEndpoint')}
  >
    <INNOCollection>
      <INNOCollectionHeader
        title={t45n('assets.step45n.assetOwnershipSubmissions.ownershipSubmissions')}
        description={t45n('assets.step45n.assetOwnershipSubmissions.durableConfirmationsAwaitingWebReview')}
        meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('assets.step45n.assetOwnershipSubmissions.submissions')}</INNOStatus> : undefined}
      />
      <INNOCollectionToolbar>
        <INNOSelectField label={t45n('assets.step45n.assetOwnershipSubmissions.submissionStatus')} value={status} onChange={setStatus}>
          <option value="pending">{t45n('assets.step45n.assetOwnershipSubmissions.statusPending')}</option>
          <option value="all">{t45n('admin.step45n.adminAccessScopeEdit.all')}</option>
          <option value="confirmed">{t45n('assets.step45n.assetOwnership.confirmed')}</option>
          <option value="rejected">{t45n('assets.step45n.assetOwnershipSubmissions.rejected')}</option>
        </INNOSelectField>
        <INNOToolbarSpacer />
        <INNOToolbarMeta>{t45n('assets.step45n.assetOwnershipSubmissions.endpointAgentIsNotEmbeddedInWeb')}</INNOToolbarMeta>
      </INNOCollectionToolbar>
      {decision.isError ? <div className="form-error" role="alert">{decision.error.message}</div> : null}
      {query.isPending ? (
        <div className="collection-state"><LoadingState label={t45n('assets.step45n.assetOwnershipSubmissions.loadingSubmissions')} /></div>
      ) : query.isError ? (
        <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
      ) : query.data.items.length === 0 ? (
        <div className="collection-state"><INNOState kind="empty" title={t45n('assets.step45n.assetOwnershipSubmissions.noOwnershipSubmissions')} description={t45n('assets.step45n.assetOwnershipSubmissions.noSubmissionsMatchTheSelectedStatus')} /></div>
      ) : (
        <INNOTableWrap width="xwide">
          <table>
            <thead><tr><th>{t45n('assets.step45n.assetOwnershipSubmissions.userDevice')}</th><th>{t45n('reports.column.name')}</th><th>{t45n('assets.step45n.assetOwnershipSubmissions.submitted')}</th><th>{t45n('assets.step45n.assetOwnershipSubmissions.possession')}</th><th>{t45n('assets.step45n.assetOwnershipSubmissions.changes')}</th><th>{t45n('reports.runs.status')}</th>{canManage ? <th className="action-column">{t45n('reports.table.action')}</th> : null}</tr></thead>
            <tbody>{query.data.items.map((item) => <tr key={item.id}><td><b>{item.userName}</b><div className="table-meta">{item.deviceName}</div></td><td>{item.assetTag}</td><td>{new Date(item.submittedAt).toLocaleString()}</td><td>{item.possession}</td><td>{item.changes.join(', ') || t45n('assets.step45n.assetOwnershipSubmissions.noChanges')}</td><td><INNOStatus tone={item.status === 'confirmed' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}>{item.status}</INNOStatus></td>{canManage ? <td className="action-column">{item.status === 'pending' ? <INNORowActions ariaLabel={t45n('assets.step45n.assetOwnershipSubmissions.ownershipSubmissionFor') + ' ' + item.assetTag} items={[{ id: 'confirm', label: t45n('assets.step45n.assetOwnershipSubmissions.confirm'), busy: decision.isPending, onSelect: () => decision.mutate({ id: item.id, eTag: item.eTag, value: 'confirmed' }) }, { id: 'reject', label: t45n('assets.step45n.assetOwnershipSubmissions.reject'), tone: 'danger', busy: decision.isPending, onSelect: () => decision.mutate({ id: item.id, eTag: item.eTag, value: 'rejected' }) }]} /> : <span className="table-meta">{t45n('assets.step45n.assetOwnershipSubmissions.reviewed')}</span>}</td> : null}</tr>)}</tbody>
          </table>
        </INNOTableWrap>
      )}
    </INNOCollection>
  </INNOPage>;
}
