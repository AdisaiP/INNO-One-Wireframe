import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getAssetOwner } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

export function AssetOwnerDetailPage() {
  const { userId = '' } = useParams();
  const query = useQuery({ queryKey: ['assets', 'owner', userId], queryFn: () => getAssetOwner(userId), enabled: Boolean(userId) });
  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading owner…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  const owner = query.data;
  return <main className="inno-page">
    <div className="resource-breadcrumb"><Link to="/assets/owners">User Profiles</Link><span>›</span><span>{owner.fullName}</span></div>
    <div className="resource-head production-resource-head"><div><div className="resource-title-line"><h1>{owner.fullName}</h1></div><div className="resource-meta-line"><span>{owner.employeeId}</span><span>·</span><span>{owner.organization ?? 'No organization'}</span><span>·</span><span>{owner.email}</span></div></div></div>
    <section className="prod-panel"><div className="prod-panel-head"><div><h3>User profile</h3><p>Identity data is read-only here and remains owned by Platform.</p></div><span className="prod-tag">{owner.assets.length} assets</span></div><div className="kv-grid production-kv-grid"><div className="kv-row"><span>Employee ID</span><b>{owner.employeeId}</b></div><div className="kv-row"><span>Email</span><b>{owner.email}</b></div><div className="kv-row"><span>Organization</span><b>{owner.organization ?? '—'}</b></div><div className="kv-row"><span>Location</span><b>{owner.location ?? '—'}</b></div></div></section>
    <section className="collection-card"><div className="collection-head"><div><h2>Owned Assets</h2><p>Assets currently assigned to this user.</p></div></div><div className="production-table-wrap"><table className="production-table"><thead><tr><th>Asset</th><th>Model</th><th>Status</th><th>Updated</th><th className="action-column">Action</th></tr></thead><tbody>{owner.assets.map((asset) => <tr key={asset.id}><td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td><td>{asset.brandModel || '—'}</td><td><span className="prod-tag">{asset.status.replaceAll('_', ' ')}</span></td><td>{new Date(asset.assignedAt).toLocaleString()}</td><td className="action-column"><Link className="open-resource" to={'/assets/' + asset.id}>Open Asset</Link></td></tr>)}</tbody></table></div></section>
  </main>;
}
