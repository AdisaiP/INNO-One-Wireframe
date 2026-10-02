import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  INNOButton, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterNote,
  INNOEditorFooterStart, INNOPage,
} from '@inno/ui';
import { getAssetContract, updateAssetContract } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

function inputDate(value: string) {
  return value.slice(0, 10);
}

const blankForm = {
  fiscalYear: '', vendor: '', startAt: '', endAt: '', serviceType: '',
  serviceCondition: '', warrantyTerms: '', contactName: '', contactPhone: '', contactEmail: '',
};

export function ContractEditPage() {
  const { contractId = '' } = useParams();
  const canManage = usePermission('assets.contract.manage');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blankForm);
  const [validationError, setValidationError] = useState('');
  const query = useQuery({
    queryKey: ['assets', 'contract', contractId],
    queryFn: () => getAssetContract(contractId),
    enabled: !!contractId,
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      fiscalYear: query.data.fiscalYear,
      vendor: query.data.vendor,
      startAt: inputDate(query.data.startAt),
      endAt: inputDate(query.data.endAt),
      serviceType: query.data.serviceType,
      serviceCondition: query.data.serviceCondition ?? '',
      warrantyTerms: query.data.warrantyTerms ?? '',
      contactName: query.data.contactName ?? '',
      contactPhone: query.data.contactPhone ?? '',
      contactEmail: query.data.contactEmail ?? '',
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error('Contract is not loaded.');
      return updateAssetContract(query.data.id, query.data.eTag, {
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assets', 'contracts'] }),
        queryClient.invalidateQueries({ queryKey: ['assets', 'contract', updated.id] }),
      ]);
      navigate('/assets/contracts/' + updated.id, { replace: true });
    },
  });

  function submit() {
    if (!form.fiscalYear.trim() || !form.vendor.trim() || !form.serviceType.trim()) {
      setValidationError('Fiscal year, vendor and service type are required.');
      return;
    }
    if (!form.startAt || !form.endAt || form.endAt <= form.startAt) {
      setValidationError('End date must be after the start date.');
      return;
    }
    if (form.contactEmail && !form.contactEmail.includes('@')) {
      setValidationError('Enter a valid support email.');
      return;
    }
    setValidationError('');
    save.mutate();
  }
  if (!canManage) return <INNOPage eyebrow="Assets · Management" title="Contract Editor" description="You do not have permission to manage contracts." />;
  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading contract…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  if (!query.data) return null;

  return (
    <INNOPage
      eyebrow="Assets · Management"
      title={'Edit Contract · ' + query.data.contractNumber}
      description="Update vendor, coverage period and service terms on a dedicated editor route."
    >
      <div className="resource-breadcrumb">
        <Link to="/assets/contracts">Contracts & Warranty</Link><span>›</span>
        <Link to={'/assets/contracts/' + query.data.id}>{query.data.contractNumber}</Link><span>›</span><span>Edit</span>
      </div>

      <section className="prod-panel editor-route-panel">
        <div className="prod-panel-head"><div><h3>Contract record</h3><p>ETag-protected update for the selected contract.</p></div></div>
        <form className="editor-form" onSubmit={(e) => { e.preventDefault(); if (!save.isPending) submit(); }}>
          <div className="editor-grid">
            <label className="field-block"><span>Fiscal year</span><input data-autofocus value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} /></label>
            <label className="field-block"><span>Vendor</span><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
            <label className="field-block"><span>Start date</span><input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label>
            <label className="field-block"><span>End date</span><input type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label>
            <label className="field-block field-wide"><span>Service / warranty</span><input value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} /></label>
            <label className="field-block field-wide"><span>Service condition</span><textarea rows={3} value={form.serviceCondition} onChange={(e) => setForm({ ...form, serviceCondition: e.target.value })} /></label>
            <label className="field-block field-wide"><span>Warranty terms</span><textarea rows={3} value={form.warrantyTerms} onChange={(e) => setForm({ ...form, warrantyTerms: e.target.value })} /></label>
            <label className="field-block"><span>Contact name</span><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
            <label className="field-block"><span>Contact phone</span><input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
            <label className="field-block field-wide"><span>Contact email</span><input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
          </div>
          {validationError ? <div className="form-error" role="alert">{validationError}</div> : null}
          {save.isError ? <ErrorState error={save.error} /> : null}
          <INNOEditorFooter>
            <INNOEditorFooterStart>
              <INNOEditorFooterNote>Saving is audited. Entering the 90-day window emits expiration events for covered Assets.</INNOEditorFooterNote>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              <INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => navigate('/assets/contracts/' + query.data.id)}>Cancel</INNOButton>
              <INNOButton type="submit" busy={save.isPending}>Save Contract</INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </INNOPage>
  );
}
