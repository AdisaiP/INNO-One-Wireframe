import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterStart, INNOPage, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap } from '@inno/ui';
import { createSoftwareBaseline, evaluateSoftwareBaseline, getSoftwareBaselineResults, getSoftwareBaselines, updateSoftwareBaseline } from '../api/client';
import type { SoftwareBaselineItem, SoftwareBaselineRequest } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

const blank: SoftwareBaselineRequest = {
  code: '', name: '', targetCategory: null, requiredPackages: [], status: 'draft',
};

export function SoftwareBaselinesPage() {
  const canManage = usePermission('assets.baseline.manage');
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<SoftwareBaselineRequest>(blank);
  const [packageText, setPackageText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ['assets', 'software-baselines', deferredSearch, status],
    queryFn: () => getSoftwareBaselines({ search: deferredSearch, status }),
  });
  const selected = useMemo(
    () => query.data?.items.find((item) => item.id === selectedId) ?? null,
    [query.data, selectedId],
  );
  const resultsQuery = useQuery({
    queryKey: ['assets', 'software-baselines', selectedId, 'results'],
    queryFn: () => getSoftwareBaselineResults(selectedId),
    enabled: Boolean(selectedId) && !creating,
  });
  const evaluate = useMutation({
    mutationFn: () => evaluateSoftwareBaseline(selectedId),
    onSuccess: async () => {
      setError('');
      setFeedback('Baseline evaluation completed.');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['assets', 'software-baselines'] }),
        client.invalidateQueries({ queryKey: ['assets', 'software-baselines', selectedId, 'results'] }),
      ]);
    },
    onError: (cause: Error) => {
      setFeedback('');
      setError(cause.message);
    },
  });

  useEffect(() => {
    if (creating || !query.data) return;
    if (!query.data.items.some((item) => item.id === selectedId)) {
      setSelectedId(query.data.items[0]?.id ?? '');
    }
  }, [query.data, selectedId, creating]);

  useEffect(() => {
    if (!selected || creating) return;
    setForm({
      code: selected.code,
      name: selected.name,
      targetCategory: selected.targetCategory,
      requiredPackages: selected.requiredPackages,
      status: selected.status,
    });
    setPackageText(selected.requiredPackages.join('\n'));
    setError('');
    setFeedback('');
  }, [selected, creating]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        targetCategory: form.targetCategory?.trim() || null,
        requiredPackages: packageText.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
      };
      if (!payload.code || !payload.name || !payload.requiredPackages.length) {
        throw new Error('Enter a code, name and at least one software package.');
      }
      return creating
        ? createSoftwareBaseline(payload)
        : selected
          ? updateSoftwareBaseline(selected.id, selected.eTag, payload)
          : Promise.reject(new Error('Select a baseline.'));
    },
    onSuccess: async (result) => {
      setError('');
      setFeedback('Baseline definition saved.');
      setCreating(false);
      setSelectedId(result.id);
      await client.invalidateQueries({ queryKey: ['assets', 'software-baselines'] });
    },
    onError: (cause: Error) => {
      setFeedback('');
      setError(cause.message);
    },
  });

  function startCreate() {
    setSelectedId('');
    setCreating(true);
    setForm({ ...blank, requiredPackages: [] });
    setPackageText('');
    setFeedback('');
    setError('');
  }

  if (query.isPending) return <div className="page-loading-wrap"><LoadingState label="Loading software baselines…" /></div>;
  if (query.isError) return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;

  const items: SoftwareBaselineItem[] = query.data.items;
  const editing = creating || selected !== null;

  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Software Baselines"
      description="Define required software and review evidence-backed compliance for linked Assets."
      actions={canManage ? <INNOButton onClick={startCreate}>New Baseline</INNOButton> : undefined}
    >
      <div className="baseline-info" role="status">
        Evaluation uses Devices observations from the last 24 hours. Missing, stale or partial inventory remains Unknown.
      </div>
      {feedback ? <div className="form-success" role="status">{feedback}</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <INNOCollection>
        <INNOCollectionHeader
          title="Baseline definitions"
          description={items.length + ' matching definitions'}
          meta={<INNOStatus>{items.length} baselines</INNOStatus>}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search baselines" value={search} onChange={setSearch} placeholder="Search code or name" />
          <INNOSelectField label="Status filter" value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </INNOSelectField>
        </INNOCollectionToolbar>
        {items.length ? (
          <INNOTableWrap width="wide"><table>
            <thead><tr><th>Baseline</th><th>Target category</th><th>Required software</th><th>Status</th><th>Evaluation</th><th className="action-column">Action</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} aria-selected={item.id === selectedId}>
              <td><b>{item.name}</b><div className="table-meta">{item.code}</div></td>
              <td>{item.targetCategory || 'All Asset categories'}</td>
              <td>{item.requiredPackages.length}</td>
              <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
              <td><INNOStatus tone={item.evaluationStatus === 'current' ? 'success' : item.evaluationStatus === 'stale' ? 'warning' : 'neutral'}>{item.evaluationStatus.replaceAll('_', ' ')}</INNOStatus></td>
              <td className="action-column"><button type="button" className="inno-row-action" aria-label={'Select ' + item.name} onClick={() => { setCreating(false); setSelectedId(item.id); }}>Select</button></td>
            </tr>)}</tbody>
          </table></INNOTableWrap>
        ) : (
          <div className="collection-state"><INNOState kind={search || status !== 'all' ? 'no-results' : 'empty'} title={search || status !== 'all' ? 'No matching baselines' : 'No software baselines yet'} description={search || status !== 'all' ? 'Try another search or status.' : 'Create the first baseline when required software policy is ready.'} /></div>
        )}
      </INNOCollection>

      {selected && !creating ? <INNOCollection className="baseline-results-card">
        <INNOCollectionHeader
          title="Evaluation results"
          description="Latest result for Assets in this baseline scope."
          meta={canManage && selected.status === 'active' ? (
            <INNOButton busy={evaluate.isPending} onClick={() => void evaluate.mutate()}>Evaluate Now</INNOButton>
          ) : undefined}
        />
        {resultsQuery.isPending ? (
          <div className="collection-state"><LoadingState label="Loading baseline results…" /></div>
        ) : resultsQuery.isError ? (
          <div className="collection-state"><ErrorState error={resultsQuery.error} retry={() => void resultsQuery.refetch()} /></div>
        ) : (
          <>
            <div className="baseline-result-summary">
              <div><span>Compliant</span><b>{resultsQuery.data.compliantCount}</b></div>
              <div><span>Missing</span><b>{resultsQuery.data.missingCount}</b></div>
              <div><span>Unknown</span><b>{resultsQuery.data.unknownCount}</b></div>
            </div>
            {resultsQuery.data.items.length ? (
              <INNOTableWrap width="xwide"><table>
                <thead><tr><th>Asset</th><th>Category</th><th>Result</th><th>Evidence</th><th>Missing software</th></tr></thead>
                <tbody>{resultsQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.assetTag}</b><div className="table-meta">{item.assetName}</div></td>
                    <td>{item.category}</td>
                    <td><INNOStatus tone={item.status === 'compliant' ? 'success' : item.status === 'missing' ? 'danger' : 'warning'}>{item.status}</INNOStatus></td>
                    <td>{item.reasonCode.replaceAll('_', ' ')}</td>
                    <td>{item.missingPackages.length ? item.missingPackages.join(', ') : '—'}</td>
                  </tr>
                ))}</tbody>
              </table></INNOTableWrap>
            ) : <div className="collection-state"><INNOState kind="empty" title="No evaluation results yet" description="Activate the baseline and run evaluation when evidence is available." /></div>}
          </>
        )}
      </INNOCollection> : null}

      {editing ? <INNOCollection>
        <INNOCollectionHeader
          title={creating ? 'New baseline' : 'Edit baseline'}
          description="One software package per line. The code is fixed after creation."
        />
        <div className="baseline-editor-body">
          <div className="editor-grid">
            <label className="field-block"><span>Code</span>
              <input value={form.code || ''} disabled={!creating || !canManage} maxLength={64}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} />
            </label>
            <label className="field-block"><span>Name</span>
              <input value={form.name} disabled={!canManage} maxLength={180}
                onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="field-block"><span>Asset category (optional)</span>
              <input value={form.targetCategory || ''} disabled={!canManage} maxLength={80}
                onChange={(event) => setForm({ ...form, targetCategory: event.target.value })} />
            </label>
            <label className="field-block"><span>Status</span>
              <select value={form.status} disabled={!canManage}
                onChange={(event) => setForm({ ...form, status: event.target.value as SoftwareBaselineRequest['status'] })}>
                <option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <label className="field-block"><span>Required software</span>
            <textarea value={packageText} disabled={!canManage} rows={5}
              onChange={(event) => setPackageText(event.target.value)}
              placeholder="Microsoft 365 Apps&#10;Endpoint Protection" />
          </label>
        </div>
        {canManage ? <INNOEditorFooter>
          <INNOEditorFooterStart>
            <INNOButton variant="secondary" onClick={() => { setCreating(false); setSelectedId(''); }}>Cancel</INNOButton>
          </INNOEditorFooterStart>
          <INNOEditorFooterEnd>
            <INNOButton busy={save.isPending} onClick={() => void save.mutate()}>Save Baseline</INNOButton>
          </INNOEditorFooterEnd>
        </INNOEditorFooter> : null}
      </INNOCollection> : null}
    </INNOPage>
  );
}
