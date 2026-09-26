import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOPage, INNOState } from '@inno/ui';
import { getTicketStatuses, getTickets } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

export type TicketQueueMode = 'all' | 'mine' | 'team';

function formatRelative(value: string) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.round(minutes / 60) + 'h ago';
  return date.toLocaleDateString();
}

export function TicketsPage({ mode = 'all' }: { mode?: TicketQueueMode }) {
  const canCreate = usePermission('helpdesk.ticket.create');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch, status, priority, mode]);

  const statuses = useQuery({
    queryKey: ['helpdesk', 'statuses'],
    queryFn: getTicketStatuses,
  });
  const query = useQuery({
    queryKey: ['helpdesk', 'tickets', mode, page, deferredSearch, status, priority],
    queryFn: () => getTickets({
      page,
      pageSize: 25,
      search: deferredSearch,
      status,
      priority,
      assignedToMe: mode === 'mine',
      sort: 'updatedAt',
      order: 'desc',
    }),
  });

  const title = mode === 'mine' ? 'Assigned to Me' : mode === 'team' ? 'Team Queue' : 'Tickets';
  const helper = mode === 'mine'
    ? 'Tickets currently assigned to your account.'
    : mode === 'team'
      ? 'Scoped operational queue for your support coverage.'
      : 'Search and manage support tickets inside your effective access scope.';

  return (
    <INNOPage eyebrow="Helpdesk" title={title}>
      <div className="page-intro-row">
        <p className="page-helper">{helper}</p>
        {canCreate ? <Link className="inno-link-button" to="/helpdesk/tickets/new">Create Ticket</Link> : null}
      </div>

      <section className="collection-card">
        <div className="collection-head">
          <div>
            <h2>{title}</h2>
            <p>{query.data ? query.data.totalItems + ' tickets in scope' : 'Operational queue'}</p>
          </div>
          {query.data ? <span className="prod-tag">{query.data.totalItems} tickets</span> : null}
        </div>

        <div className="collection-toolbar">
          <label className="search-field">
            <span className="sr-only">Search tickets</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ticket number or subject…"
            />
          </label>
          <label>
            <span className="sr-only">Status filter</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Status: All</option>
              {(statuses.data ?? []).map((item) => (
                <option key={item.id} value={item.code}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Priority filter</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="all">Priority: All</option>
              <option value="P1">P1 · Critical</option>
              <option value="P2">P2 · High</option>
              <option value="P3">P3 · Normal</option>
              <option value="P4">P4 · Low</option>
            </select>
          </label>
          <span className="toolbar-spacer" />
          <span className="collection-scope">Authorization filtered server-side</span>
        </div>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading tickets…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              title={search || status !== 'all' || priority !== 'all' ? 'No tickets found' : 'No tickets in this queue'}
              description={search || status !== 'all' || priority !== 'all'
                ? 'Try another search or clear the filters.'
                : 'There is no current work in this scoped queue.'}
              action={search || status !== 'all' || priority !== 'all' ? (
                <div className="state-action">
                  <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); }}>
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
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Requester</th>
                    <th>Assignee</th>
                    <th>SLA</th>
                    <th>Updated</th>
                    <th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <b>{ticket.subject}</b>
                        <div className="table-meta">{ticket.ticketNumber} · {ticket.category ?? 'Uncategorized'} · {ticket.organization ?? '—'}</div>
                      </td>
                      <td><span className={'status-dot ' + (ticket.status === 'resolved' ? 'offline' : 'online')}>{ticket.statusName}</span></td>
                      <td><span className={'priority-chip ' + ticket.priority.toLowerCase()}>{ticket.priority}</span></td>
                      <td>{ticket.requester}</td>
                      <td>{ticket.assignee ?? ticket.team ?? 'Unassigned'}</td>
                      <td>
                        <span className={'sla-chip ' + (ticket.slaState ?? 'active')}>{ticket.slaState ?? '—'}</span>
                        {ticket.slaState ? <div className="table-meta">{ticket.slaElapsedPercent}% elapsed</div> : null}
                      </td>
                      <td>{formatRelative(ticket.updatedAt)}</td>
                      <td className="action-column">
                        <Link className="open-resource" to={'/helpdesk/tickets/' + ticket.id}>Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="collection-footer">
              <span>
                Showing {(query.data.page - 1) * query.data.pageSize + 1}–
                {Math.min(query.data.page * query.data.pageSize, query.data.totalItems)} of {query.data.totalItems}
              </span>
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
