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
import { useI18n as useStep45NI18n } from '@inno/i18n';

function inputDate(value: string) {
  return value.slice(0, 10);
}

const blankForm = {
  fiscalYear: '', vendor: '', startAt: '', endAt: '', serviceType: '',
  serviceCondition: '', warrantyTerms: '', contactName: '', contactPhone: '', contactEmail: '',
};

export function ContractEditPage() {
  const { t: t45n } = useStep45NI18n();
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
      if (!query.data) throw new Error(t45n('assets.step45n.contractEdit.contractIsNotLoaded'));
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
      setValidationError(t45n('assets.step45n.contractEdit.fiscalYearVendorAndServiceTypeAreRequired'));
      return;
    }
    if (!form.startAt || !form.endAt || form.endAt <= form.startAt) {
      setValidationError(t45n('assets.step45n.contractEdit.endDateMustBeAfterTheStartDate'));
      return;
    }
    if (form.contactEmail && !form.contactEmail.includes('@')) {
      setValidationError(t45n('assets.step45n.contractEdit.enterAValidSupportEmail'));
      return;
    }
    setValidationError('');
    save.mutate();
  }
  if (!canManage) return <INNOPage eyebrow={t45n('assets.step45n.assetCustomFields.assetsManagement')} title={t45n('assets.step45n.contractEdit.contractEditor')} description={t45n('assets.step45n.contractEdit.youDoNotHavePermissionToManageContracts')} />;
  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('assets.step45n.contractDetail.loadingContract')} /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  if (!query.data) return null;

  return (
    <INNOPage
      eyebrow={t45n('assets.step45n.assetCustomFields.assetsManagement')}
      title={t45n('assets.step45n.contractEdit.editContractTitle', { number: query.data.contractNumber })}
      description={t45n('assets.step45n.contractEdit.updateVendorCoveragePeriodAndServiceTermsOn')}
    >
      <div className="resource-breadcrumb">
        <Link to="/assets/contracts">{t45n('navigation.contractsWarranty')}</Link><span>›</span>
        <Link to={'/assets/contracts/' + query.data.id}>{query.data.contractNumber}</Link><span>›</span><span>{t45n('reports.action.edit')}</span>
      </div>

      <section className="prod-panel editor-route-panel">
        <div className="prod-panel-head"><div><h3>{t45n('assets.step45n.contractEdit.contractRecord')}</h3><p>{t45n('assets.step45n.contractEdit.etagProtectedUpdateForTheSelectedContract')}</p></div></div>
        <form className="editor-form" onSubmit={(e) => { e.preventDefault(); if (!save.isPending) submit(); }}>
          <div className="editor-grid">
            <label className="field-block"><span>{t45n('assets.step45n.contractDetail.fiscalYear')}</span><input data-autofocus value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('assets.automation.editor.licenseField.vendor')}</span><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('assets.step45n.contractDetail.startDate')}</span><input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('assets.step45n.contractDetail.endDate')}</span><input type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></label>
            <label className="field-block field-wide"><span>{t45n('assets.step45n.contractEdit.serviceWarranty')}</span><input value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} /></label>
            <label className="field-block field-wide"><span>{t45n('assets.step45n.contractDetail.serviceCondition')}</span><textarea rows={3} value={form.serviceCondition} onChange={(e) => setForm({ ...form, serviceCondition: e.target.value })} /></label>
            <label className="field-block field-wide"><span>{t45n('assets.step45n.contractDetail.warrantyTerms')}</span><textarea rows={3} value={form.warrantyTerms} onChange={(e) => setForm({ ...form, warrantyTerms: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('assets.step45n.contractEdit.contactName')}</span><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('assets.step45n.contractEdit.contactPhone')}</span><input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
            <label className="field-block field-wide"><span>{t45n('assets.step45n.contractEdit.contactEmail')}</span><input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
          </div>
          {validationError ? <div className="form-error" role="alert">{validationError}</div> : null}
          {save.isError ? <ErrorState error={save.error} /> : null}
          <INNOEditorFooter>
            <INNOEditorFooterStart>
              <INNOEditorFooterNote>{t45n('assets.step45n.contractEdit.savingIsAuditedEnteringThe90DayWindow')}</INNOEditorFooterNote>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              <INNOButton type="button" variant="secondary" disabled={save.isPending} onClick={() => navigate('/assets/contracts/' + query.data.id)}>{t45n('reports.action.cancel')}</INNOButton>
              <INNOButton type="submit" busy={save.isPending}>{t45n('assets.step45n.contractEdit.saveContract')}</INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </INNOPage>
  );
}
