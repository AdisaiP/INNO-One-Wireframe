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
import {
  createSoftwareBaseline,
  getSoftwareBaseline,
  updateSoftwareBaseline,
} from '../api/client';
import type { SoftwareBaselineRequest } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';

const blank: SoftwareBaselineRequest = {
  code: '',
  name: '',
  targetCategory: null,
  requiredPackages: [],
  status: 'draft',
};

export function SoftwareBaselineEditorPage() {
  const { baselineId } = useParams();
  const editing = Boolean(baselineId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SoftwareBaselineRequest>(blank);
  const [packageText, setPackageText] = useState('');
  const [saveError, setSaveError] = useState('');

  const query = useQuery({
    queryKey: ['assets', 'software-baseline', baselineId],
    queryFn: () => getSoftwareBaseline(baselineId ?? ''),
    enabled: editing,
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      code: query.data.code,
      name: query.data.name,
      targetCategory: query.data.targetCategory,
      requiredPackages: query.data.requiredPackages,
      status: query.data.status,
    });
    setPackageText(query.data.requiredPackages.join('\n'));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: SoftwareBaselineRequest = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        targetCategory: form.targetCategory?.trim() || null,
        requiredPackages: packageText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      };
      if (!payload.code || !payload.name || !payload.requiredPackages.length) {
        throw new Error('Enter a code, name and at least one software package.');
      }
      return editing && query.data
        ? updateSoftwareBaseline(query.data.id, query.data.eTag, payload)
        : createSoftwareBaseline(payload);
    },
    onSuccess: async (saved) => {
      setSaveError('');
      await queryClient.invalidateQueries({ queryKey: ['assets', 'software-baselines'] });
      queryClient.setQueryData(['assets', 'software-baseline', saved.id], saved);
      navigate('/assets/software-baselines/' + saved.id, { replace: true });
    },
    onError: (error: Error) => setSaveError(error.message),
  });

  if (editing && query.isPending) {
    return <div className="page-loading-wrap"><LoadingState label="Loading software baseline…" /></div>;
  }
  if (editing && query.isError) {
    return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  }

  const cancelTo = editing && baselineId
    ? '/assets/software-baselines/' + baselineId
    : '/assets/software-baselines';

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/software-baselines">Software Baselines</Link><span>›</span>
        {editing && query.data ? (
          <><Link to={'/assets/software-baselines/' + query.data.id}>{query.data.name}</Link><span>›</span></>
        ) : null}
        <span>{editing ? 'Edit' : 'New Baseline'}</span>
      </div>

      <section className="prod-panel editor-route-panel baseline-editor-route">
        <div className="prod-panel-head">
          <div>
            <h3>{editing ? 'Edit software baseline' : 'New software baseline'}</h3>
            <p>Define the required software policy. Evaluation results live on the resource detail page.</p>
          </div>
          <INNOStatus tone={form.status === 'active' ? 'success' : 'neutral'}>{form.status}</INNOStatus>
        </div>

        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) save.mutate();
          }}
        >
          <div className="editor-grid">
            <label className="field-block">
              <span>Code</span>
              <input
                data-autofocus={!editing || undefined}
                value={form.code}
                disabled={editing}
                maxLength={64}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
              />
              <small>{editing ? 'Code is stable after creation.' : 'Letters, numbers, underscores and hyphens.'}</small>
            </label>
            <label className="field-block">
              <span>Name</span>
              <input
                data-autofocus={editing || undefined}
                value={form.name}
                maxLength={180}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="field-block">
              <span>Asset category (optional)</span>
              <input
                value={form.targetCategory || ''}
                maxLength={80}
                onChange={(event) => setForm({ ...form, targetCategory: event.target.value })}
              />
            </label>
            <label className="field-block">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as SoftwareBaselineRequest['status'] })}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label className="field-block">
            <span>Required software</span>
            <textarea
              value={packageText}
              rows={8}
              onChange={(event) => setPackageText(event.target.value)}
              placeholder={'Microsoft 365 Apps\nEndpoint Protection'}
            />
            <small>One software package per line, up to 30 unique package names.</small>
          </label>

          {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}

          <INNOEditorFooter>
            <INNOEditorFooterStart>
              <Link className="inno-link-button secondary" to={cancelTo}>Cancel</Link>
              <INNOEditorFooterNote>
                {editing ? 'Changes make existing evaluation evidence stale until the baseline is evaluated again.' : 'Create the baseline first, then evaluate it from the detail page.'}
              </INNOEditorFooterNote>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              <INNOButton
                type="submit"
                busy={save.isPending}
                disabled={!form.code.trim() || !form.name.trim() || !packageText.trim()}
              >
                {editing ? 'Save Baseline' : 'Create Baseline'}
              </INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        </form>
      </section>
    </main>
  );
}
