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
import { useI18n as useStep45NI18n } from '@inno/i18n';

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
  const { t: t45n } = useStep45NI18n();
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

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('assets.step45n.assetDetail.loadingAsset')} /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const asset = query.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/inventory">{t45n('navigation.assetInventory')}</Link><span>›</span><span>{asset.assetTag}</span>
      </div>

      <INNOResourceHeader
        icon={<INNOIcon token="nav.assets" size={20} />}
        title={asset.assetTag}
        status={<INNOStatus tone={asset.status === 'in_use' ? 'success' : asset.status === 'repair' ? 'warning' : 'neutral'}>{statusLabel(asset.status)}</INNOStatus>}
        meta={<><span>{asset.name}</span><span>·</span><span>{[asset.brand, asset.model].filter(Boolean).join(' ') || asset.category}</span><span>·</span><span>{asset.serialNumber ?? t45n('assets.step45n.assetDetail.noSerial')}</span></>}
        actions={
          <>
            {asset.linkedDevice ? <Link className="inno-link-button secondary" to={'/devices/' + asset.linkedDevice.id}>{t45n('assets.step45n.assetDetail.openDevice')}</Link> : null}
            {canManage ? <Link className="inno-link-button secondary" to={'/assets/' + asset.id + '/edit'}>{t45n('assets.step45n.assetDetail.editAsset')}</Link> : null}
          </>
        }
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('assets.step45n.assetDetail.purchasePrice')} value={money(asset.purchasePrice)} detail={'Registered ' + new Date(asset.registeredAt).toLocaleDateString()} />
        <INNOResourceSummaryItem label={t45n('reports.column.owner')} value={asset.owner?.name ?? 'Unassigned'} detail={asset.organization?.name ?? 'No organization'} />
        <INNOResourceSummaryItem label={t45n('assets.step45n.assetDetail.warranty')} value={asset.warrantyEndAt ? new Date(asset.warrantyEndAt).toLocaleDateString() : '—'} detail={asset.warrantyEndAt && new Date(asset.warrantyEndAt) > new Date() ? 'Active' : 'No active warranty'} />
        <INNOResourceSummaryItem label={t45n('reports.table.source')} value={asset.source.replaceAll('_', ' ')} detail={'Updated ' + new Date(asset.updatedAt).toLocaleString()} />
      </INNOResourceSummary>

      <INNOSurfaceTabs
        ariaLabel={t45n('assets.step45n.assetDetail.assetDetailSections')}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'overview' | 'custom' | 'ownership')}
        items={[
          { id: 'overview', label: t45n('navigation.overview') },
          { id: 'custom', label: t45n('navigation.customFields') },
          { id: 'ownership', label: t45n('navigation.ownership') },
        ]}
      />

      <div hidden={activeTab !== 'overview'}>
        <div className="device-overview-grid">
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>{t45n('assets.step45n.assetDetail.assetInformation')}</h3><p>{t45n('assets.step45n.assetDetail.canonicalInventoryRecordOwnedByAssets')}</p></div></div>
            <div className="kv-grid production-kv-grid">
              <div className="kv-row"><span>{t45n('assets.step45n.assetDetail.assetName')}</span><b>{asset.name}</b></div>
              <div className="kv-row"><span>{t45n('reports.column.category')}</span><b>{asset.category}</b></div>
              <div className="kv-row"><span>{t45n('reports.runs.status')}</span><b>{statusLabel(asset.status)}</b></div>
              <div className="kv-row"><span>{t45n('assets.step45n.assetDetail.serial')}</span><b>{asset.serialNumber ?? '—'}</b></div>
            </div>
          </section>

          <div className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>{t45n('assets.step45n.assetDetail.currentOwner')}</h3><p>{t45n('assets.step45n.assetDetail.ownershipIsABusinessRelationshipNotAnIdentity')}</p></div>
                {canManage ? <INNOButton variant="secondary" onClick={openOwnerDialog}>{t45n('assets.step45n.assetDetail.changeOwner')}</INNOButton> : null}
              </div>
              <div className="settings-stack">
                <div className="settings-row">
                  <div><b>{asset.owner?.name ?? t45n('assets.automation.editor.owner.unassigned')}</b><span>{asset.organization?.name ?? t45n('assets.step45n.assetDetail.noOrganization')}</span></div>
                </div>
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head"><div><h3>{t45n('assets.step45n.assetDetail.linkedManagedEndpoint')}</h3><p>{t45n('assets.step45n.assetDetail.readThroughTheDevicesDirectoryContract')}</p></div></div>
              {asset.linkedDevice ? (
                <div className="settings-stack">
                  <div className="settings-row">
                    <div><b>{asset.linkedDevice.name}</b><span>{asset.linkedDevice.operatingSystem ?? t45n('assets.step45n.assetDetail.unknownOs')}</span></div>
                    <INNOStatus tone={asset.linkedDevice.status === 'online' ? 'success' : 'neutral'} dot>{asset.linkedDevice.status}</INNOStatus>
                  </div>
                </div>
              ) : <div className="compact-empty">{t45n('assets.step45n.assetDetail.noManagedEndpointLinked')}</div>}
            </section>
          </div>
        </div>
      </div>

      <div hidden={activeTab !== 'custom'}>
        <section className="prod-panel asset-custom-values-panel">
          <div className="prod-panel-head">
            <div><h3>{t45n('assets.step45n.assetDetail.customFields')}</h3><p>{t45n('assets.step45n.assetDetail.organizationDefinedAssetAttributesSchemaIsManagedSeparately')}</p></div>
            <Link className="open-resource" to="/assets/custom-fields">{t45n('assets.step45n.assetDetail.manageSchema')}</Link>
          </div>
          {asset.customFields.length === 0 ? (
            <div className="compact-empty">{t45n('assets.step45n.assetDetail.noActiveCustomFieldsAreConfigured')}</div>
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
          <INNOCollectionHeader title={t45n('assets.step45n.assetDetail.ownershipHistory')} description={t45n('assets.step45n.assetDetail.immutableOwnershipChangesForThisAsset')} />
          {asset.ownershipHistory.length === 0 ? (
            <div className="collection-state"><INNOState kind="empty" title={t45n('assets.step45n.assetDetail.noOwnershipHistory')} description={t45n('assets.step45n.assetDetail.ownershipChangesWillAppearHereAfterTheFirst')} /></div>
          ) : (
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>{t45n('common.status.effective')}</th><th>{t45n('assets.step45n.assetDetail.previousOwner')}</th><th>{t45n('reports.column.owner')}</th><th>{t45n('assets.step45n.assetDetail.reason')}</th></tr></thead>
                <tbody>
                  {asset.ownershipHistory.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.effectiveAt).toLocaleString()}</td>
                      <td>{item.previousOwner ?? t45n('assets.automation.editor.owner.unassigned')}</td>
                      <td>{item.owner ?? t45n('assets.automation.editor.owner.unassigned')}</td>
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
        title={t45n('assets.step45n.assetDetail.changeAssetOwner')}
        description={t45n('assets.step45n.assetDetail.assignThisAssetToAPersonInThe')}
        onClose={closeOwnerDialog}
        size="sm"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={ownerMutation.isPending} onClick={closeOwnerDialog}>{t45n('reports.action.cancel')}</INNOButton>
          <INNOButton
            type="button"
            busy={ownerMutation.isPending}
            disabled={ownerId === (asset.owner?.id ?? '')}
            onClick={() => ownerMutation.mutate()}
          >
            {t45n('assets.step45n.assetDetail.changeOwner')}</INNOButton>
        </>}
      >
        <div className="editor-form">
          <label className="field-block">
            <span>{t45n('assets.step45n.assetDetail.assignedUser')}</span>
            <select data-autofocus value={ownerId} disabled={owners.isPending} onChange={(event) => setOwnerId(event.target.value)}>
              <option value="">{t45n('assets.automation.editor.owner.unassigned')}</option>
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
