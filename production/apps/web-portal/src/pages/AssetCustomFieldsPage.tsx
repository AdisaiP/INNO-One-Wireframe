import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNODialog, INNOPage,
  INNORowActions, INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { getAssetCustomFields, updateAssetCustomFields } from '../api/client';
import type { AssetCustomFieldDefinition } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

type EditableField = Pick<
  AssetCustomFieldDefinition,
  'fieldKey' | 'label' | 'fieldType' | 'isRequired' | 'showInAgent' | 'status' | 'options'
> & { existing: boolean };

const fieldTypes: Array<{ value: EditableField['fieldType']; labelKey: string }> = [
  { value: 'text', labelKey: 'assets.step45n.assetCustomFields.typeText' },
  { value: 'number', labelKey: 'assets.step45n.assetCustomFields.typeNumber' },
  { value: 'date', labelKey: 'assets.step45n.assetCustomFields.typeDate' },
  { value: 'boolean', labelKey: 'assets.step45n.assetCustomFields.typeBoolean' },
  { value: 'select', labelKey: 'assets.step45n.assetCustomFields.typeSelect' },
];

function toEditable(field: AssetCustomFieldDefinition): EditableField {
  return { fieldKey: field.fieldKey, label: field.label, fieldType: field.fieldType,
    isRequired: field.isRequired, showInAgent: field.showInAgent, status: field.status,
    options: field.options, existing: true };
}
function serialize(fields: EditableField[]) {
  return fields.map(({ existing: _existing, ...field }) => ({
    ...field,
    label: field.label.trim(),
    fieldKey: field.fieldKey.trim(),
    options: field.fieldType === 'select' ? field.options.map((x) => x.trim()).filter(Boolean) : [],
  }));
}

export function AssetCustomFieldsPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('assets.manage');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['assets', 'custom-fields'], queryFn: getAssetCustomFields });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditableField>({
    fieldKey: '', label: '', fieldType: 'text', isRequired: false,
    showInAgent: false, status: 'draft', options: [], existing: false,
  });

  const fields = useMemo(() => query.data?.fields.map(toEditable) ?? [], [query.data]);

  function nextFieldKey() {
    let i = fields.length + 1;
    while (fields.some((field) => field.fieldKey === 'custom_field_' + i)) i += 1;
    return 'custom_field_' + i;
  }
  function openCreate() {
    setEditingIndex(null);
    setDraft({ fieldKey: nextFieldKey(), label: '', fieldType: 'text', isRequired: false, showInAgent: false, status: 'draft', options: [], existing: false });
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    setDraft({ ...fields[index], options: [...fields[index].options] });
    setDialogOpen(true);
  }

  const validationError = useMemo(() => {
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(draft.fieldKey)) return 'Field key must use lowercase letters, numbers or underscores.';
    if (!draft.label.trim()) return 'Label is required.';
    if (draft.fieldType === 'select' && draft.options.map((x) => x.trim()).filter(Boolean).length === 0) return 'Select fields need at least one option.';
    const duplicate = fields.some((field, index) => field.fieldKey === draft.fieldKey && index !== editingIndex);
    if (duplicate) return 'Field key must be unique.';
    return '';
  }, [draft, editingIndex, fields]);

  const save = useMutation({
    mutationFn: async () => {
      if (!query.data) throw new Error(t45n('assets.step45n.assetCustomFields.customFieldSchemaIsNotLoaded'));
      const next = [...fields];
      if (editingIndex === null) next.push(draft);
      else next[editingIndex] = draft;
      return updateAssetCustomFields(query.data.eTag, serialize(next));
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setEditingIndex(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assets', 'custom-fields'] }),
        queryClient.invalidateQueries({ queryKey: ['assets'] }),
      ]);
    },
  });

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label={t45n('assets.step45n.assetCustomFields.loadingCustomFields')} /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  return (
    <INNOPage
      eyebrow={t45n('assets.step45n.assetCustomFields.assetsManagement')}
      title={t45n('navigation.customFields')}
      description={t45n('assets.step45n.assetCustomFields.defineOrganizationSpecificFieldsForAssetRecordsUser')}
      actions={canManage ? <INNOButton onClick={openCreate}>{t45n('assets.step45n.assetCustomFields.addField')}</INNOButton> : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('assets.step45n.assetCustomFields.assetFieldSchema')}
          description={t45n('assets.step45n.assetCustomFields.schemaCount', { count: fields.length })}
          meta={<INNOStatus tone="success">{fields.filter((field) => field.status === 'active').length} {t45n('assets.step45n.assetCustomFields.active')}</INNOStatus>}
        />
        <INNOTableWrap width="wide" stickyAction>
          <table>
            <thead><tr><th>{t45n('reports.editor.filterField')}</th><th>{t45n('assets.step45n.assetCustomFields.key')}</th><th>{t45n('reports.column.type')}</th><th>{t45n('assets.step45n.assetCustomFields.required')}</th><th>{t45n('assets.step45n.assetCustomFields.agent')}</th><th>{t45n('reports.runs.status')}</th><th className="action-column">{t45n('reports.table.action')}</th></tr></thead>
            <tbody>{fields.map((field, index) => (
              <tr key={field.fieldKey}>
                <td><b>{field.label}</b>{field.fieldType === 'select' && field.options.length ? <div className="table-meta">{field.options.join(', ')}</div> : null}</td>
                <td>{field.fieldKey}</td>
                <td>{field.fieldType}</td>
                <td>{field.isRequired ? t45n('assets.step45n.assetCustomFields.yes') : t45n('assets.step45n.assetCustomFields.no')}</td>
                <td>{field.showInAgent ? t45n('assets.step45n.assetCustomFields.shown') : t45n('assets.step45n.assetCustomFields.hidden')}</td>
                <td><INNOStatus tone={field.status === 'active' ? 'success' : 'neutral'}>{field.status}</INNOStatus></td>
                <td className="action-column">
                  {canManage ? <INNORowActions ariaLabel={t45n('assets.step45n.assetCustomFields.customField') + ' ' + field.label} items={[{ id: 'edit', label: t45n('reports.action.edit'), onSelect: () => openEdit(index) }]} /> : <span className="table-meta">{t45n('admin.step45n.adminAccessScopes.viewOnly')}</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </INNOTableWrap>
      </INNOCollection>
      <INNODialog
        open={dialogOpen}
        title={editingIndex === null ? t45n('assets.step45n.assetCustomFields.addCustomField') : t45n('assets.step45n.assetCustomFields.editCustomField')}
        description={t45n('assets.step45n.assetCustomFields.configureOneFieldWithoutTurningTheSettingsPage')}
        onClose={() => { if (!save.isPending) setDialogOpen(false); }}
        size="sm"
        footer={<>
          <INNOButton variant="secondary" disabled={save.isPending} onClick={() => setDialogOpen(false)}>{t45n('reports.action.cancel')}</INNOButton>
          <INNOButton
            type="submit"
            form="custom-field-dialog-form"
            busy={save.isPending}
            disabled={Boolean(validationError)}
          >{editingIndex === null ? t45n('assets.step45n.assetCustomFields.addField') : t45n('assets.step45n.assetCustomFields.saveField')}</INNOButton>
        </>}
      >
        <form id="custom-field-dialog-form" className="editor-form" onSubmit={(e) => { e.preventDefault(); if (!save.isPending && !validationError) save.mutate(); }}>
          <div className="editor-grid">
            <label className="field-block"><span>{t45n('helpdesk.automation.builder.label')}</span><input data-autofocus value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
            <label className="field-block"><span>{t45n('assets.step45n.assetCustomFields.fieldKey')}</span><input disabled={draft.existing} value={draft.fieldKey} onChange={(e) => setDraft({ ...draft, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} /></label>
            <label className="field-block"><span>{t45n('reports.column.type')}</span><select value={draft.fieldType} onChange={(e) => { const fieldType = e.target.value as EditableField['fieldType']; setDraft({ ...draft, fieldType, options: fieldType === 'select' ? draft.options : [] }); }}>{fieldTypes.map((type) => <option key={type.value} value={type.value}>{t45n(type.labelKey)}</option>)}</select></label>
            <label className="field-block"><span>{t45n('reports.runs.status')}</span><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EditableField['status'] })}><option value="active">{t45n('reports.status.active')}</option><option value="draft">{t45n('workflow.status.draft')}</option></select></label>
            {draft.fieldType === 'select' ? <label className="field-block field-wide"><span>{t45n('assets.step45n.assetCustomFields.optionsOnePerLine')}</span><textarea rows={4} value={draft.options.join('\n')} onChange={(e) => setDraft({ ...draft, options: e.target.value.split('\n') })} /></label> : null}
            <label className="check-row"><input type="checkbox" checked={draft.isRequired} onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })} /><span>{t45n('assets.step45n.assetCustomFields.requiredOnAsset')}</span></label>
            <label className="check-row"><input type="checkbox" checked={draft.showInAgent} onChange={(e) => setDraft({ ...draft, showInAgent: e.target.checked })} /><span>{t45n('assets.step45n.assetCustomFields.exposeToEndpointAgentForm')}</span></label>
          </div>
          {validationError ? <div className="field-error" role="alert">{validationError}</div> : null}
          {save.isError ? <ErrorState error={save.error} /> : null}
        </form>
      </INNODialog>
    </INNOPage>
  );
}
