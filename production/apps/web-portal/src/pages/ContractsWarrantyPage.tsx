import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOEditorFooter, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getAssetContracts, updateAssetContract } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function inputDate(value: string) {
  return value.slice(0, 10);
}

function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ContractsWarrantyPage() {
  const canManage = usePermission('assets.contract.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [fiscalYear, setFiscalYear] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    fiscalYear: '',
    vendor: '',
    startAt: '',
    endAt: '',
    serviceType: '',
    serviceCondition: '',
    warrantyTerms: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
  });

  useEffect(() => setPage(1), [deferredSearch, status, fiscalYear]);

  const query = useQuery({
    queryKey: ['assets', 'contracts', page, deferredSearch, status, fiscalYear],
    queryFn: () => getAssetContracts({
      page,
      pageSize: 25,
      search: deferredSearch,
      status,
      fiscalYear,
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
      fiscalYear: selected.fiscalYear,
      vendor: selected.vendor,
      startAt: inputDate(selected.startAt),
      endAt: inputDate(selected.endAt),
      serviceType: selected.serviceType,
      serviceCondition: selected.serviceCondition ?? '',
      warrantyTerms: selected.warrantyTerms ?? '',
      contactName: selected.contactName ?? '',
      contactPhone: selected.contactPhone ?? '',
      contactEmail: selected.contactEmail ?? '',
    });
    setMessage('');
    setSaveError('');
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a contract.');
      return updateAssetContract(selected.id, selected.eTag, {
        fiscalYear: form.fiscalYear.trim(),
        vendor: form.vendor.trim(),
        startAt: new Date(form.startAt + 'T00:00:00Z').toISOString(),
        endAt: new Date(form.endAt + 'T23:59:59Z').toISOString(),
        serviceType: form.serviceType.trim(),
        serviceCondition: form.serviceCondition.trim() || null,
        warrantyTerms: form.warrantyTerms.trim() || null,
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
      });
    },
    onSuccess: async (updated) => {
      setSaveError('');
      setMessage('Contract saved.');
      setSelectedId(updated.id);
      await queryClient.invalidateQueries({ queryKey: ['assets', 'contracts'] });
      window.setTimeout(() => setMessage(''), 2500);
    },
    onError: (error: Error) => {
      setMessage('');
      setSaveError(error.message);
    },
  });

  function save() {
    if (!form.fiscalYear.trim() || !form.vendor.trim() || !form.serviceType.trim()) {
      setSaveError('Fiscal year, vendor and service type are required.');
      return;
    }
    if (!form.startAt || !form.endAt || form.endAt <= form.startAt) {
      setSaveError('End date must be after the start date.');
      return;
    }
    if (form.contactEmail && !form.contactEmail.includes('@')) {
      setSaveError('Enter a valid support email.');
      return;
    }
    setSaveError('');
    saveMutation.mutate();
  }

  const summary = query.data?.summary;
  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Contracts & Warranty"
      description="Track vendors, service terms, warranty coverage and upcoming expirations."
    >

      <div className="production-stat-strip contract-stat-strip">
        <div><span>Active contracts</span><b>{summary?.activeContracts ?? '—'}</b><small>More than 90 days remaining</small></div>
        <div><span>Expiring ≤ 90 days</span><b>{summary?.expiringWithin90Days ?? '—'}</b><small>Requires renewal review</small></div>
        <div><span>Covered assets</span><b>{summary?.coveredAssets ?? '—'}</b><small>Active or expiring coverage</small></div>
        <div><span>Uncovered assets</span><b>{summary?.uncoveredAssets ?? '—'}</b><small>Needs warranty review</small></div>
      </div>

      {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
      {message ? <div className="form-success" role="status">{message}</div> : null}

      <INNOCollection className="contract-collection">
        <INNOCollectionHeader
          title="Contracts"
          description="Service and warranty agreements in the current Assets scope."
          meta={query.data ? <INNOStatus>{query.data.totalItems} contracts</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search contracts" value={search} onChange={setSearch} placeholder="Search contract, vendor or service…" />
          <INNOSelectField label="Status filter" value={status} onChange={setStatus}>
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring</option>
            <option value="expired">Expired</option>
          </INNOSelectField>
          <INNOSelectField label="Fiscal year filter" value={fiscalYear} onChange={setFiscalYear}>
            <option value="all">Fiscal year: All</option>
            {query.data?.fiscalYears.map((value) => <option key={value} value={value}>{value}</option>)}
          </INNOSelectField>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading contracts…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title="No contracts found"
              description="Try another search or clear the filters."
              action={<INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setFiscalYear('all'); }}>Clear filters</INNOButton>}
            />
          </div>
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table className="contract-table">
                <thead>
                  <tr>
                    <th>Contract</th><th>Fiscal Year</th><th>Vendor</th><th>Period</th><th>Service</th>
                    <th className="numeric-column">Assets</th><th>Status</th><th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((item) => (
                    <tr key={item.id} className={item.id === selectedId ? 'selected-row' : undefined}>
                      <td><b>{item.contractNumber}</b></td>
                      <td>{item.fiscalYear}</td>
                      <td>{item.vendor}</td>
                      <td>{displayDate(item.startAt)} – {displayDate(item.endAt)}</td>
                      <td>{item.serviceType}</td>
                      <td className="numeric-column">{item.coveredAssets.length}</td>
                      <td><INNOStatus tone={item.status === 'expired' ? 'danger' : item.status === 'expiring' ? 'warning' : 'success'}>{statusLabel(item.status)}</INNOStatus></td>
                      <td className="action-column"><button type="button" className="device-row-action" aria-label={'Open ' + item.contractNumber} onClick={() => setSelectedId(item.id)}><INNOIcon token="action.next" size={14} /></button></td>
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
        <section className="contract-detail-grid">
          <INNOCollection className="contract-detail-card">
            <INNOCollectionHeader
              title={selected.contractNumber}
              description={selected.vendor}
              meta={<INNOStatus tone={selected.status === 'expired' ? 'danger' : selected.status === 'expiring' ? 'warning' : 'success'}>{statusLabel(selected.status)}</INNOStatus>}
            />

            <div className="contract-kv-grid">
              <div><span>Fiscal year</span><b>{selected.fiscalYear}</b></div>
              <div><span>Period</span><b>{displayDate(selected.startAt)} – {displayDate(selected.endAt)}</b></div>
              <div><span>Warranty</span><b>{selected.serviceType}</b></div>
              <div><span>Days remaining</span><b>{selected.status === 'expired' ? 'Expired' : selected.daysRemaining + ' days'}</b></div>
              <div className="contract-kv-wide"><span>Service condition</span><b>{selected.serviceCondition ?? '—'}</b></div>
              <div className="contract-kv-wide"><span>Warranty terms</span><b>{selected.warrantyTerms ?? '—'}</b></div>
              <div className="contract-kv-wide"><span>Contact</span><b>{[selected.contactName, selected.contactPhone, selected.contactEmail].filter(Boolean).join(' · ') || '—'}</b></div>
            </div>

            <INNOCollectionHeader
              title="Covered assets"
              description={selected.coveredAssets.length + ' assets in selected contract.'}
            />
            {selected.coveredAssets.length === 0 ? (
              <div className="collection-state"><INNOState title="No covered assets" description="This contract does not currently cover any visible Asset." /></div>
            ) : (
              <INNOTableWrap width="wide">
                <table className="supporting-table">
                  <thead><tr><th>Asset</th><th>Model</th><th>Owner</th><th>Status</th><th className="action-column">Action</th></tr></thead>
                  <tbody>
                    {selected.coveredAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td><b>{asset.assetTag}</b><div className="table-meta">{asset.name}</div></td>
                        <td>{asset.brandModel || '—'}</td>
                        <td>{asset.owner ?? 'Unassigned'}</td>
                        <td><INNOStatus tone="success">{statusLabel(asset.coverageStatus)}</INNOStatus></td>
                        <td className="action-column"><Link className="open-resource" to={'/assets/' + asset.id}>Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
            )}
          </INNOCollection>

          {canManage ? (
            <div className="prod-panel contract-record-panel">
              <div className="prod-panel-head">
                <div><h3>Contract record</h3><p>Update vendor, coverage period and service terms.</p></div>
                <span className="prod-tag">ETag protected</span>
              </div>
              <div className="editor-form">
                <div className="editor-grid">
                  <label className="field-block"><span>Fiscal year</span><input value={form.fiscalYear} onChange={(event) => setForm((c) => ({ ...c, fiscalYear: event.target.value }))} /></label>
                  <label className="field-block"><span>Vendor</span><input value={form.vendor} onChange={(event) => setForm((c) => ({ ...c, vendor: event.target.value }))} /></label>
                  <label className="field-block"><span>Start date</span><input type="date" value={form.startAt} onChange={(event) => setForm((c) => ({ ...c, startAt: event.target.value }))} /></label>
                  <label className="field-block"><span>End date</span><input type="date" value={form.endAt} onChange={(event) => setForm((c) => ({ ...c, endAt: event.target.value }))} /></label>
                  <label className="field-block field-wide"><span>Service / warranty</span><input value={form.serviceType} onChange={(event) => setForm((c) => ({ ...c, serviceType: event.target.value }))} /></label>
                  <label className="field-block field-wide"><span>Service condition</span><textarea rows={2} value={form.serviceCondition} onChange={(event) => setForm((c) => ({ ...c, serviceCondition: event.target.value }))} /></label>
                  <label className="field-block field-wide"><span>Warranty terms</span><textarea rows={2} value={form.warrantyTerms} onChange={(event) => setForm((c) => ({ ...c, warrantyTerms: event.target.value }))} /></label>
                  <label className="field-block"><span>Contact name</span><input value={form.contactName} onChange={(event) => setForm((c) => ({ ...c, contactName: event.target.value }))} /></label>
                  <label className="field-block"><span>Contact phone</span><input value={form.contactPhone} onChange={(event) => setForm((c) => ({ ...c, contactPhone: event.target.value }))} /></label>
                  <label className="field-block field-wide"><span>Contact email</span><input type="email" value={form.contactEmail} onChange={(event) => setForm((c) => ({ ...c, contactEmail: event.target.value }))} /></label>
                </div>
              </div>
              <INNOEditorFooter className="contract-record-footer">
                <span className="editor-footer-note">Saving is audited. Entering the 90-day window emits expiration events for covered Assets.</span>
                <INNOButton busy={saveMutation.isPending} onClick={save}>Save Contract</INNOButton>
              </INNOEditorFooter>
            </div>
          ) : null}
        </section>
      ) : null}
    </INNOPage>
  );
}
