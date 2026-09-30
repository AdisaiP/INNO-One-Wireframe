import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOStatus, INNOTableWrap } from '@inno/ui';
import { getAutomationRules } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';

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
    <INNOPage
      eyebrow="Helpdesk · Manage"
      title="Automation"
      description="Assignment, routing, classification and SLA escalation rules."
      actions={canManage ? <Link className="inno-link-button" to="/helpdesk/automation/new">New Rule</Link> : undefined}
    >
      <div className="production-stat-strip helpdesk-stat-strip">
        <div><span>Automation rules</span><b>{query.data?.totalItems ?? 0}</b><small>{stats.active} active · {stats.paused} paused</small></div>
        <div><span>Executions</span><b>{stats.executions}</b><small>Visible rule sample</small></div>
        <div><span>Rule types</span><b>{new Set((query.data?.items ?? []).map((item) => item.ruleType)).size}</b><small>Assignment / escalation / routing</small></div>
        <div><span>Last execution</span><b>{formatRelative(stats.last)}</b><small>Automation worker history</small></div>
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title="Automation rules"
          description="Open one rule to edit its trigger, condition and action."
          meta={query.data ? <INNOStatus>{query.data.totalItems} rules</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label="Search automation rules"
            value={search}
            onChange={setSearch}
            placeholder="Search rule, trigger or action…"
          />
          <INNOSelectField label="Filter rules by status" value={status} onChange={setStatus}>
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </INNOSelectField>
          <INNOSelectField label="Filter rules by type" value={type} onChange={setType}>
            <option value="all">Type: All</option>
            <option value="assignment">Assignment</option>
            <option value="escalation">Escalation</option>
            <option value="classification">Classification</option>
            <option value="routing">Routing</option>
          </INNOSelectField>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label="Loading automation rules…" />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || status !== 'all' || type !== 'all' ? 'no-results' : 'empty'}
            title={search || status !== 'all' || type !== 'all' ? 'No automation rules found' : 'No automation rules yet'}
            description={search || status !== 'all' || type !== 'all'
              ? 'Try another search or clear the filters.'
              : 'Create the first rule when automation is ready for this workspace.'}
            action={search || status !== 'all' || type !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setType('all'); }}>Clear filters</INNOButton>
              : undefined}
          />
        ) : (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead><tr><th>Rule</th><th>Type</th><th>Trigger</th><th>Primary action</th><th>Status</th><th>Last execution</th><th className="action-column">Action</th></tr></thead>
                <tbody>
                  {query.data.items.map((rule) => (
                    <tr key={rule.id}>
                      <td><b>{rule.name}</b><div className="table-meta">{rule.executionCount} executions</div></td>
                      <td>{rule.ruleType}</td>
                      <td>{rule.trigger.replaceAll('_', ' ')}</td>
                      <td>{rule.primaryAction}</td>
                      <td><INNOStatus tone={rule.status === 'active' ? 'success' : 'neutral'}>{rule.status === 'active' ? 'Active' : 'Paused'}</INNOStatus></td>
                      <td>{formatRelative(rule.lastExecutedAt)}</td>
                      <td className="action-column"><Link className="inno-row-action" to={'/helpdesk/automation/' + rule.id} aria-label={'Open ' + rule.name}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalItems={query.data.totalItems}
              pageSize={query.data.pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
