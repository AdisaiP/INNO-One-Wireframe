import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOPage } from '@inno/ui';
import { getHelpdeskOverview } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { TicketSummary } from '../api/types';

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  return (
    <Link className="helpdesk-queue-row" to={'/helpdesk/tickets/' + ticket.id}>
      <div>
        <b>{ticket.subject}</b>
        <span>{ticket.ticketNumber} · {ticket.organization ?? '—'} · {ticket.category ?? 'Uncategorized'}</span>
      </div>
      <div className="helpdesk-queue-meta">
        <span className={'priority-chip ' + ticket.priority.toLowerCase()}>{ticket.priority}</span>
        <span className={'status-dot ' + (ticket.status === 'resolved' ? 'offline' : 'online')}>{ticket.statusName}</span>
      </div>
    </Link>
  );
}

export function HelpdeskOverviewPage() {
  const canCreate = usePermission('helpdesk.ticket.create');
  const query = useQuery({
    queryKey: ['helpdesk', 'overview'],
    queryFn: getHelpdeskOverview,
  });

  return (
    <INNOPage eyebrow="Helpdesk" title="Service Desk">
      <div className="page-intro-row">
        <p className="page-helper">Tickets, workload and SLA attention in one operational view.</p>
        {canCreate ? <Link className="inno-link-button" to="/helpdesk/tickets/new">Create Ticket</Link> : null}
      </div>

      {query.isPending ? <LoadingState label="Loading Helpdesk…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip helpdesk-stat-strip">
            <div><span>Open tickets</span><b>{query.data.openTickets}</b><small>Inside your effective scope</small></div>
            <div><span>Assigned to me</span><b>{query.data.assignedToMe}</b><small>Your active queue</small></div>
            <div><span>Due today</span><b>{query.data.dueToday}</b><small>{query.data.unassigned} unassigned</small></div>
            <div><span>SLA at risk</span><b>{query.data.slaAtRisk}</b><small>{query.data.slaBreached} breached</small></div>
          </div>

          <div className="helpdesk-overview-grid">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>Priority tickets</h3>
                  <p>Highest-priority work visible in your queue.</p>
                </div>
                <Link className="open-resource" to="/helpdesk/tickets">View all tickets</Link>
              </div>
              <div className="helpdesk-queue-list">
                {query.data.priorityTickets.length
                  ? query.data.priorityTickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
                  : <div className="compact-empty">No open tickets in scope.</div>}
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>Assigned to me</h3>
                  <p>Your current active queue.</p>
                </div>
                <Link className="open-resource" to="/helpdesk/assigned">View queue</Link>
              </div>
              <div className="helpdesk-queue-list">
                {query.data.myTickets.length
                  ? query.data.myTickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
                  : <div className="compact-empty">Nothing is assigned to you.</div>}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </INNOPage>
  );
}
