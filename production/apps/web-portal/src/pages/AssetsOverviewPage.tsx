import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOCollection, INNOCollectionHeader, INNOPage, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getAssetOverview } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AssetsOverviewPage() {
  const query = useQuery({ queryKey: ['assets', 'overview'], queryFn: getAssetOverview });

  return (
    <INNOPage
      eyebrow="Assets"
      title="Asset Overview"
      description="Track asset ownership, inventory status and attention items inside your effective scope."
      actions={<Link className="inno-link-button" to="/assets/inventory">View Asset Inventory</Link>}
      illustration={<img src="/illustrations/asset-inventory.svg" alt="" />}
    >

      {query.isPending ? <LoadingState label="Loading Assets…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>All assets</span><b>{query.data.totalAssets}</b><small>Visible in your scope</small></div>
            <div><span>In use</span><b>{query.data.inUse}</b><small>{query.data.unassigned} unassigned</small></div>
            <div><span>In stock</span><b>{query.data.inStock}</b><small>Available inventory</small></div>
            <div><span>Repair / review</span><b>{query.data.repair}</b><small>{query.data.warrantyExpiring} warranties expire within 90 days</small></div>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title="Recently updated assets"
              description="Latest inventory or ownership changes."
              meta={<Link className="open-resource" to="/assets/inventory">View all</Link>}
            />
            {query.data.recentAssets.length === 0 ? (
              <div className="collection-state"><INNOState kind="empty" title="No recent asset changes" description="Recent inventory and ownership updates will appear here." /></div>
            ) : (
              <INNOTableWrap width="wide">
                <table>
                  <thead><tr><th>Asset</th><th>Category</th><th>Status</th><th>Updated</th><th className="action-column">Action</th></tr></thead>
                  <tbody>
                    {query.data.recentAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                        <td>{asset.category}</td>
                        <td><INNOStatus>{statusLabel(asset.status)}</INNOStatus></td>
                        <td>{new Date(asset.updatedAt).toLocaleString()}</td>
                        <td className="action-column"><RouterRowAction to={'/assets/' + asset.id} ariaLabel={'Open ' + asset.assetTag} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
            )}
          </INNOCollection>
        </>
      ) : null}
    </INNOPage>
  );
}
