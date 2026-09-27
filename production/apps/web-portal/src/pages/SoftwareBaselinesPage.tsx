import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INNOButton, INNOPage } from '@inno/ui';
import { createSoftwareBaseline, getSoftwareBaselines, updateSoftwareBaseline } from '../api/client';
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
    <INNOPage eyebrow="Assets · Management" title="Software Baselines">
      <div className="page-intro-row">
        <p className="page-helper">Define required software for an Asset category. Evaluation awaits verified installed-software inventory from Devices.</p>
        {canManage ? <INNOButton onClick={startCreate}>New Baseline</INNOButton> : null}
      </div>
      <div className="baseline-info" role="status">
        No installed-software feed is connected yet. A saved definition is not a compliance result; no drift alert is emitted from missing inventory.
      </div>
      {feedback ? <div className="form-success" role="status">{feedback}</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <section className="collection-card">
        <div className="collection-head">
          <div><h2>Baseline definitions</h2><p>{items.length} matching definitions</p></div>
        </div>
        <div className="collection-toolbar">
          <label className="search-field"><span className="sr-only">Search baselines</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or name" />
          </label>
          <label ><span className="sr-only">Status filter</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        {items.length ? (
          <div className="production-table-wrap"><table className="production-table">
            <thead><tr><th>Baseline</th><th>Target category</th><th>Required software</th><th>Status</th><th>Evaluation</th><th className="action-column">Action</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} aria-selected={item.id === selectedId}>
              <td><b>{item.name}</b><div className="table-meta">{item.code}</div></td>
              <td>{item.targetCategory || 'All Asset categories'}</td>
              <td>{item.requiredPackages.length}</td>
              <td>{item.status}</td>
              <td>Awaiting inventory</td>
              <td className="action-column"><INNOButton variant="secondary" onClick={() => { setCreating(false); setSelectedId(item.id); }}>Open</INNOButton></td>
            </tr>)}</tbody>
          </table></div>
        ) : <div className="compact-empty">{search || status !== 'all' ? 'No matching baselines.' : 'No software baselines yet.'}</div>}
      </section>

      {editing ? <section className="collection-card">
        <div className="collection-head"><div><h2>{creating ? 'New baseline' : 'Edit baseline'}</h2>
          <p>One software package per line. The code is fixed after creation.</p></div></div>
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
        {canManage ? <div className="baseline-editor-footer">
          <INNOButton variant="secondary" onClick={() => { setCreating(false); setSelectedId(''); }}>Cancel</INNOButton>
          <INNOButton disabled={save.isPending} onClick={() => void save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save Baseline'}
          </INNOButton>
        </div> : null}
      </section> : null}
    </INNOPage>
  );
}
