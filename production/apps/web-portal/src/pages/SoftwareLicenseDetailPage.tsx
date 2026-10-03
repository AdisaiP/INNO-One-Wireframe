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
      if (!query.data) throw new Error('License not loaded.');
      const entitledSeats = Number(form.entitledSeats);
      const unitPrice = form.unitPrice === '' ? null : Number(form.unitPrice);
      if (!Number.isInteger(entitledSeats) || entitledSeats < 0) {
        throw new Error('Purchased seats must be a whole number of 0 or more.');
      }
      if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
        throw new Error('Unit price must be 0 or more.');
      }
      if (!form.licenseModel.trim()) throw new Error('License model is required.');
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

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading software license…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  if (!query.data) return <main className="inno-page"><INNOState kind="error" title="Software license not found" /></main>;

  const license = query.data;
  const overused = license.compliance === 'overused';

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/software-licenses">Software Licenses</Link><span>›</span><span>{license.productName}</span>
      </div>

      <INNOResourceHeader
        title={license.productName}
        status={<INNOStatus tone={overused ? 'danger' : 'success'}>{statusLabel(license.compliance)}</INNOStatus>}
        meta={<><span>{license.vendor}</span><span>·</span><span>{license.licenseModel}</span></>}
        actions={canManage ? <INNOButton variant="secondary" onClick={openEdit}>Edit Entitlement</INNOButton> : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Purchased seats" value={license.entitledSeats} detail="Current entitlement" />
        <INNOResourceSummaryItem label="Used seats" value={license.usedSeats} detail="Detected allocation" />
        <INNOResourceSummaryItem
          label={overused ? 'Overage' : 'Available'}
          value={Math.abs(license.seatBalance)}
          detail={overused ? money(license.estimatedGapCost, license.currency) + ' estimated gap' : 'Seats remaining'}
        />
        <INNOResourceSummaryItem label="Renewal" value={displayDate(license.renewalAt)} detail={license.contractReference ?? 'No contract reference'} />
      </INNOResourceSummary>

      <INNOCollection className="license-entitlement-section">
        <INNOCollectionHeader
          title="Entitlement & Renewal"
          description="Purchased rights and commercial renewal metadata for this software product."
          meta={<INNOStatus>{license.entitledSeats} seats</INNOStatus>}
        />
        <div className="license-entitlement-grid">
          <div><span>Vendor</span><b>{license.vendor}</b></div>
          <div><span>License model</span><b>{license.licenseModel}</b></div>
          <div><span>Purchased seats</span><b>{license.entitledSeats}</b></div>
          <div><span>Unit price</span><b>{money(license.unitPrice, license.currency)}</b></div>
          <div><span>Renewal date</span><b>{displayDate(license.renewalAt)}</b></div>
          <div><span>Contract reference</span><b>{license.contractReference ?? '—'}</b></div>
          <div><span>Last updated</span><b>{new Date(license.updatedAt).toLocaleString()}</b></div>
          <div><span>Compliance</span><b>{statusLabel(license.compliance)}</b></div>
        </div>
      </INNOCollection>

      <INNOCollection>
        <INNOCollectionHeader
          title="Detected allocations"
          description="Endpoint and user records contributing to current seat usage."
          meta={<INNOStatus>{license.allocations.length} records</INNOStatus>}
        />
        {license.allocations.length ? (
          <INNOTableWrap width="wide">
            <table className="supporting-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>User / Source</th>
                  <th className="numeric-column">Seats</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th className="action-column">Asset</th>
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
                      ? <RouterRowAction to={'/assets/' + allocation.assetId} ariaLabel={'Open asset for ' + allocation.endpointName} />
                      : <span className="table-meta">Aggregate</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <div className="collection-state">
            <INNOState kind="empty" title="No detected allocations" description="No endpoint or aggregate usage is recorded for this license." />
          </div>
        )}
      </INNOCollection>

      <INNODialog
        open={editOpen}
        title="Edit Entitlement & Renewal"
        description="Update purchased rights and renewal metadata. Detected allocations are read-only."
        onClose={() => { if (!save.isPending) setEditOpen(false); }}
        size="md"
        footer={<>
          <INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => setEditOpen(false)}>Cancel</INNOButton>
          <INNOButton type="submit" form="license-entitlement-form" busy={save.isPending}>Save Entitlement</INNOButton>
        </>}
      >
        <form
          id="license-entitlement-form"
          className="editor-form"
          onSubmit={(event) => { event.preventDefault(); if (!save.isPending) save.mutate(); }}
        >
          <div className="editor-grid">
            <label className="field-block field-wide"><span>License model</span><input data-autofocus required value={form.licenseModel} onChange={(event) => setForm({ ...form, licenseModel: event.target.value })} /></label>
            <label className="field-block"><span>Purchased seats</span><input type="number" min="0" step="1" required value={form.entitledSeats} onChange={(event) => setForm({ ...form, entitledSeats: event.target.value })} /></label>
            <label className="field-block"><span>Unit price · {license.currency} / year</span><input type="number" min="0" step="1" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></label>
            <label className="field-block"><span>Renewal date</span><input type="date" value={form.renewalAt} onChange={(event) => setForm({ ...form, renewalAt: event.target.value })} /></label>
            <label className="field-block"><span>Contract reference</span><input value={form.contractReference} onChange={(event) => setForm({ ...form, contractReference: event.target.value })} /></label>
          </div>
          {formError ? <div className="form-error" role="alert">{formError}</div> : null}
          {save.isError && !formError ? <ErrorState error={save.error} /> : null}
        </form>
      </INNODialog>
    </main>
  );
}
