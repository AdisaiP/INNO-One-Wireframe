import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNODialog,
  INNOIcon,
  INNOResourceHeader,
  INNOResourceSummary,
  INNOResourceSummaryItem,
  INNOState,
  INNOStatus,
  INNOSurfaceTabs,
  INNOTableWrap,
} from '@inno/ui';
import { changeAssetOwnership, getAsset, getAssetOwners } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function money(value?: number | null) {
  return value == null ? '—' : new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function customValueLabel(value: unknown, fieldType: string) {
  if (value == null || value === '') return '—';
  if (fieldType === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function AssetDetailPage() {
  const { assetId = '' } = useParams();
  const canManage = usePermission('assets.manage');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'custom' | 'ownership'>('overview');
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [ownerError, setOwnerError] = useState('');

  const query = useQuery({
    queryKey: ['assets', 'detail', assetId],
    queryFn: () => getAsset(assetId),
    enabled: Boolean(assetId),
  });

  const owners = useQuery({
    queryKey: ['assets', 'owners', 'picker'],
    queryFn: () => getAssetOwners({ pageSize: 100 }),
    enabled: canManage && ownerDialogOpen,
  });

  const ownerMutation = useMutation({
    mutationFn: () => changeAssetOwnership(assetId, query.data?.eTag ?? '', {
      ownerUserId: ownerId || undefined,
      reasonCode: 'manual_assignment',
    }),
    onSuccess: async () => {
      setOwnerError('');
      setOwnerDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (error: Error) => setOwnerError(error.message),
  });

  const openOwnerDialog = () => {
    setOwnerId(query.data?.owner?.id ?? '');
    setOwnerError('');
    setOwnerDialogOpen(true);
  };

  const closeOwnerDialog = () => {
    if (ownerMutation.isPending) return;
    setOwnerDialogOpen(false);
    setOwnerError('');
  };

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading asset…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const asset = query.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/inventory">Asset Inventory</Link><span>›</span><span>{asset.assetTag}</span>
      </div>

      <INNOResourceHeader
        icon={<INNOIcon token="nav.assets" size={20} />}
        title={asset.assetTag}
        status={<INNOStatus tone={asset.status === 'in_use' ? 'success' : asset.status === 'repair' ? 'warning' : 'neutral'}>{statusLabel(asset.status)}</INNOStatus>}
        meta={<><span>{asset.name}</span><span>·</span><span>{[asset.brand, asset.model].filter(Boolean).join(' ') || asset.category}</span><span>·</span><span>{asset.serialNumber ?? 'No serial'}</span></>}
        actions={
          <>
            {asset.linkedDevice ? <Link className="inno-link-button secondary" to={'/devices/' + asset.linkedDevice.id}>Open Device</Link> : null}
            {canManage ? <Link className="inno-link-button secondary" to={'/assets/' + asset.id + '/edit'}>Edit Asset</Link> : null}
          </>
        }
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Purchase price" value={money(asset.purchasePrice)} detail={'Registered ' + new Date(asset.registeredAt).toLocaleDateString()} />
        <INNOResourceSummaryItem label="Owner" value={asset.owner?.name ?? 'Unassigned'} detail={asset.organization?.name ?? 'No organization'} />
        <INNOResourceSummaryItem label="Warranty" value={asset.warrantyEndAt ? new Date(asset.warrantyEndAt).toLocaleDateString() : '—'} detail={asset.warrantyEndAt && new Date(asset.warrantyEndAt) > new Date() ? 'Active' : 'No active warranty'} />
        <INNOResourceSummaryItem label="Source" value={asset.source.replaceAll('_', ' ')} detail={'Updated ' + new Date(asset.updatedAt).toLocaleString()} />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel="Asset detail sections"
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'custom' | 'ownership')}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'custom', label: 'Custom Fields' },
          { id: 'ownership', label: 'Ownership' },
        ]}
      />

      <div hidden={activeTab !== 'overview'}>
        <div className="device-overview-grid">
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Asset information</h3><p>Canonical inventory record owned by Assets.</p></div></div>
            <div className="kv-grid production-kv-grid">
              <div className="kv-row"><span>Asset name</span><b>{asset.name}</b></div>
              <div className="kv-row"><span>Category</span><b>{asset.category}</b></div>
              <div className="kv-row"><span>Status</span><b>{statusLabel(asset.status)}</b></div>
              <div className="kv-row"><span>Serial</span><b>{asset.serialNumber ?? '—'}</b></div>
            </div>
          </section>

          <div className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>Current owner</h3><p>Ownership is a business relationship, not an identity record.</p></div>
                {canManage ? <INNOButton variant="secondary" onClick={openOwnerDialog}>Change Owner</INNOButton> : null}
              </div>
              <div className="settings-stack">
                <div className="settings-row">
                  <div><b>{asset.owner?.name ?? 'Unassigned'}</b><span>{asset.organization?.name ?? 'No organization'}</span></div>
                </div>
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head"><div><h3>Linked managed endpoint</h3><p>Read through the Devices directory contract.</p></div></div>
              {asset.linkedDevice ? (
                <div className="settings-stack">
                  <div className="settings-row">
                    <div><b>{asset.linkedDevice.name}</b><span>{asset.linkedDevice.operatingSystem ?? 'Unknown OS'}</span></div>
                    <INNOStatus tone={asset.linkedDevice.status === 'online' ? 'success' : 'neutral'} dot>{asset.linkedDevice.status}</INNOStatus>
                  </div>
                </div>
              ) : <div className="compact-empty">No managed endpoint linked.</div>}
            </section>
          </div>
        </div>
      </div>

      <div hidden={activeTab !== 'custom'}>
        <section className="prod-panel asset-custom-values-panel">
          <div className="prod-panel-head">
            <div><h3>Custom fields</h3><p>Organization-defined Asset attributes. Schema is managed separately.</p></div>
            <Link className="open-resource" to="/assets/custom-fields">Manage schema</Link>
          </div>
          {asset.customFields.length === 0 ? (
            <div className="compact-empty">No active custom fields are configured.</div>
          ) : (
            <div className="kv-grid production-kv-grid">
              {asset.customFields.map((field) => (
                <div className="kv-row" key={field.fieldKey}>
                  <span>{field.label}</span>
                  <b>{customValueLabel(field.value, field.fieldType)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div hidden={activeTab !== 'ownership'}>
        <INNOCollection>
          <INNOCollectionHeader title="Ownership history" description="Immutable ownership changes for this asset." />
          {asset.ownershipHistory.length === 0 ? (
            <div className="collection-state"><INNOState kind="empty" title="No ownership history" description="Ownership changes will appear here after the first assignment." /></div>
          ) : (
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>Effective</th><th>Previous owner</th><th>Owner</th><th>Reason</th></tr></thead>
                <tbody>
                  {asset.ownershipHistory.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.effectiveAt).toLocaleString()}</td>
                      <td>{item.previousOwner ?? 'Unassigned'}</td>
                      <td>{item.owner ?? 'Unassigned'}</td>
                      <td>{item.reasonCode.replaceAll('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
          )}
        </INNOCollection>
      </div>

      <INNODialog
        open={ownerDialogOpen}
        title="Change Asset Owner"
        description="Assign this Asset to a person in the current ownership directory."
        onClose={closeOwnerDialog}
        size="sm"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={ownerMutation.isPending} onClick={closeOwnerDialog}>Cancel</INNOButton>
          <INNOButton
            type="button"
            busy={ownerMutation.isPending}
            disabled={ownerId === (asset.owner?.id ?? '')}
            onClick={() => ownerMutation.mutate()}
          >
            Change Owner
          </INNOButton>
        </>}
      >
        <div className="editor-form">
          <label className="field-block">
            <span>Assigned user</span>
            <select data-autofocus value={ownerId} disabled={owners.isPending} onChange={(event) => setOwnerId(event.target.value)}>
              <option value="">Unassigned</option>
              {owners.data?.items.map((owner) => <option key={owner.id} value={owner.id}>{owner.fullName} · {owner.employeeId}</option>)}
            </select>
          </label>
          {owners.isError ? <ErrorState error={owners.error} retry={() => void owners.refetch()} /> : null}
          {ownerError ? <div className="form-error" role="alert">{ownerError}</div> : null}
        </div>
      </INNODialog>
    </main>
  );
}
