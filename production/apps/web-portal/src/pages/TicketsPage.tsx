import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionToolbar, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOState, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
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
  const canManageSla = usePermission('helpdesk.sla.manage');
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

  const pageActions = mode === 'team'
    ? (canManageSla ? <Link className="inno-link-button secondary" to="/helpdesk/sla">SLA Monitor</Link> : undefined)
    : (canCreate ? <Link className="inno-link-button" to="/helpdesk/tickets/new">Create Ticket</Link> : undefined);

  return (
    <INNOPage eyebrow="Helpdesk" title={title} description={helper} actions={pageActions}>
      <INNOCollection>
        <INNOCollectionHeader
          title={mode === 'mine' ? 'My queue' : mode === 'team' ? 'Team tickets' : 'Active tickets'}
          description={query.data ? query.data.totalItems + ' tickets in scope' : 'Operational queue'}
          meta={query.data ? <INNOStatus>{query.data.totalItems} tickets</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search tickets" value={search} onChange={setSearch} placeholder="Search ticket number or subject…" />
          <INNOSelectField label="Status filter" value={status} onChange={setStatus}>
            <option value="all">Status: All</option>
            {(statuses.data ?? []).map((item) => (
              <option key={item.id} value={item.code}>{item.name}</option>
            ))}
          </INNOSelectField>
          <INNOSelectField label="Priority filter" value={priority} onChange={setPriority}>
            <option value="all">Priority: All</option>
            <option value="P1">P1 · Critical</option>
            <option value="P2">P2 · High</option>
            <option value="P3">P3 · Normal</option>
            <option value="P4">P4 · Low</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>Authorization filtered server-side</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <div className="collection-state"><LoadingState label="Loading tickets…" /></div>
        ) : query.isError ? (
          <div className="collection-state"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>
        ) : query.data.items.length === 0 ? (
          <div className="collection-state">
            <INNOState
              compact
              kind={search || status !== 'all' || priority !== 'all' ? 'no-results' : 'empty'}
              title={search || status !== 'all' || priority !== 'all' ? 'No tickets found' : 'No tickets in this queue'}
              description={search || status !== 'all' || priority !== 'all'
                ? 'Try another search or clear the filters.'
                : 'There is no current work in this scoped queue.'}
              action={search || status !== 'all' || priority !== 'all' ? (
                <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); }}>
                  Clear filters
                </INNOButton>
              ) : undefined}
            />
          </div>
        ) : mode === 'all' ? (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th><th>Status</th><th>Priority</th><th>Requester</th><th>Assignee</th><th>SLA</th><th>Updated</th><th className="action-column">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((ticket) => (
                    <tr key={ticket.id}>
                      <td><b>{ticket.subject}</b><div className="table-meta">{ticket.ticketNumber} · {ticket.category ?? 'Uncategorized'} · {ticket.organization ?? '—'}</div></td>
                      <td><INNOStatus tone={ticket.status === 'resolved' ? 'neutral' : 'success'} dot>{ticket.statusName}</INNOStatus></td>
                      <td><span className={'priority-chip ' + ticket.priority.toLowerCase()}>{ticket.priority}</span></td>
                      <td>{ticket.requester}</td>
                      <td>{ticket.assignee ?? ticket.team ?? 'Unassigned'}</td>
                      <td><span className={'sla-chip ' + (ticket.slaState ?? 'active')}>{ticket.slaState ?? '—'}</span>{ticket.slaState ? <div className="table-meta">{ticket.slaElapsedPercent}% elapsed</div> : null}</td>
                      <td>{formatRelative(ticket.updatedAt)}</td>
                      <td className="action-column"><Link className="inno-row-action" to={'/helpdesk/tickets/' + ticket.id} aria-label={'Open ' + ticket.ticketNumber}>Open</Link></td>
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
        ) : (
          <>
            <div className="helpdesk-queue-list helpdesk-operational-queue">
              {query.data.items.map((ticket) => (
                <Link className="helpdesk-queue-row" to={'/helpdesk/tickets/' + ticket.id} key={ticket.id}>
                  <div className="helpdesk-queue-ticket-id">{ticket.ticketNumber}</div>
                  <div className="helpdesk-queue-copy">
                    <b>{ticket.subject}</b>
                    <span>{ticket.team ?? ticket.category ?? 'Uncategorized'} · {ticket.organization ?? ticket.requester}</span>
                  </div>
                  <span className={'priority-chip ' + ticket.priority.toLowerCase()}>{ticket.priority}</span>
                  <INNOStatus tone={ticket.status === 'resolved' ? 'neutral' : 'success'}>{ticket.statusName}</INNOStatus>
                  <div className={'helpdesk-queue-sla ' + (ticket.slaState ?? 'active')}>{ticket.slaState ? ticket.slaElapsedPercent + '% elapsed' : 'No SLA'}</div>
                  <span className="device-row-action" aria-hidden="true"><INNOIcon token="action.next" size={14} /></span>
                </Link>
              ))}
            </div>
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
