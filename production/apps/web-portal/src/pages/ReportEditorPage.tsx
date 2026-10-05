import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOEditorFooter,
  INNOEditorFooterEnd,
  INNOEditorFooterNote,
  INNOEditorFooterStart,
  INNOPage,
  INNOStatus,
} from '@inno/ui';
import {
  createReport,
  getReport,
  getReportSources,
  updateReport,
} from '../api/client';
import type { ReportFilter, ReportMutationInput } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';

const operators: ReportFilter['operator'][] = ['equals', 'not_equals', 'contains'];

export function ReportEditorPage() {
  const { t } = useI18n();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !reportId || reportId === 'new';

  const sources = useQuery({
    queryKey: ['reports', 'sources'],
    queryFn: getReportSources,
  });
  const existing = useQuery({
    queryKey: ['reports', 'definition', reportId],
    queryFn: () => getReport(reportId ?? ''),
    enabled: !isNew,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [feedback, setFeedback] = useState('');

  const selectedSource = useMemo(
    () => sources.data?.find((source) => source.key === sourceKey),
    [sourceKey, sources.data],
  );

  useEffect(() => {
    if (existing.data) {
      setName(existing.data.name);
      setDescription(existing.data.description ?? '');
      setSourceKey(existing.data.sourceKey);
      setColumns(existing.data.columns);
      setFilters(existing.data.filters);
      return;
    }
    if (isNew && sources.data?.length && !sourceKey) {
      const source = sources.data[0];
      setSourceKey(source.key);
      setColumns(source.columns.map((column) => column.key));
    }
  }, [existing.data, isNew, sourceKey, sources.data]);

  const chooseSource = (nextKey: string) => {
    setSourceKey(nextKey);
    const source = sources.data?.find((item) => item.key === nextKey);
    setColumns(source?.columns.map((column) => column.key) ?? []);
    setFilters([]);
  };

  const toggleColumn = (key: string) => {
    setColumns((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };

  const addFilter = () => {
    const first = selectedSource?.filterFields[0];
    if (!first) return;
    setFilters((current) => [
      ...current,
      { field: first, operator: 'equals', value: '' },
    ]);
  };

  const patchFilter = (index: number, patch: Partial<ReportFilter>) => {
    setFilters((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item));
  };

  const input: ReportMutationInput = {
    name: name.trim(),
    description: description.trim() || null,
    sourceKey,
    columns,
    filters: filters.filter((filter) => filter.value.trim()),
  };
  const formValid = Boolean(name.trim() && sourceKey && columns.length);

  const save = useMutation({
    mutationFn: () => {
      if (!formValid) throw new Error(t('reports.error.incomplete'));
      if (isNew) return createReport(input);
      if (!existing.data) throw new Error(t('reports.error.notLoaded'));
      return updateReport(existing.data.id, existing.data.eTag, input);
    },
    onSuccess: async (saved) => {
      setFeedback(t('reports.toast.saved'));
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate('/reports/' + saved.id, { replace: true });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  if (sources.isPending || (!isNew && existing.isPending)) {
    return <div className="page-loading-wrap"><LoadingState /></div>;
  }
  if (sources.isError) {
    return <div className="page-error-wrap"><ErrorState error={sources.error} retry={() => void sources.refetch()} /></div>;
  }
  if (!isNew && existing.isError) {
    return <div className="page-error-wrap"><ErrorState error={existing.error} retry={() => void existing.refetch()} /></div>;
  }

  return (
    <INNOPage
      eyebrow={t('reports.editor.eyebrow')}
      title={t(isNew ? 'reports.editor.newTitle' : 'reports.editor.editTitle')}
      description={t('reports.editor.description')}
      actions={!isNew && reportId ? (
        <Link className="inno-link-button secondary" to={'/reports/' + reportId + '/runs'}>
          {t('reports.action.runs')}
        </Link>
      ) : undefined}
    >
      <section className="prod-panel">
        <div className="prod-panel-head">
          <div>
            <h3>{t('reports.editor.name')}</h3>
            <p>{t('reports.editor.note')}</p>
          </div>
          <INNOStatus>{t('reports.editor.csvOnly')}</INNOStatus>
        </div>

        <div className="editor-form">
          <div className="editor-grid">
            <label className="field-block">
              <span>{t('reports.editor.name')}</span>
              <input
                value={name}
                maxLength={180}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field-block">
              <span>{t('reports.editor.source')}</span>
              <select value={sourceKey} onChange={(event) => chooseSource(event.target.value)}>
                {(sources.data ?? []).map((source) => (
                  <option key={source.key} value={source.key}>{t('reports.source.' + source.key)}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-block">
            <span>{t('reports.editor.descriptionField')}</span>
            <textarea
              rows={3}
              maxLength={1200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="workflow-rule-section">
            <div className="workflow-rule-section-head">
              <div>
                <span className="workflow-rule-kicker">{t('reports.editor.columns')}</span>
                <h3>{selectedSource ? t('reports.source.' + selectedSource.key) : t('reports.editor.source')}</h3>
              </div>
              <INNOStatus>{columns.length}</INNOStatus>
            </div>
            <div className="report-column-grid">
              {(selectedSource?.columns ?? []).map((column) => (
                <label className="report-column-option" key={column.key}>
                  <input
                    type="checkbox"
                    checked={columns.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                  />
                  <span><b>{t('reports.column.' + column.key)}</b><small>{t('reports.dataType.' + column.dataType)}</small></span>
                </label>
              ))}
            </div>
          </div>

          <div className="workflow-rule-section">
            <div className="workflow-rule-section-head">
              <div>
                <span className="workflow-rule-kicker">{t('reports.editor.filters')}</span>
                <h3>{t('reports.editor.filters')}</h3>
              </div>
              <INNOButton
                type="button"
                variant="secondary"
                disabled={!selectedSource?.filterFields.length}
                onClick={addFilter}
              >
                {t('reports.editor.addFilter')}
              </INNOButton>
            </div>
            {filters.length ? (
              <div className="report-filter-list">
                {filters.map((filter, index) => (
                  <div className="report-filter-row" key={index}>
                    <label className="field-block">
                      <span>{t('reports.editor.filterField')}</span>
                      <select
                        value={filter.field}
                        onChange={(event) => patchFilter(index, { field: event.target.value })}
                      >
                        {(selectedSource?.filterFields ?? []).map((field) => (
                          <option key={field} value={field}>{t('reports.column.' + field)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>{t('reports.editor.filterOperator')}</span>
                      <select
                        value={filter.operator}
                        onChange={(event) => patchFilter(index, {
                          operator: event.target.value as ReportFilter['operator'],
                        })}
                      >
                        {operators.map((operator) => (
                          <option key={operator} value={operator}>
                            {t('reports.operator.' + (operator === 'not_equals' ? 'notEquals' : operator))}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-block">
                      <span>{t('reports.editor.filterValue')}</span>
                      <input
                        value={filter.value}
                        onChange={(event) => patchFilter(index, { value: event.target.value })}
                      />
                    </label>
                    <INNOButton
                      type="button"
                      variant="secondary"
                      onClick={() => setFilters((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      {t('reports.editor.removeFilter')}
                    </INNOButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-meta">{t('reports.editor.filters')}</div>
            )}
          </div>
        </div>
      </section>

      <INNOEditorFooter>
        <INNOEditorFooterStart>
          <Link className="inno-link-button secondary" to="/reports">{t('reports.action.cancel')}</Link>
        </INNOEditorFooterStart>
        <INNOEditorFooterNote>
          {feedback || (!name.trim()
            ? t('reports.validation.name')
            : !sourceKey
              ? t('reports.validation.source')
              : columns.length === 0
                ? t('reports.validation.columns')
                : t('reports.editor.note'))}
        </INNOEditorFooterNote>
        <INNOEditorFooterEnd>
          <INNOButton
            type="button"
            busy={save.isPending}
            disabled={!formValid}
            onClick={() => { if (formValid && !save.isPending) save.mutate(); }}
          >
            {t(isNew ? 'reports.editor.create' : 'reports.editor.save')}
          </INNOButton>
        </INNOEditorFooterEnd>
      </INNOEditorFooter>
    </INNOPage>
  );
}
