import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INNOButton, INNOCollection, INNOCollectionHeader, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterNote, INNOEditorFooterStart, INNOPage, INNOStatus } from '@inno/ui';
import { getAssetCustomFields, updateAssetCustomFields } from '../api/client';
import type { AssetCustomFieldDefinition } from '../api/types';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

type EditableField = Pick<
  AssetCustomFieldDefinition,
  'fieldKey' | 'label' | 'fieldType' | 'isRequired' | 'showInAgent' | 'status' | 'options'
> & { existing: boolean };

const fieldTypes: Array<{ value: EditableField['fieldType']; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
];

function toEditable(field: AssetCustomFieldDefinition): EditableField {
  return {
    fieldKey: field.fieldKey,
    label: field.label,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    showInAgent: field.showInAgent,
    status: field.status,
    options: field.options,
    existing: true,
  };
}

function nextFieldKey(fields: EditableField[]) {
  let counter = fields.length + 1;
  while (fields.some((field) => field.fieldKey === 'custom_field_' + counter)) {
    counter += 1;
  }
  return 'custom_field_' + counter;
}

export function AssetCustomFieldsPage() {
  const canManage = usePermission('assets.manage');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['assets', 'custom-fields'],
    queryFn: getAssetCustomFields,
  });

  const [fields, setFields] = useState<EditableField[]>([]);
  const [saveError, setSaveError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setFields(query.data.fields.map(toEditable));
  }, [query.data]);

  const dirty = useMemo(() => {
    if (!query.data) return false;
    const source = query.data.fields.map(toEditable);
    return JSON.stringify(source) !== JSON.stringify(fields);
  }, [fields, query.data]);

  const validationErrors = useMemo(() => {
    const errors = new Map<number, string>();
    const keys = new Set<string>();
    fields.forEach((field, index) => {
      if (!/^[a-z][a-z0-9_]{1,79}$/.test(field.fieldKey)) {
        errors.set(index, 'Field key must use lowercase letters, numbers or underscores.');
        return;
      }
      if (keys.has(field.fieldKey)) {
        errors.set(index, 'Field key must be unique.');
        return;
      }
      keys.add(field.fieldKey);
      if (!field.label.trim()) {
        errors.set(index, 'Label is required.');
        return;
      }
      if (field.fieldType === 'select' && field.options.filter(Boolean).length === 0) {
        errors.set(index, 'Select fields need at least one option.');
      }
    });
    return errors;
  }, [fields]);

  const saveMutation = useMutation({
    mutationFn: () => updateAssetCustomFields(
      query.data?.eTag ?? '',
      fields.map(({ existing: _existing, ...field }) => ({
        ...field,
        label: field.label.trim(),
        fieldKey: field.fieldKey.trim(),
        options: field.fieldType === 'select'
          ? field.options.map((option) => option.trim()).filter(Boolean)
          : [],
      })),
    ),
    onSuccess: async (data) => {
      setSaveError('');
      setSavedMessage('Custom-field schema saved.');
      setFields(data.fields.map(toEditable));
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      window.setTimeout(() => setSavedMessage(''), 2500);
    },
    onError: (error: Error) => {
      setSavedMessage('');
      setSaveError(error.message);
    },
  });

  function updateField(index: number, patch: Partial<EditableField>) {
    setSavedMessage('');
    setSaveError('');
    setFields((current) => current.map((field, fieldIndex) => (
      fieldIndex === index ? { ...field, ...patch } : field
    )));
  }

  function addField() {
    setFields((current) => [
      ...current,
      {
        fieldKey: nextFieldKey(current),
        label: 'New Field',
        fieldType: 'text',
        isRequired: false,
        showInAgent: false,
        status: 'draft',
        options: [],
        existing: false,
      },
    ]);
  }

  function moveField(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= fields.length) return;
    setFields((current) => {
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  if (query.isPending) {
    return <div className="page-loading-wrap"><LoadingState label="Loading custom fields…" /></div>;
  }
  if (query.isError) {
    return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  }

  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Custom Fields"
      description="Define organization-specific fields for Asset records. User identity remains owned by Platform."
      actions={canManage ? <INNOButton onClick={addField}>Add Field</INNOButton> : undefined}
    >

      {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
      {savedMessage ? <div className="form-success" role="status">{savedMessage}</div> : null}

      <INNOCollection>
        <INNOCollectionHeader
          title="Asset field schema"
          description={fields.length + ' organization-defined fields · Active fields appear on Asset Detail.'}
          meta={<INNOStatus tone="success">{fields.filter((field) => field.status === 'active').length} active</INNOStatus>}
        />

        <div className="settings-stack">
          {fields.map((field, index) => (
            <article className="settings-row custom-field-editor-row" key={field.fieldKey + ':' + index}>
              <div className="custom-field-editor-main">
                <div className="editor-grid">
                  <label className="field-block">
                    <span>Label</span>
                    <input
                      value={field.label}
                      disabled={!canManage}
                      onChange={(event) => updateField(index, { label: event.target.value })}
                    />
                  </label>
                  <label className="field-block">
                    <span>Field key</span>
                    <input
                      value={field.fieldKey}
                      disabled={!canManage || field.existing}
                      onChange={(event) => updateField(index, { fieldKey: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    />
                  </label>
                  <label className="field-block">
                    <span>Type</span>
                    <select
                      value={field.fieldType}
                      disabled={!canManage}
                      onChange={(event) => {
                        const fieldType = event.target.value as EditableField['fieldType'];
                        updateField(index, {
                          fieldType,
                          options: fieldType === 'select' ? field.options : [],
                        });
                      }}
                    >
                      {fieldTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Status</span>
                    <select
                      value={field.status}
                      disabled={!canManage}
                      onChange={(event) => updateField(index, { status: event.target.value as EditableField['status'] })}
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                  {field.fieldType === 'select' ? (
                    <label className="field-block field-wide">
                      <span>Options · one per line</span>
                      <textarea
                        rows={3}
                        value={field.options.join('\n')}
                        disabled={!canManage}
                        onChange={(event) => updateField(index, { options: event.target.value.split('\n') })}
                      />
                    </label>
                  ) : null}
                </div>

                <div className="inline-actions custom-field-flags">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={field.isRequired}
                      disabled={!canManage}
                      onChange={(event) => updateField(index, { isRequired: event.target.checked })}
                    />
                    <span>Required on Asset</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={field.showInAgent}
                      disabled={!canManage}
                      onChange={(event) => updateField(index, { showInAgent: event.target.checked })}
                    />
                    <span>Expose to Endpoint Agent form</span>
                  </label>
                </div>

                {validationErrors.get(index) ? (
                  <div className="field-error" role="alert">{validationErrors.get(index)}</div>
                ) : null}
              </div>

              {canManage ? (
                <div className="inline-actions">
                  <INNOButton
                    variant="secondary"
                    disabled={index === 0}
                    aria-label={'Move ' + field.label + ' up'}
                    onClick={() => moveField(index, -1)}
                  >
                    Up
                  </INNOButton>
                  <INNOButton
                    variant="secondary"
                    disabled={index === fields.length - 1}
                    aria-label={'Move ' + field.label + ' down'}
                    onClick={() => moveField(index, 1)}
                  >
                    Down
                  </INNOButton>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {canManage ? (
          <INNOEditorFooter>
            <INNOEditorFooterStart>
              <INNOEditorFooterNote>
                Existing field keys cannot be removed or renamed. Set unused fields to Draft.
              </INNOEditorFooterNote>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              <INNOButton
                busy={saveMutation.isPending}
                disabled={!dirty || validationErrors.size > 0}
                onClick={() => saveMutation.mutate()}
              >
                Save Schema
              </INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        ) : null}
      </INNOCollection>
    </INNOPage>
  );
}
