import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOEditorFooter, INNOIcon, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarSpacer } from '@inno/ui';
import { getSoftwareLicenses, updateSoftwareLicense } from '../api/client';
import type { SoftwareLicenseItem } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';

function money(value: number, currency = 'THB') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function displayDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function utilization(item: SoftwareLicenseItem) {
  if (item.entitledSeats <= 0) return item.usedSeats > 0 ? 100 : 0;
  return Math.round((item.usedSeats / item.entitledSeats) * 100);
}

export function SoftwareLicensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [compliance, setCompliance] = useState('all');
  const [vendor, setVendor] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    entitledSeats: '',
    unitPrice: '',
    renewalAt: '',
    contractReference: '',
    licenseModel: '',
  });
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const pageSize = 25;

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, compliance, vendor]);

  const query = useQuery({
    queryKey: ['assets', 'software-licenses', page, deferredSearch, compliance, vendor],
    queryFn: () => getSoftwareLicenses({
      page,
      pageSize,
      search: deferredSearch,
      compliance,
      vendor,
    }),
  });

  useEffect(() => {
    if (!query.data?.items.length) {
      setSelectedId('');
      return;
    }
    if (!query.data.items.some((item) => item.id === selectedId)) {
      setSelectedId(query.data.items[0].id);
    }
  }, [query.data, selectedId]);

  const selected = useMemo(
    () => query.data?.items.find((item) => item.id === selectedId) ?? null,
    [query.data, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setForm({
      entitledSeats: String(selected.entitledSeats),
      unitPrice: selected.unitPrice == null ? '' : String(selected.unitPrice),
      renewalAt: dateInput(selected.renewalAt),
      contractReference: selected.contractReference ?? '',
      licenseModel: selected.licenseModel,
    });
    setSaveError('');
    setMessage('');
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a license record.');
      return updateSoftwareLicense(selected.id, selected.eTag, {
        entitledSeats: Number(form.entitledSeats),
        unitPrice: form.unitPrice === '' ? null : Number(form.unitPrice),
        renewalAt: form.renewalAt ? new Date(form.renewalAt + 'T00:00:00Z').toISOString() : null,
        contractReference: form.contractReference.trim() || null,
        licenseModel: form.licenseModel.trim(),
      });
    },
    onSuccess: async (updated) => {
      setSaveError('');
      setMessage('Software license saved.');
      setSelectedId(updated.id);
      await queryClient.invalidateQueries({ queryKey: ['assets', 'software-licenses'] });
      window.setTimeout(() => setMessage(''), 2500);
    },
    onError: (error: Error) => {
      setMessage('');
      setSaveError(error.message);
    },
  });

  function save() {
    const entitled = Number(form.entitledSeats);
    const price = form.unitPrice === '' ? null : Number(form.unitPrice);
    if (!Number.isInteger(entitled) || entitled < 0) {
      setSaveError('Purchased seats must be a whole number of 0 or more.');
      return;
    }
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      setSaveError('Unit price must be 0 or more.');
      return;
    }
    if (!form.licenseModel.trim()) {
      setSaveError('License model is required.');
      return;
    }
    setSaveError('');
    saveMutation.mutate();
  }
  const summary = query.data?.summary;

  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Software Licenses"
      description="Compare purchased entitlements with detected endpoint installations and recent usage."
    >

      <div className="production-stat-strip license-stat-strip">
        <div>
          <span>Products</span>
          <b>{summary?.products ?? '—'}</b>
          <small>Tracked license products</small>
        </div>
        <div>
          <span>Purchased seats</span>
          <b>{summary?.purchasedSeats ?? '—'}</b>
          <small>Current entitlements</small>
        </div>
        <div>
          <span>Installed</span>
          <b>{summary?.installedSeats ?? '—'}</b>
          <small>Endpoint inventory matches</small>
        </div>
        <div>
          <span>Estimated gap cost</span>
          <b>{summary ? money(summary.estimatedGapCost) : '—'}</b>
          <small>{summary ? summary.overusedProducts + ' overused products' : 'Compliance summary'}</small>
        </div>
      </div>

      {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
      {message ? <div className="form-success" role="status">{message}</div> : null}

      <INNOCollection className="license-collection">
        <INNOCollectionHeader
          title="License products"
          description="Purchased seats compared with the current detected footprint."
          meta={query.data ? <INNOStatus>{query.data.totalItems} products</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search software licenses" value={search} onChange={setSearch} placeholder="Search product, vendor, model or contract…" />
          <INNOSelectField label="Compliance filter" value={compliance} onChange={setCompliance}>
            <option value="all">Compliance: All</option>
            <option value="compliant">Compliant</option>
            <option value="overused">Overused</option>
          </INNOSelectField>
          <INNOSelectField label="Vendor filter" value={vendor} onChange={setVendor}>
            <option value="all">Vendor: All</option>
            {query.data?.vendors.map((value) => <option key={value} value={value}>{value}</option>)}
          </INNOSelectField>
          <INNOToolbarSpacer />
          <span className="collection-scope">License manager permission required</span>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading software licenses…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title="No license products found"
              description="Try another search or clear the filters."
              action={
                <INNOButton
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setCompliance('all');
                    setVendor('all');
                  }}
                >
                  Clear filters
                </INNOButton>
              }
            />
          </div>
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table className="license-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Vendor</th>
                    <th className="numeric-column">Purchased</th>
                    <th className="numeric-column">Installed</th>
                    <th>Utilization</th>
                    <th>Gap</th>
                    <th className="numeric-column">Estimated Cost</th>
                    <th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((item) => (
                    <tr key={item.id} className={item.id === selectedId ? 'selected-row' : undefined}>
                      <td><b>{item.productName}</b><div className="table-meta">{item.licenseModel}</div></td>
                      <td>{item.vendor}</td>
                      <td className="numeric-column">{item.entitledSeats}</td>
                      <td className="numeric-column">{item.usedSeats}</td>
                      <td>
                        <div className="license-utilization">
                          <span>{utilization(item)}%</span>
                          <div><i style={{ width: Math.min(utilization(item), 100) + '%' }} /></div>
                        </div>
                      </td>
                      <td>
                        <INNOStatus tone={item.compliance === 'overused' ? 'danger' : 'success'}>
                          {item.compliance === 'overused'
                            ? Math.abs(item.seatBalance) + ' over'
                            : item.seatBalance + ' available'}
                        </INNOStatus>
                      </td>
                      <td className="numeric-column">{money(item.estimatedGapCost, item.currency)}</td>
                      <td className="action-column">
                        <button type="button" className="device-row-action" aria-label={'Open ' + item.productName} onClick={() => setSelectedId(item.id)}>
                          <INNOIcon token="action.next" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalItems={query.data.totalItems}
              pageSize={query.data.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </INNOCollection>
      {selected ? (
        <section className="license-detail-grid">
          <INNOCollection className="license-allocations">
            <INNOCollectionHeader
              title={selected.productName}
              description="Installed endpoints & recent usage."
              meta={<INNOStatus tone={selected.compliance === 'overused' ? 'danger' : 'success'}>
                {selected.compliance === 'overused'
                  ? Math.abs(selected.seatBalance) + ' over'
                  : selected.seatBalance + ' available'}
              </INNOStatus>}
            />

            {selected.allocations.length === 0 ? (
              <div className="collection-state">
                <INNOState title="No detected usage" description="No endpoint allocations are currently recorded for this product." />
              </div>
            ) : (
              <INNOTableWrap width="wide">
                <table className="supporting-table">
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>User / Source</th>
                      <th className="numeric-column">Seats</th>
                      <th>Last Used</th>
                      <th>Status</th>
                      <th className="action-column">Asset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td><b>{allocation.endpointName}</b></td>
                        <td>{allocation.assignedTo ?? allocation.source.replaceAll('_', ' ')}</td>
                        <td className="numeric-column">{allocation.seatCount}</td>
                        <td>{allocation.lastUsedAt ? new Date(allocation.lastUsedAt).toLocaleString() : '—'}</td>
                        <td><INNOStatus>{allocation.status}</INNOStatus></td>
                        <td className="action-column">
                          {allocation.assetId
                            ? <Link className="open-resource" to={'/assets/' + allocation.assetId}>Open</Link>
                            : <span className="table-meta">Aggregate</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
            )}
          </INNOCollection>

          <div className="prod-panel license-record-panel">
            <div className="prod-panel-head">
              <div>
                <h3>License record</h3>
                <p>Update purchased entitlement and renewal metadata.</p>
              </div>
              <span className="prod-tag">ETag protected</span>
            </div>

            <div className="editor-form">
              <div className="editor-grid">
                <label className="field-block field-wide">
                  <span>License model</span>
                  <input
                    value={form.licenseModel}
                    onChange={(event) => setForm((current) => ({ ...current, licenseModel: event.target.value }))}
                  />
                </label>
                <label className="field-block">
                  <span>Purchased seats</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.entitledSeats}
                    onChange={(event) => setForm((current) => ({ ...current, entitledSeats: event.target.value }))}
                  />
                </label>
                <label className="field-block">
                  <span>Unit price · THB / year</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.unitPrice}
                    placeholder="Enterprise / bundled"
                    onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))}
                  />
                </label>
                <label className="field-block">
                  <span>Renewal date</span>
                  <input
                    type="date"
                    value={form.renewalAt}
                    onChange={(event) => setForm((current) => ({ ...current, renewalAt: event.target.value }))}
                  />
                </label>
                <label className="field-block">
                  <span>Contract reference</span>
                  <input
                    value={form.contractReference}
                    onChange={(event) => setForm((current) => ({ ...current, contractReference: event.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="license-record-summary">
              <div><span>Vendor</span><b>{selected.vendor}</b></div>
              <div><span>Installed</span><b>{selected.usedSeats} seats</b></div>
              <div><span>Renewal</span><b>{displayDate(selected.renewalAt)}</b></div>
              <div><span>Contract</span><b>{selected.contractReference ?? '—'}</b></div>
            </div>

            <INNOEditorFooter className="license-record-footer">
              <span className="editor-footer-note">
                Saving is audited. Crossing into overuse emits a compliance event.
              </span>
              <INNOButton busy={saveMutation.isPending} onClick={save}>Save License</INNOButton>
            </INNOEditorFooter>
          </div>
        </section>
      ) : null}
    </INNOPage>
  );
}
