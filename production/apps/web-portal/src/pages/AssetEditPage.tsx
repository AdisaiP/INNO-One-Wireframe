import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOEditorFooter,
  INNOEditorFooterEnd,
  INNOEditorFooterNote,
  INNOEditorFooterStart,
  INNOStatus,
} from '@inno/ui';
import { getAsset, updateAsset } from '../api/client';
import type { AssetCustomFieldValue } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

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
  const { t: t45n } = useStep45NI18n();
  const label = field.label + (field.isRequired ? ' *' : '');
  if (field.fieldType === 'boolean') {
    return (
      <div className="field-block">
        <span>{label}</span>
        <label className="check-row">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
          <span>{Boolean(value) ? t45n('assets.step45n.assetCustomFields.yes') : t45n('assets.step45n.assetCustomFields.no')}</span>
        </label>
        {error ? <span className="field-error" role="alert">{error}</span> : null}
      </div>
    );
  }
  if (field.fieldType === 'select') {
    return (
      <label className="field-block">
        <span>{label}</span>
        <select value={typeof value === 'string' ? value : ''} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)}>
          <option value="">{t45n('assets.step45n.assetEdit.select')}</option>
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

export function AssetEditPage() {
  const { t: t45n } = useStep45NI18n();
  const { assetId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['assets', 'detail', assetId],
    queryFn: () => getAsset(assetId),
    enabled: Boolean(assetId),
  });
  const [form, setForm] = useState({ name: '', category: '', lifecycleStatus: '', purchasePrice: '' });
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setForm({
      name: query.data.name,
      category: query.data.category,
      lifecycleStatus: query.data.status,
      purchasePrice: query.data.purchasePrice?.toString() ?? '',
    });
    setCustomValues(Object.fromEntries(query.data.customFields.map((field) => [
      field.fieldKey,
      field.value ?? (field.fieldType === 'boolean' ? false : ''),
    ])));
    setCustomErrors({});
    setSaveError('');
  }, [query.data]);

  const customPayload = () => Object.fromEntries(
    (query.data?.customFields ?? []).map((field) => {
      const value = customValues[field.fieldKey];
      if (field.fieldType === 'number') return [field.fieldKey, value === '' || value == null ? null : Number(value)];
      if (field.fieldType === 'boolean') return [field.fieldKey, Boolean(value)];
      return [field.fieldKey, value === '' ? null : value];
    }),
  );

  const save = useMutation({
    mutationFn: () => updateAsset(assetId, query.data?.eTag ?? '', {
      name: form.name.trim(),
      category: form.category,
      lifecycleStatus: form.lifecycleStatus,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
      customFields: customPayload(),
    }),
    onSuccess: async (updated) => {
      setSaveError('');
      setCustomErrors({});
      queryClient.setQueryData(['assets', 'detail', assetId], updated);
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate('/assets/' + assetId, { replace: true });
    },
    onError: (error: Error) => setSaveError(error.message),
  });

  const submit = () => {
    const errors: Record<string, string> = {};
    for (const field of query.data?.customFields ?? []) {
      const value = customValues[field.fieldKey];
      const empty = value == null || value === '';
      if (field.isRequired && empty) errors[field.fieldKey] = 'This field is required.';
      if (field.fieldType === 'number' && !empty && Number.isNaN(Number(value))) {
        errors[field.fieldKey] = 'Enter a valid number.';
      }
    }
    setCustomErrors(errors);
    if (Object.keys(errors).length) {
      setSaveError('Review the highlighted custom fields before saving.');
      return;
    }
    setSaveError('');
    save.mutate();
  };

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('assets.step45n.assetDetail.loadingAsset')} /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const asset = query.data;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/inventory">{t45n('navigation.assetInventory')}</Link><span>›</span>
        <Link to={'/assets/' + asset.id}>{asset.assetTag}</Link><span>›</span><span>{t45n('reports.action.edit')}</span>
      </div>

      <section className="prod-panel editor-route-panel asset-editor-route">
        <div className="prod-panel-head">
          <div><h3>{t45n('assets.step45n.assetDetail.editAsset')}</h3><p>{t45n('assets.step45n.assetEdit.updateCanonicalAssetMetadataAndOrganizationDefinedCustom')}</p></div>
          <INNOStatus>{asset.assetTag}</INNOStatus>
        </div>

        <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (!save.isPending) submit(); }}>
          <section className="editor-section">
            <div className="editor-section-head"><div><h4>{t45n('assets.step45n.assetDetail.assetInformation')}</h4><p>{t45n('assets.step45n.assetEdit.coreInventoryMetadata')}</p></div></div>
            <div className="editor-grid">
              <label className="field-block field-wide"><span>{t45n('assets.step45n.assetDetail.assetName')}</span><input data-autofocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="field-block"><span>{t45n('reports.column.category')}</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>{t45n('assets.step45n.assetEdit.computer')}</option><option>{t45n('devices.shared.deviceType.notebook')}</option><option>{t45n('assets.step45n.assetEdit.monitor')}</option><option>{t45n('assets.step45n.assetEdit.printer')}</option><option>{t45n('assets.step45n.assetEdit.other')}</option></select></label>
              <label className="field-block"><span>{t45n('reports.runs.status')}</span><select value={form.lifecycleStatus} onChange={(event) => setForm({ ...form, lifecycleStatus: event.target.value })}><option value="in_use">{t45n('assets.automation.editor.lifecycle.in_use')}</option><option value="stock">{t45n('assets.step45n.assetEdit.stock')}</option><option value="repair">{t45n('assets.automation.editor.lifecycle.repair')}</option><option value="retired">{t45n('assets.automation.editor.lifecycle.retired')}</option></select></label>
              <label className="field-block"><span>{t45n('assets.step45n.assetEdit.purchasePriceThb')}</span><input type="number" min="0" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: event.target.value })} /></label>
            </div>
          </section>

          <section className="editor-section">
            <div className="editor-section-head">
              <div><h4>{t45n('assets.step45n.assetDetail.customFields')}</h4><p>{t45n('assets.step45n.assetEdit.organizationDefinedAssetAttributes')}</p></div>
              <Link className="open-resource" to="/assets/custom-fields">{t45n('assets.step45n.assetDetail.manageSchema')}</Link>
            </div>
            {asset.customFields.length ? (
              <div className="editor-grid">
                {asset.customFields.map((field) => (
                  <CustomFieldInput
                    key={field.fieldKey}
                    field={field}
                    value={customValues[field.fieldKey]}
                    error={customErrors[field.fieldKey]}
                    onChange={(value) => {
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
            ) : <div className="compact-empty">{t45n('assets.step45n.assetDetail.noActiveCustomFieldsAreConfigured')}</div>}
          </section>

          {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}

          <INNOEditorFooter>
            <INNOEditorFooterStart>
              <Link className="inno-link-button secondary" to={'/assets/' + asset.id}>{t45n('reports.action.cancel')}</Link>
              <INNOEditorFooterNote>{t45n('assets.step45n.assetEdit.assetAndCustomFieldChangesAreAuditedAnd')}</INNOEditorFooterNote>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              <INNOButton type="submit" busy={save.isPending} disabled={!form.name.trim()}>{t45n('assets.step45n.assetEdit.saveAsset')}</INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </main>
  );
}
