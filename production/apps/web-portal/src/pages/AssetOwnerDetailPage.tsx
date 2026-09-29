import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOIcon, INNOCollection, INNOCollectionHeader, INNOResourceHeader, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
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
    <INNOResourceHeader
      icon={<INNOIcon token="section.userProfiles" size={20} />}
      title={owner.fullName}
      status={<INNOStatus>{owner.assets.length} assets</INNOStatus>}
      meta={<><span>{owner.employeeId}</span><span>·</span><span>{owner.organization ?? 'No organization'}</span><span>·</span><span>{owner.email}</span></>}
    />
    <section className="prod-panel"><div className="prod-panel-head"><div><h3>User profile</h3><p>Identity data is read-only here and remains owned by Platform.</p></div></div><div className="kv-grid production-kv-grid"><div className="kv-row"><span>Employee ID</span><b>{owner.employeeId}</b></div><div className="kv-row"><span>Email</span><b>{owner.email}</b></div><div className="kv-row"><span>Organization</span><b>{owner.organization ?? '—'}</b></div><div className="kv-row"><span>Location</span><b>{owner.location ?? '—'}</b></div></div></section>
    <INNOCollection>
      <INNOCollectionHeader title="Owned Assets" description="Assets currently assigned to this user." />
      {owner.assets.length === 0 ? (
        <div className="collection-state"><INNOState kind="empty" title="No owned assets" description="No visible Assets are currently assigned to this user." /></div>
      ) : (
        <INNOTableWrap width="wide"><table><thead><tr><th>Asset</th><th>Model</th><th>Status</th><th>Updated</th><th className="action-column">Action</th></tr></thead><tbody>{owner.assets.map((asset) => <tr key={asset.id}><td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td><td>{asset.brandModel || '—'}</td><td><INNOStatus>{asset.status.replaceAll('_', ' ')}</INNOStatus></td><td>{new Date(asset.assignedAt).toLocaleString()}</td><td className="action-column"><Link className="device-row-action" to={'/assets/' + asset.id} aria-label={'Open ' + asset.assetTag}><INNOIcon token="action.next" size={14} /></Link></td></tr>)}</tbody></table></INNOTableWrap>
      )}
    </INNOCollection>
  </main>;
}
