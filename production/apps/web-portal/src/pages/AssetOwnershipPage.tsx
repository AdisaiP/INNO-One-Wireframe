import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOPage } from '@inno/ui';
import { getAssetOwnership } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

export function AssetOwnershipPage() {
  const query = useQuery({ queryKey: ['assets', 'ownership'], queryFn: getAssetOwnership });
  return (
    <INNOPage eyebrow="Assets · Ownership" title="Ownership & Users">
      <p className="page-helper">Review ownership state while user identity remains owned by Platform.</p>
      {query.isPending ? <LoadingState label="Loading ownership…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? <>
        <div className="production-stat-strip">
          <div><span>Assigned</span><b>{query.data.assignedAssets}</b><small>Assets with an owner</small></div>
          <div><span>Confirmed</span><b>{query.data.confirmedOwnership}</b><small>Current ownership records</small></div>
          <div><span>Pending confirmation</span><b>{query.data.pendingSubmissions}</b><small>From Endpoint Agent</small></div>
          <div><span>Unassigned</span><b>{query.data.unassignedAssets}</b><small>Need an owner or pool</small></div>
        </div>
        <div className="helpdesk-overview-grid">
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>User Profiles</h3><p>Open users with current asset ownership.</p></div><Link className="open-resource" to="/assets/owners">View users</Link></div>
            <div className="settings-stack"><div className="settings-row"><div><b>Platform directory</b><span>Names and organization are read through the shared directory contract.</span></div><span className="prod-tag success">Connected</span></div></div>
          </section>
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Agent Submissions</h3><p>Review durable ownership confirmations from the Endpoint Agent.</p></div><Link className="open-resource" to="/assets/ownership/submissions">Review queue</Link></div>
            <div className="settings-stack"><div className="settings-row"><div><b>Pending review</b><span>Endpoint Agent remains a separate client surface.</span></div><b>{query.data.pendingSubmissions}</b></div></div>
          </section>
        </div>
        <section className="collection-card">
          <div className="collection-head"><div><h2>Recent ownership changes</h2><p>Latest assignment history visible in your scope.</p></div></div>
          <div className="production-table-wrap"><table className="production-table"><thead><tr><th>Asset</th><th>Previous owner</th><th>Owner</th><th>Reason</th><th>Effective</th></tr></thead><tbody>{query.data.recentChanges.length ? query.data.recentChanges.map((item) => <tr key={item.assetId + item.effectiveAt}><td><Link className="open-resource" to={'/assets/' + item.assetId}>{item.assetTag}</Link></td><td>{item.previousOwner ?? 'Unassigned'}</td><td>{item.owner ?? 'Unassigned'}</td><td>{item.reasonCode.replaceAll('_', ' ')}</td><td>{new Date(item.effectiveAt).toLocaleString()}</td></tr>) : <tr><td colSpan={5}>No ownership changes yet.</td></tr>}</tbody></table></div>
        </section>
      </> : null}
    </INNOPage>
  );
}
