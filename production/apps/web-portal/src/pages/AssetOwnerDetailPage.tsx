import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOIcon, INNOCollection, INNOCollectionHeader, INNOResourceHeader, INNOResourceSummary, INNOResourceSummaryItem, INNOState, INNOStatus, INNOSurfaceTabs, INNOTableWrap } from '@inno/ui';
import { getAssetOwner } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';

export function AssetOwnerDetailPage() {
  const { userId = '' } = useParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'assets'>('overview');
  const query = useQuery({ queryKey: ['assets', 'owner', userId], queryFn: () => getAssetOwner(userId), enabled: Boolean(userId) });

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading owner…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const owner = query.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb"><Link to="/assets/owners">Asset Owners</Link><span>›</span><span>{owner.fullName}</span></div>

      <INNOResourceHeader
        icon={<INNOIcon token="section.userProfiles" size={20} />}
        title={owner.fullName}
        status={<INNOStatus>{owner.assets.length} assets</INNOStatus>}
        meta={<><span>{owner.employeeId}</span><span>·</span><span>{owner.email}</span></>}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Assets" value={owner.assets.length} detail="Currently assigned" />
        <INNOResourceSummaryItem label="Organization" value={owner.organization ?? '—'} detail="Platform identity" />
        <INNOResourceSummaryItem label="Location" value={owner.location ?? '—'} detail="Primary site" />
        <INNOResourceSummaryItem label="Email" value={owner.email} detail="Read-only identity" />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel="Asset owner detail sections"
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'assets')}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'assets', label: 'Assets' },
        ]}
      />

      <div hidden={activeTab !== 'overview'}>
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>Ownership profile</h3><p>Identity fields are read-only here; user administration remains in Admin Center.</p></div>
          </div>
          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>Employee ID</span><b>{owner.employeeId}</b></div>
            <div className="kv-row"><span>Email</span><b>{owner.email}</b></div>
            <div className="kv-row"><span>Organization</span><b>{owner.organization ?? '—'}</b></div>
            <div className="kv-row"><span>Location</span><b>{owner.location ?? '—'}</b></div>
          </div>
        </section>
      </div>

      <div hidden={activeTab !== 'assets'}>
        <INNOCollection>
          <INNOCollectionHeader title="Owned Assets" description="Assets currently assigned to this user." meta={<INNOStatus>{owner.assets.length} assets</INNOStatus>} />
          {owner.assets.length === 0 ? (
            <div className="collection-state"><INNOState kind="empty" title="No owned assets" description="No visible Assets are currently assigned to this user." /></div>
          ) : (
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>Asset</th><th>Model</th><th>Status</th><th>Updated</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {owner.assets.map((asset) => (
                    <tr key={asset.id}>
                      <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                      <td>{asset.brandModel || '—'}</td>
                      <td><INNOStatus>{asset.status.replaceAll('_', ' ')}</INNOStatus></td>
                      <td>{new Date(asset.assignedAt).toLocaleString()}</td>
                      <td className="action-column"><RouterRowAction to={'/assets/' + asset.id} ariaLabel={'Open ' + asset.assetTag} /></td>
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
