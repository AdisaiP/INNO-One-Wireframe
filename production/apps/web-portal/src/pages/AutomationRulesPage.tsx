import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOPage, INNOState } from '@inno/ui';
import { getAutomationRules } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatRelative(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return minutes + ' min';
  if (minutes < 1440) return Math.round(minutes / 60) + ' h';
  return date.toLocaleDateString();
}

export function AutomationRulesPage() {
  const canManage = usePermission('helpdesk.automation.manage');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch, status, type]);

  const query = useQuery({
    queryKey: ['helpdesk', 'automation-rules', page, deferredSearch, status, type],
    queryFn: () => getAutomationRules({
      page,
      pageSize: 25,
      search: deferredSearch,
      status,
      type,
    }),
  });

  const stats = useMemo(() => {
    const items = query.data?.items ?? [];
    return {
      active: items.filter((item) => item.status === 'active').length,
      paused: items.filter((item) => item.status === 'paused').length,
      executions: items.reduce((sum, item) => sum + item.executionCount, 0),
      last: items.map((item) => item.lastExecutedAt).filter(Boolean).sort().at(-1) ?? null,
    };
  }, [query.data]);

  return (
    <INNOPage eyebrow="Helpdesk · Manage" title="Automation">
      <div className="page-intro-row">
        <p className="page-helper">Assignment, routing, classification and SLA escalation rules.</p>
        {canManage ? <Link className="inno-link-button" to="/helpdesk/automation/new">New Rule</Link> : null}
      </div>

      <div className="production-stat-strip helpdesk-stat-strip">
        <div><span>Automation rules</span><b>{query.data?.totalItems ?? 0}</b><small>{stats.active} active · {stats.paused} paused</small></div>
        <div><span>Executions</span><b>{stats.executions}</b><small>Visible rule sample</small></div>
        <div><span>Rule types</span><b>{new Set((query.data?.items ?? []).map((item) => item.ruleType)).size}</b><small>Assignment / escalation / routing</small></div>
        <div><span>Last execution</span><b>{formatRelative(stats.last)}</b><small>Automation worker history</small></div>
      </div>

      <section className="collection-card">
        <div className="collection-head">
          <div><h2>Automation rules</h2><p>Open one rule to edit its trigger, condition and action.</p></div>
          {query.data ? <span className="prod-tag">{query.data.totalItems} rules</span> : null}
        </div>

        <div className="collection-toolbar">
          <label className="search-field">
            <span className="sr-only">Search automation rules</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rule, trigger or action…" />
          </label>
          <label>
            <span className="sr-only">Filter rules by status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter rules by type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">Type: All</option>
              <option value="assignment">Assignment</option>
              <option value="escalation">Escalation</option>
              <option value="classification">Classification</option>
              <option value="routing">Routing</option>
            </select>
          </label>
        </div>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading automation rules…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title="No automation rules found"
              description="Try another search or clear the filters."
              action={search || status !== 'all' || type !== 'all' ? (
                <div className="state-action">
                  <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setType('all'); }}>
                    Clear filters
                  </INNOButton>
                </div>
              ) : undefined}
            />
          </div>
        ) : (
          <>
            <div className="production-table-wrap">
              <table className="production-table">
                <thead><tr><th>Rule</th><th>Type</th><th>Trigger</th><th>Primary action</th><th>Status</th><th>Last execution</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {query.data.items.map((rule) => (
                    <tr key={rule.id}>
                      <td><b>{rule.name}</b><div className="table-meta">{rule.executionCount} executions</div></td>
                      <td>{rule.ruleType}</td>
                      <td>{rule.trigger.replaceAll('_', ' ')}</td>
                      <td>{rule.primaryAction}</td>
                      <td><span className={'prod-tag ' + (rule.status === 'active' ? 'success' : '')}>{rule.status === 'active' ? 'Active' : 'Paused'}</span></td>
                      <td>{formatRelative(rule.lastExecutedAt)}</td>
                      <td className="action-column"><Link className="open-resource" to={'/helpdesk/automation/' + rule.id}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="collection-footer">
              <span>Showing {(query.data.page - 1) * query.data.pageSize + 1}–{Math.min(query.data.page * query.data.pageSize, query.data.totalItems)} of {query.data.totalItems}</span>
              <div className="pagination-actions">
                <INNOButton variant="secondary" disabled={query.data.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</INNOButton>
                <span>Page {query.data.page} of {Math.max(query.data.totalPages, 1)}</span>
                <INNOButton variant="secondary" disabled={query.data.page >= query.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</INNOButton>
              </div>
            </div>
          </>
        )}
      </section>
    </INNOPage>
  );
}
