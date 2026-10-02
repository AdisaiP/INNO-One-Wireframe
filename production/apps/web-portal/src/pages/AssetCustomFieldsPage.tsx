import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNODialog, INNOPage,
  INNOStatus, INNOTableWrap,
} from '@inno/ui';
import { getAssetCustomFields, updateAssetCustomFields } from '../api/client';
import type { AssetCustomFieldDefinition } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

type EditableField = Pick<
  AssetCustomFieldDefinition,
  'fieldKey' | 'label' | 'fieldType' | 'isRequired' | 'showInAgent' | 'status' | 'options'
> & { existing: boolean };

const fieldTypes: Array<{ value: EditableField['fieldType']; label: string }> = [
  { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' }, { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
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
      if (!query.data) throw new Error('Custom-field schema is not loaded.');
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

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading custom fields…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Custom Fields"
      description="Define organization-specific fields for Asset records. User identity remains owned by Platform."
      actions={canManage ? <INNOButton onClick={openCreate}>Add Field</INNOButton> : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader
          title="Asset field schema"
          description={fields.length + ' organization-defined fields · Active fields appear on Asset Detail.'}
          meta={<INNOStatus tone="success">{fields.filter((field) => field.status === 'active').length} active</INNOStatus>}
        />
        <INNOTableWrap width="wide" stickyAction>
          <table>
            <thead><tr><th>Field</th><th>Key</th><th>Type</th><th>Required</th><th>Agent</th><th>Status</th><th className="action-column">Action</th></tr></thead>
            <tbody>{fields.map((field, index) => (
              <tr key={field.fieldKey}>
                <td><b>{field.label}</b>{field.fieldType === 'select' && field.options.length ? <div className="table-meta">{field.options.join(', ')}</div> : null}</td>
                <td>{field.fieldKey}</td>
                <td>{field.fieldType}</td>
                <td>{field.isRequired ? 'Yes' : 'No'}</td>
                <td>{field.showInAgent ? 'Shown' : 'Hidden'}</td>
                <td><INNOStatus tone={field.status === 'active' ? 'success' : 'neutral'}>{field.status}</INNOStatus></td>
                <td className="action-column">
                  {canManage ? <button type="button" className="inno-row-action" onClick={() => openEdit(index)} aria-label={'Edit ' + field.label}>Edit</button> : <span className="table-meta">View only</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </INNOTableWrap>
      </INNOCollection>
      <INNODialog
        open={dialogOpen}
        title={editingIndex === null ? 'Add Custom Field' : 'Edit Custom Field'}
        description="Configure one field without turning the settings page into a permanent editor."
        onClose={() => { if (!save.isPending) setDialogOpen(false); }}
        size="sm"
        footer={<>
          <INNOButton variant="secondary" disabled={save.isPending} onClick={() => setDialogOpen(false)}>Cancel</INNOButton>
          <INNOButton
            type="submit"
            form="custom-field-dialog-form"
            busy={save.isPending}
            disabled={Boolean(validationError)}
          >{editingIndex === null ? 'Add Field' : 'Save Field'}</INNOButton>
        </>}
      >
        <form id="custom-field-dialog-form" className="editor-form" onSubmit={(e) => { e.preventDefault(); if (!save.isPending && !validationError) save.mutate(); }}>
          <div className="editor-grid">
            <label className="field-block"><span>Label</span><input data-autofocus value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
            <label className="field-block"><span>Field key</span><input disabled={draft.existing} value={draft.fieldKey} onChange={(e) => setDraft({ ...draft, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} /></label>
            <label className="field-block"><span>Type</span><select value={draft.fieldType} onChange={(e) => { const fieldType = e.target.value as EditableField['fieldType']; setDraft({ ...draft, fieldType, options: fieldType === 'select' ? draft.options : [] }); }}>{fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label className="field-block"><span>Status</span><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EditableField['status'] })}><option value="active">Active</option><option value="draft">Draft</option></select></label>
            {draft.fieldType === 'select' ? <label className="field-block field-wide"><span>Options · one per line</span><textarea rows={4} value={draft.options.join('\n')} onChange={(e) => setDraft({ ...draft, options: e.target.value.split('\n') })} /></label> : null}
            <label className="check-row"><input type="checkbox" checked={draft.isRequired} onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })} /><span>Required on Asset</span></label>
            <label className="check-row"><input type="checkbox" checked={draft.showInAgent} onChange={(e) => setDraft({ ...draft, showInAgent: e.target.checked })} /><span>Expose to Endpoint Agent form</span></label>
          </div>
          {validationError ? <div className="field-error" role="alert">{validationError}</div> : null}
          {save.isError ? <ErrorState error={save.error} /> : null}
        </form>
      </INNODialog>
    </INNOPage>
  );
}
