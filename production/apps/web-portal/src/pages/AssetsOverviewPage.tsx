import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOPage } from '@inno/ui';
import { getAssetOverview } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function AssetsOverviewPage() {
  const query = useQuery({ queryKey: ['assets', 'overview'], queryFn: getAssetOverview });

  return (
    <INNOPage eyebrow="Assets" title="Asset Overview">
      <div className="page-intro-row">
        <p className="page-helper">Ownership, inventory status and attention items inside your effective scope.</p>
        <Link className="inno-link-button" to="/assets/inventory">View Asset Inventory</Link>
      </div>

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

          <section className="collection-card">
            <div className="collection-head">
              <div><h2>Recently updated assets</h2><p>Latest inventory or ownership changes.</p></div>
              <Link className="open-resource" to="/assets/inventory">View all</Link>
            </div>
            <div className="production-table-wrap">
              <table className="production-table">
                <thead><tr><th>Asset</th><th>Category</th><th>Status</th><th>Updated</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {query.data.recentAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                      <td>{asset.category}</td>
                      <td><span className="prod-tag">{statusLabel(asset.status)}</span></td>
                      <td>{new Date(asset.updatedAt).toLocaleString()}</td>
                      <td className="action-column"><Link className="open-resource" to={'/assets/' + asset.id}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </INNOPage>
  );
}
