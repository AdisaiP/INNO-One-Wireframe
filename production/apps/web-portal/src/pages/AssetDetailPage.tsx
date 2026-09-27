import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOButton } from '@inno/ui';
import { changeAssetOwnership, getAsset, getAssetOwners, updateAsset } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function money(value?: number | null) {
  return value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value);
}
function statusLabel(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

export function AssetDetailPage() {
  const { assetId = '' } = useParams();
  const canManage = usePermission('assets.manage');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['assets', 'detail', assetId], queryFn: () => getAsset(assetId), enabled: Boolean(assetId) });
  const owners = useQuery({ queryKey: ['assets', 'owners', 'picker'], queryFn: () => getAssetOwners({ pageSize: 100 }), enabled: canManage });
  const [form, setForm] = useState({ name: '', category: '', lifecycleStatus: '', purchasePrice: '' });
  const [ownerId, setOwnerId] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setForm({
      name: query.data.name,
      category: query.data.category,
      lifecycleStatus: query.data.status,
      purchasePrice: query.data.purchasePrice?.toString() ?? '',
    });
    setOwnerId(query.data.owner?.id ?? '');
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateAsset(assetId, query.data?.eTag ?? '', {
      name: form.name,
      category: form.category,
      lifecycleStatus: form.lifecycleStatus,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
    }),
    onSuccess: async () => { setSaveError(''); await queryClient.invalidateQueries({ queryKey: ['assets'] }); },
    onError: (error: Error) => setSaveError(error.message),
  });

  const ownerMutation = useMutation({
    mutationFn: () => changeAssetOwnership(assetId, query.data?.eTag ?? '', {
      ownerUserId: ownerId || undefined,
      reasonCode: 'manual_assignment',
    }),
    onSuccess: async () => { setSaveError(''); await queryClient.invalidateQueries({ queryKey: ['assets'] }); },
    onError: (error: Error) => setSaveError(error.message),
  });

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading asset…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const asset = query.data;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb"><Link to="/assets/inventory">Asset Inventory</Link><span>›</span><span>{asset.assetTag}</span></div>
      <div className="resource-head production-resource-head">
        <div>
          <div className="resource-title-line"><h1>{asset.assetTag}</h1><span className="prod-tag">{statusLabel(asset.status)}</span></div>
          <div className="resource-meta-line"><span>{asset.name}</span><span>·</span><span>{[asset.brand, asset.model].filter(Boolean).join(' ') || asset.category}</span><span>·</span><span>{asset.serialNumber ?? 'No serial'}</span></div>
        </div>
        {asset.linkedDevice ? <Link className="inno-link-button secondary-link" to={'/devices/' + asset.linkedDevice.id}>Open Device</Link> : null}
      </div>

      <div className="production-stat-strip">
        <div><span>Purchase price</span><b>{money(asset.purchasePrice)}</b><small>Registered {new Date(asset.registeredAt).toLocaleDateString()}</small></div>
        <div><span>Owner</span><b>{asset.owner?.name ?? 'Unassigned'}</b><small>{asset.organization?.name ?? 'No organization'}</small></div>
        <div><span>Warranty</span><b>{asset.warrantyEndAt ? new Date(asset.warrantyEndAt).toLocaleDateString() : '—'}</b><small>{asset.warrantyEndAt && new Date(asset.warrantyEndAt) > new Date() ? 'Active' : 'No active warranty'}</small></div>
        <div><span>Source</span><b>{asset.source.replaceAll('_', ' ')}</b><small>Updated {new Date(asset.updatedAt).toLocaleString()}</small></div>
      </div>

      {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
      <div className="device-overview-grid">
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Asset information</h3><p>Canonical inventory record owned by Assets.</p></div></div>
          {canManage ? (
            <div className="editor-form">
              <div className="editor-grid">
                <label className="field-block field-wide"><span>Asset name</span><input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></label>
                <label className="field-block"><span>Category</span><select value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}><option>Computer</option><option>Notebook</option><option>Monitor</option><option>Printer</option><option>Other</option></select></label>
                <label className="field-block"><span>Status</span><select value={form.lifecycleStatus} onChange={(e) => setForm((v) => ({ ...v, lifecycleStatus: e.target.value }))}><option value="in_use">In use</option><option value="stock">Stock</option><option value="repair">Repair</option><option value="retired">Retired</option></select></label>
                <label className="field-block"><span>Purchase price · THB</span><input type="number" min="0" value={form.purchasePrice} onChange={(e) => setForm((v) => ({ ...v, purchasePrice: e.target.value }))} /></label>
              </div>
              <div className="editor-footer standalone-editor-footer"><span className="editor-footer-note">Changes are audited and version checked.</span><INNOButton disabled={saveMutation.isPending || !form.name.trim()} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'Saving…' : 'Save Asset'}</INNOButton></div>
            </div>
          ) : (
            <div className="kv-grid production-kv-grid">
              <div className="kv-row"><span>Asset name</span><b>{asset.name}</b></div><div className="kv-row"><span>Category</span><b>{asset.category}</b></div><div className="kv-row"><span>Status</span><b>{statusLabel(asset.status)}</b></div><div className="kv-row"><span>Serial</span><b>{asset.serialNumber ?? '—'}</b></div>
            </div>
          )}
        </section>

        <div className="panel-stack">
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Current owner</h3><p>Ownership is a business relationship, not an identity record.</p></div></div>
            {canManage ? <div className="settings-stack">
              <label className="field-block"><span>Assigned user</span><select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="">Unassigned</option>{owners.data?.items.map((owner) => <option key={owner.id} value={owner.id}>{owner.fullName} · {owner.employeeId}</option>)}</select></label>
              <INNOButton variant="secondary" disabled={ownerMutation.isPending || ownerId === (asset.owner?.id ?? '')} onClick={() => ownerMutation.mutate()}>{ownerMutation.isPending ? 'Updating…' : 'Change owner'}</INNOButton>
            </div> : <div className="settings-row"><div><b>{asset.owner?.name ?? 'Unassigned'}</b><span>{asset.organization?.name ?? 'No organization'}</span></div></div>}
          </section>
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Linked managed endpoint</h3><p>Read through the Devices directory contract.</p></div></div>
            {asset.linkedDevice ? <div className="settings-row"><div><b>{asset.linkedDevice.name}</b><span>{asset.linkedDevice.operatingSystem ?? 'Unknown OS'}</span></div><span className="prod-tag">{asset.linkedDevice.status}</span></div> : <div className="compact-empty">No managed endpoint linked.</div>}
          </section>
        </div>
      </div>

      <section className="collection-card">
        <div className="collection-head"><div><h2>Ownership history</h2><p>Immutable ownership changes for this asset.</p></div></div>
        <div className="production-table-wrap"><table className="production-table"><thead><tr><th>Effective</th><th>Previous owner</th><th>Owner</th><th>Reason</th></tr></thead><tbody>{asset.ownershipHistory.length ? asset.ownershipHistory.map((item) => <tr key={item.id}><td>{new Date(item.effectiveAt).toLocaleString()}</td><td>{item.previousOwner ?? 'Unassigned'}</td><td>{item.owner ?? 'Unassigned'}</td><td>{item.reasonCode.replaceAll('_', ' ')}</td></tr>) : <tr><td colSpan={4}>No ownership history.</td></tr>}</tbody></table></div>
      </section>
    </main>
  );
}
