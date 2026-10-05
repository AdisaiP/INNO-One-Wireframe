import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNODialog, INNOResourceHeader,
  INNOResourceSummary, INNOResourceSummaryItem, INNOState, INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { getSoftwareLicense, updateSoftwareLicense } from '../api/client';
import type { SoftwareLicenseItem } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function money(value: number | null | undefined, currency = 'THB') {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function displayDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function editForm(license: SoftwareLicenseItem) {
  return {
    licenseModel: license.licenseModel,
    entitledSeats: String(license.entitledSeats),
    unitPrice: license.unitPrice == null ? '' : String(license.unitPrice),
    renewalAt: dateInput(license.renewalAt),
    contractReference: license.contractReference ?? '',
  };
}

export function SoftwareLicenseDetailPage() {
  const { t: t45n } = useStep45NI18n();
  const { licenseId = '' } = useParams();
  const canManage = usePermission('assets.license.manage');
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    licenseModel: '',
    entitledSeats: '',
    unitPrice: '',
    renewalAt: '',
    contractReference: '',
  });
  const [formError, setFormError] = useState('');

  const query = useQuery({
    queryKey: ['assets', 'software-license', licenseId],
    queryFn: () => getSoftwareLicense(licenseId),
    enabled: !!licenseId,
  });

  const save = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error(t45n('devices.step45n.softwareLicenseDetail.licenseNotLoaded'));
      const entitledSeats = Number(form.entitledSeats);
      const unitPrice = form.unitPrice === '' ? null : Number(form.unitPrice);
      if (!Number.isInteger(entitledSeats) || entitledSeats < 0) {
        throw new Error(t45n('devices.step45n.softwareLicenseDetail.purchasedSeatsMustBeAWholeNumberOf'));
      }
      if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
        throw new Error(t45n('devices.step45n.softwareLicenseDetail.unitPriceMustBe0OrMore'));
      }
      if (!form.licenseModel.trim()) throw new Error(t45n('devices.step45n.softwareLicenseDetail.licenseModelIsRequired'));
      return updateSoftwareLicense(query.data.id, query.data.eTag, {
        licenseModel: form.licenseModel.trim(),
        entitledSeats,
        unitPrice,
        renewalAt: form.renewalAt ? new Date(form.renewalAt + 'T00:00:00Z').toISOString() : null,
        contractReference: form.contractReference.trim() || null,
      });
    },
    onSuccess: async (updated) => {
      setEditOpen(false);
      setFormError('');
      queryClient.setQueryData(['assets', 'software-license', licenseId], updated);
      await queryClient.invalidateQueries({ queryKey: ['assets', 'software-licenses'] });
    },
    onError: (error: Error) => setFormError(error.message),
  });

  function openEdit() {
    if (!query.data) return;
    setForm(editForm(query.data));
    setFormError('');
    setEditOpen(true);
  }

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('devices.step45n.softwareLicenseDetail.loadingSoftwareLicense')} /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  if (!query.data) return <main className="inno-page"><INNOState kind="error" title={t45n('devices.step45n.softwareLicenseDetail.softwareLicenseNotFound')} /></main>;

  const license = query.data;
  const overused = license.compliance === 'overused';

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/software-licenses">{t45n('navigation.softwareLicenses')}</Link><span>›</span><span>{license.productName}</span>
      </div>

      <INNOResourceHeader
        title={license.productName}
        status={<INNOStatus tone={overused ? 'danger' : 'success'}>{statusLabel(license.compliance)}</INNOStatus>}
        meta={<><span>{license.vendor}</span><span>·</span><span>{license.licenseModel}</span></>}
        actions={canManage ? <INNOButton variant="secondary" onClick={openEdit}>{t45n('devices.step45n.softwareLicenseDetail.editEntitlement')}</INNOButton> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('devices.step45n.softwareLicenseDetail.purchasedSeats')} value={license.entitledSeats} detail="Current entitlement" />
        <INNOResourceSummaryItem label={t45n('devices.step45n.softwareLicenseDetail.usedSeats')} value={license.usedSeats} detail="Detected allocation" />
        <INNOResourceSummaryItem
          label={overused ? t45n('devices.step45n.softwareLicenseDetail.overage') : t45n('admin.step45n.adminApps.available')}
          value={Math.abs(license.seatBalance)}
          detail={overused ? money(license.estimatedGapCost, license.currency) + ' estimated gap' : 'Seats remaining'}
        />
        <INNOResourceSummaryItem label={t45n('devices.step45n.softwareLicenseDetail.renewal')} value={displayDate(license.renewalAt)} detail={license.contractReference ?? 'No contract reference'} />
      </INNOResourceSummary>

      <INNOCollection className="license-entitlement-section">
        <INNOCollectionHeader
          title={t45n('devices.step45n.softwareLicenseDetail.entitlementRenewal')}
          description={t45n('devices.step45n.softwareLicenseDetail.purchasedRightsAndCommercialRenewalMetadataForThis')}
          meta={<INNOStatus>{license.entitledSeats} {t45n('devices.step45n.softwareLicenseDetail.seats2')}</INNOStatus>}
        />
        <div className="license-entitlement-grid">
          <div><span>{t45n('assets.automation.editor.licenseField.vendor')}</span><b>{license.vendor}</b></div>
          <div><span>{t45n('assets.automation.editor.licenseField.licenseModel')}</span><b>{license.licenseModel}</b></div>
          <div><span>{t45n('devices.step45n.softwareLicenseDetail.purchasedSeats')}</span><b>{license.entitledSeats}</b></div>
          <div><span>{t45n('devices.step45n.softwareLicenseDetail.unitPrice')}</span><b>{money(license.unitPrice, license.currency)}</b></div>
          <div><span>{t45n('devices.step45n.softwareLicenseDetail.renewalDate')}</span><b>{displayDate(license.renewalAt)}</b></div>
          <div><span>{t45n('devices.step45n.softwareLicenseDetail.contractReference')}</span><b>{license.contractReference ?? '—'}</b></div>
          <div><span>{t45n('devices.step45n.softwareLicenseDetail.lastUpdated')}</span><b>{new Date(license.updatedAt).toLocaleString()}</b></div>
          <div><span>{t45n('assets.automation.editor.licenseField.compliance')}</span><b>{statusLabel(license.compliance)}</b></div>
        </div>
      </INNOCollection>

      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('devices.step45n.softwareLicenseDetail.detectedAllocations')}
          description={t45n('devices.step45n.softwareLicenseDetail.endpointAndUserRecordsContributingToCurrentSeat')}
          meta={<INNOStatus>{license.allocations.length} {t45n('admin.step45n.adminAudit.records')}</INNOStatus>}
        />
        {license.allocations.length ? (
          <INNOTableWrap width="wide">
            <table className="supporting-table">
              <thead>
                <tr>
                  <th>{t45n('admin.step45n.adminIntegrations.endpoint')}</th>
                  <th>{t45n('devices.step45n.softwareLicenseDetail.userSource')}</th>
                  <th className="numeric-column">{t45n('devices.step45n.softwareLicenseDetail.seats')}</th>
                  <th>{t45n('devices.step45n.softwareLicenseDetail.lastUsed')}</th>
                  <th>{t45n('reports.runs.status')}</th>
                  <th className="action-column">{t45n('reports.column.name')}</th>
                </tr>
              </thead>
              <tbody>{license.allocations.map((allocation) => (
                <tr key={allocation.id}>
                  <td><b>{allocation.endpointName}</b></td>
                  <td>{allocation.assignedTo ?? allocation.source.replaceAll('_', ' ')}</td>
                  <td className="numeric-column">{allocation.seatCount}</td>
                  <td>{allocation.lastUsedAt ? new Date(allocation.lastUsedAt).toLocaleString() : '—'}</td>
                  <td><INNOStatus>{allocation.status}</INNOStatus></td>
                  <td className="action-column">
                    {allocation.assetId
                      ? <RouterRowAction to={'/assets/' + allocation.assetId} ariaLabel={t45n('devices.step45n.softwareLicenseDetail.openAssetFor') + ' ' + allocation.endpointName} />
                      : <span className="table-meta">{t45n('devices.step45n.softwareLicenseDetail.aggregate')}</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <div className="collection-state">
            <INNOState kind="empty" title={t45n('devices.step45n.softwareLicenseDetail.noDetectedAllocations')} description={t45n('devices.step45n.softwareLicenseDetail.noEndpointOrAggregateUsageIsRecordedFor')} />
          </div>
        )}
      </INNOCollection>

      <INNODialog
        open={editOpen}
        title={t45n('devices.step45n.softwareLicenseDetail.editEntitlementRenewal')}
        description={t45n('devices.step45n.softwareLicenseDetail.updatePurchasedRightsAndRenewalMetadataDetectedAllocations')}
        onClose={() => { if (!save.isPending) setEditOpen(false); }}
        size="md"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => setEditOpen(false)}>{t45n('reports.action.cancel')}</INNOButton>
          <INNOButton type="submit" form="license-entitlement-form" busy={save.isPending}>{t45n('devices.step45n.softwareLicenseDetail.saveEntitlement')}</INNOButton>
        </>}
      >
        <form
          id="license-entitlement-form"
          className="editor-form"
          onSubmit={(event) => { event.preventDefault(); if (!save.isPending) save.mutate(); }}
        >
          <div className="editor-grid">
            <label className="field-block field-wide"><span>{t45n('assets.automation.editor.licenseField.licenseModel')}</span><input data-autofocus required value={form.licenseModel} onChange={(event) => setForm({ ...form, licenseModel: event.target.value })} /></label>
            <label className="field-block"><span>{t45n('devices.step45n.softwareLicenseDetail.purchasedSeats')}</span><input type="number" min="0" step="1" required value={form.entitledSeats} onChange={(event) => setForm({ ...form, entitledSeats: event.target.value })} /></label>
            <label className="field-block"><span>{t45n('devices.step45n.softwareLicenseDetail.unitPrice2')}{' '}{license.currency} {t45n('devices.step45n.softwareLicenseDetail.year')}</span><input type="number" min="0" step="1" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></label>
            <label className="field-block"><span>{t45n('devices.step45n.softwareLicenseDetail.renewalDate')}</span><input type="date" value={form.renewalAt} onChange={(event) => setForm({ ...form, renewalAt: event.target.value })} /></label>
            <label className="field-block"><span>{t45n('devices.step45n.softwareLicenseDetail.contractReference')}</span><input value={form.contractReference} onChange={(event) => setForm({ ...form, contractReference: event.target.value })} /></label>
          </div>
          {formError ? <div className="form-error" role="alert">{formError}</div> : null}
          {save.isError && !formError ? <ErrorState error={save.error} /> : null}
        </form>
      </INNODialog>
    </main>
  );
}
