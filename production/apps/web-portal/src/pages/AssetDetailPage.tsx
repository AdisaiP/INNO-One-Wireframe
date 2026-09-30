import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterNote, INNOEditorFooterStart, INNOIcon, INNOResourceHeader, INNOResourceSummary, INNOResourceSummaryItem, INNOState, INNOStatus, INNOSurfaceTabs, INNOTableWrap } from '@inno/ui';
import { changeAssetOwnership, getAsset, getAssetOwners, updateAsset } from '../api/client';
import type { AssetCustomFieldValue } from '../api/types';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function money(value?: number | null) {
  return value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value);
}
function statusLabel(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }

function customValueLabel(field: AssetCustomFieldValue) {
  if (field.value == null || field.value === '') return '—';
  if (field.fieldType === 'boolean') return field.value ? 'Yes' : 'No';
  return String(field.value);
}

function CustomFieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: AssetCustomFieldValue;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  const label = field.label + (field.isRequired ? ' *' : '');

  if (field.fieldType === 'boolean') {
    return (
      <div className="field-block">
        <span>{label}</span>
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{Boolean(value) ? 'Yes' : 'No'}</span>
        </label>
        {error ? <span className="field-error" role="alert">{error}</span> : null}
      </div>
    );
  }

  if (field.fieldType === 'select') {
    return (
      <label className="field-block">
        <span>{label}</span>
        <select
          value={typeof value === 'string' ? value : ''}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select…</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {error ? <span className="field-error" role="alert">{error}</span> : null}
      </label>
    );
  }

  return (
    <label className="field-block">
      <span>{label}</span>
      <input
        type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
        value={value == null ? '' : String(value)}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </label>
  );
}

export function AssetDetailPage() {
  const { assetId = '' } = useParams();
  const canManage = usePermission('assets.manage');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['assets', 'detail', assetId], queryFn: () => getAsset(assetId), enabled: Boolean(assetId) });
  const owners = useQuery({ queryKey: ['assets', 'owners', 'picker'], queryFn: () => getAssetOwners({ pageSize: 100 }), enabled: canManage });
  const [activeTab, setActiveTab] = useState<'overview' | 'custom' | 'ownership'>('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', lifecycleStatus: '', purchasePrice: '' });
  const [ownerId, setOwnerId] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setForm({
      name: query.data.name,
      category: query.data.category,
      lifecycleStatus: query.data.status,
      purchasePrice: query.data.purchasePrice?.toString() ?? '',
    });
    setOwnerId(query.data.owner?.id ?? '');
    setCustomValues(Object.fromEntries(
      query.data.customFields.map((field) => [
        field.fieldKey,
        field.value ?? (field.fieldType === 'boolean' ? false : ''),
      ]),
    ));
    setCustomErrors({});
  }, [query.data]);

  const customPayload = () => Object.fromEntries(
    (query.data?.customFields ?? []).map((field) => {
      const value = customValues[field.fieldKey];
      if (field.fieldType === 'number') {
        return [field.fieldKey, value === '' || value == null ? null : Number(value)];
      }
      if (field.fieldType === 'boolean') {
        return [field.fieldKey, Boolean(value)];
      }
      return [field.fieldKey, value === '' ? null : value];
    }),
  );

  const saveMutation = useMutation({
    mutationFn: () => updateAsset(assetId, query.data?.eTag ?? '', {
      name: form.name,
      category: form.category,
      lifecycleStatus: form.lifecycleStatus,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
      customFields: customPayload(),
    }),
    onSuccess: async () => {
      setEditing(false);
      setSaveError('');
      setCustomErrors({});
      setSavedMessage('Asset saved.');
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      window.setTimeout(() => setSavedMessage(''), 2500);
    },
    onError: (error: Error) => {
      setSavedMessage('');
      setSaveError(error.message);
    },
  });

  function saveAsset() {
    const errors: Record<string, string> = {};
    for (const field of query.data?.customFields ?? []) {
      const value = customValues[field.fieldKey];
      const empty = value == null || value === '';
      if (field.isRequired && empty) {
        errors[field.fieldKey] = 'This field is required.';
      }
      if (field.fieldType === 'number' && !empty && Number.isNaN(Number(value))) {
        errors[field.fieldKey] = 'Enter a valid number.';
      }
    }
    setCustomErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError('Review the highlighted custom fields before saving.');
      return;
    }
    setSaveError('');
    saveMutation.mutate();
  }

  const ownerMutation = useMutation({
    mutationFn: () => changeAssetOwnership(assetId, query.data?.eTag ?? '', {
      ownerUserId: ownerId || undefined,
      reasonCode: 'manual_assignment',
    }),
    onSuccess: async () => { setSaveError(''); await queryClient.invalidateQueries({ queryKey: ['assets'] }); },
    onError: (error: Error) => setSaveError(error.message),
  });

  function cancelEditing() {
    if (query.data) {
      setForm({
        name: query.data.name,
        category: query.data.category,
        lifecycleStatus: query.data.status,
        purchasePrice: query.data.purchasePrice?.toString() ?? '',
      });
      setOwnerId(query.data.owner?.id ?? '');
      setCustomValues(Object.fromEntries(
        query.data.customFields.map((field) => [
          field.fieldKey,
          field.value ?? (field.fieldType === 'boolean' ? false : ''),
        ]),
      ));
    }
    setCustomErrors({});
    setSaveError('');
    setEditing(false);
  }

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading asset…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const asset = query.data;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb"><Link to="/assets/inventory">Asset Inventory</Link><span>›</span><span>{asset.assetTag}</span></div>
      <INNOResourceHeader
        icon={<INNOIcon token="nav.assets" size={20} />}
        title={asset.assetTag}
        status={<INNOStatus tone={asset.status === 'in_use' ? 'success' : asset.status === 'repair' ? 'warning' : 'neutral'}>{statusLabel(asset.status)}</INNOStatus>}
        meta={<><span>{asset.name}</span><span>·</span><span>{[asset.brand, asset.model].filter(Boolean).join(' ') || asset.category}</span><span>·</span><span>{asset.serialNumber ?? 'No serial'}</span></>}
        actions={(asset.linkedDevice || (canManage && !editing)) ? (
          <>
            {asset.linkedDevice ? <Link className="inno-link-button secondary" to={'/devices/' + asset.linkedDevice.id}>Open Device</Link> : null}
            {canManage && !editing ? <INNOButton variant="secondary" onClick={() => { setActiveTab('overview'); setEditing(true); }}>Edit Asset</INNOButton> : null}
          </>
        ) : undefined}
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
          ...(!editing ? [{ id: 'ownership', label: 'Ownership' }] : []),
        ]}
      />

      {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
      {savedMessage ? <div className="form-success" role="status">{savedMessage}</div> : null}
      <div hidden={activeTab !== 'overview'}>
        <div className="device-overview-grid">
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Asset information</h3><p>Canonical inventory record owned by Assets.</p></div></div>
          {canManage && editing ? (
            <div className="editor-form">
              <div className="editor-grid">
                <label className="field-block field-wide"><span>Asset name</span><input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></label>
                <label className="field-block"><span>Category</span><select value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}><option>Computer</option><option>Notebook</option><option>Monitor</option><option>Printer</option><option>Other</option></select></label>
                <label className="field-block"><span>Status</span><select value={form.lifecycleStatus} onChange={(e) => setForm((v) => ({ ...v, lifecycleStatus: e.target.value }))}><option value="in_use">In use</option><option value="stock">Stock</option><option value="repair">Repair</option><option value="retired">Retired</option></select></label>
                <label className="field-block"><span>Purchase price · THB</span><input type="number" min="0" value={form.purchasePrice} onChange={(e) => setForm((v) => ({ ...v, purchasePrice: e.target.value }))} /></label>
              </div>
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
            {canManage && editing ? <div className="settings-stack">
              <label className="field-block"><span>Assigned user</span><select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="">Unassigned</option>{owners.data?.items.map((owner) => <option key={owner.id} value={owner.id}>{owner.fullName} · {owner.employeeId}</option>)}</select></label>
              <INNOButton variant="secondary" busy={ownerMutation.isPending} disabled={ownerId === (asset.owner?.id ?? '')} onClick={() => ownerMutation.mutate()}>Change owner</INNOButton>
            </div> : <div className="settings-row"><div><b>{asset.owner?.name ?? 'Unassigned'}</b><span>{asset.organization?.name ?? 'No organization'}</span></div></div>}
          </section>
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Linked managed endpoint</h3><p>Read through the Devices directory contract.</p></div></div>
            {asset.linkedDevice ? <div className="settings-row"><div><b>{asset.linkedDevice.name}</b><span>{asset.linkedDevice.operatingSystem ?? 'Unknown OS'}</span></div><INNOStatus tone={asset.linkedDevice.status === 'online' ? 'success' : 'neutral'} dot>{asset.linkedDevice.status}</INNOStatus></div> : <div className="compact-empty">No managed endpoint linked.</div>}
          </section>
        </div>
      </div>
      </div>

      <div hidden={activeTab !== 'custom'}>
      <section className="prod-panel asset-custom-values-panel">
        <div className="prod-panel-head">
          <div>
            <h3>Custom fields</h3>
            <p>Organization-defined Asset attributes. Schema is managed separately.</p>
          </div>
          <Link className="open-resource" to="/assets/custom-fields">Manage schema</Link>
        </div>

        {asset.customFields.length === 0 ? (
          <div className="compact-empty">No active custom fields are configured.</div>
        ) : canManage && editing ? (
          <div className="editor-form">
            <div className="editor-grid">
              {asset.customFields.map((field) => (
                <CustomFieldInput
                  key={field.fieldKey}
                  field={field}
                  value={customValues[field.fieldKey]}
                  error={customErrors[field.fieldKey]}
                  onChange={(value) => {
                    setSavedMessage('');
                    setCustomErrors((current) => {
                      const next = { ...current };
                      delete next[field.fieldKey];
                      return next;
                    });
                    setCustomValues((current) => ({ ...current, [field.fieldKey]: value }));
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="kv-grid production-kv-grid">
            {asset.customFields.map((field) => (
              <div className="kv-row" key={field.fieldKey}>
                <span>{field.label}</span>
                <b>{customValueLabel(field)}</b>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>

      {canManage && editing && activeTab !== 'ownership' ? (
        <INNOEditorFooter>
          <INNOEditorFooterStart>
            <INNOButton variant="secondary" disabled={saveMutation.isPending} onClick={cancelEditing}>Cancel</INNOButton>
            <INNOEditorFooterNote>Asset and custom-field changes are audited and version checked.</INNOEditorFooterNote>
          </INNOEditorFooterStart>
          <INNOEditorFooterEnd>
            <INNOButton busy={saveMutation.isPending} disabled={!form.name.trim()} onClick={saveAsset}>Save Asset</INNOButton>
          </INNOEditorFooterEnd>
        </INNOEditorFooter>
      ) : null}

      <div hidden={activeTab !== 'ownership'}>
      <INNOCollection>
        <INNOCollectionHeader title="Ownership history" description="Immutable ownership changes for this asset." />
        {asset.ownershipHistory.length === 0 ? (
          <div className="collection-state"><INNOState kind="empty" title="No ownership history" description="Ownership changes will appear here after the first assignment." /></div>
        ) : (
          <INNOTableWrap width="wide"><table><thead><tr><th>Effective</th><th>Previous owner</th><th>Owner</th><th>Reason</th></tr></thead><tbody>{asset.ownershipHistory.map((item) => <tr key={item.id}><td>{new Date(item.effectiveAt).toLocaleString()}</td><td>{item.previousOwner ?? 'Unassigned'}</td><td>{item.owner ?? 'Unassigned'}</td><td>{item.reasonCode.replaceAll('_', ' ')}</td></tr>)}</tbody></table></INNOTableWrap>
        )}
      </INNOCollection>
      </div>
    </main>
  );
}
