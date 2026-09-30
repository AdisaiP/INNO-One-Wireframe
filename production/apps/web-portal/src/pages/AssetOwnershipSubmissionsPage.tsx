import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOPage, INNOSelectField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
import { decideOwnershipSubmission, getOwnershipSubmissions } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

export function AssetOwnershipSubmissionsPage() {
  const canManage = usePermission('assets.manage');
  const [status, setStatus] = useState('pending');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['assets', 'ownership-submissions', status], queryFn: () => getOwnershipSubmissions({ status, pageSize: 100 }) });
  const decision = useMutation({
    mutationFn: ({ id, eTag, value }: { id: string; eTag: string; value: 'confirmed' | 'rejected' }) => decideOwnershipSubmission(id, eTag, { decision: value }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['assets'] }); },
  });

  return <INNOPage
    eyebrow="Assets · Ownership"
    title="Agent Submissions"
    description="Review ownership information submitted by the separate Endpoint Agent surface."
  >
    <INNOCollection>
      <INNOCollectionHeader
        title="Ownership submissions"
        description="Durable confirmations awaiting Web review."
        meta={query.data ? <INNOStatus>{query.data.totalItems} submissions</INNOStatus> : undefined}
      />
      <INNOCollectionToolbar>
        <INNOSelectField label="Submission status" value={status} onChange={setStatus}>
          <option value="pending">Status: Pending</option>
          <option value="all">All</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
        </INNOSelectField>
        <INNOToolbarSpacer />
        <INNOToolbarMeta>Endpoint Agent is not embedded in Web</INNOToolbarMeta>
      </INNOCollectionToolbar>
      {decision.isError ? <div className="form-error" role="alert">{decision.error.message}</div> : null}
      {query.isPending ? (
        <div className="collection-state"><LoadingState label="Loading submissions…" /></div>
      ) : query.isError ? (
        <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
      ) : query.data.items.length === 0 ? (
        <div className="collection-state"><INNOState kind="empty" title="No ownership submissions" description="No submissions match the selected status." /></div>
      ) : (
        <INNOTableWrap width="xwide">
          <table>
            <thead><tr><th>User / Device</th><th>Asset</th><th>Submitted</th><th>Possession</th><th>Changes</th><th>Status</th>{canManage ? <th className="action-column">Decision</th> : null}</tr></thead>
            <tbody>{query.data.items.map((item) => <tr key={item.id}><td><b>{item.userName}</b><div className="table-meta">{item.deviceName}</div></td><td>{item.assetTag}</td><td>{new Date(item.submittedAt).toLocaleString()}</td><td>{item.possession}</td><td>{item.changes.join(', ') || 'No changes'}</td><td><INNOStatus tone={item.status === 'confirmed' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}>{item.status}</INNOStatus></td>{canManage ? <td className="action-column">{item.status === 'pending' ? <div className="inline-actions"><INNOButton variant="secondary" disabled={decision.isPending} onClick={() => decision.mutate({ id: item.id, eTag: item.eTag, value: 'rejected' })}>Reject</INNOButton><INNOButton disabled={decision.isPending} onClick={() => decision.mutate({ id: item.id, eTag: item.eTag, value: 'confirmed' })}>Confirm</INNOButton></div> : <span>Reviewed</span>}</td> : null}</tr>)}</tbody>
          </table>
        </INNOTableWrap>
      )}
    </INNOCollection>
  </INNOPage>;
}
