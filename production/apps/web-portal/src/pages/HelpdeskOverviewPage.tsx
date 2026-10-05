import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOPage, INNOState, INNOStatus } from '@inno/ui';
import { getHelpdeskOverview } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { TicketSummary } from '../api/types';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const { t: t45n } = useStep45NI18n();
  return (
    <Link className="helpdesk-queue-row" to={'/helpdesk/tickets/' + ticket.id}>
      <div>
        <b>{ticket.subject}</b>
        <span>{ticket.ticketNumber} · {ticket.organization ?? '—'} · {ticket.category ?? t45n('helpdesk.step45n.helpdeskOverview.uncategorized')}</span>
      </div>
      <div className="helpdesk-queue-meta">
        <span className={'priority-chip ' + ticket.priority.toLowerCase()}>{ticket.priority}</span>
        <INNOStatus tone={ticket.status === 'resolved' ? 'neutral' : 'success'} dot>{ticket.statusName}</INNOStatus>
      </div>
    </Link>
  );
}

export function HelpdeskOverviewPage() {
  const { t: t45n } = useStep45NI18n();
  const canCreate = usePermission('helpdesk.ticket.create');
  const query = useQuery({
    queryKey: ['helpdesk', 'overview'],
    queryFn: getHelpdeskOverview,
  });

  return (
    <INNOPage
      eyebrow={t45n('navigation.helpdesk')}
      title={t45n('helpdesk.step45n.helpdeskOverview.serviceDesk')}
      description={t45n('helpdesk.step45n.helpdeskOverview.ticketsWorkloadAndSlaAttentionInOneOperational')}
      actions={canCreate ? <Link className="inno-link-button" to="/helpdesk/tickets/new">{t45n('helpdesk.step45n.helpdeskOverview.createTicket')}</Link> : undefined}
    >

      {query.isPending ? <LoadingState label={t45n('helpdesk.step45n.helpdeskOverview.loadingHelpdesk')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip helpdesk-stat-strip">
            <div><span>{t45n('helpdesk.step45n.helpdeskOverview.openTickets')}</span><b>{query.data.openTickets}</b><small>{t45n('helpdesk.step45n.helpdeskOverview.insideYourEffectiveScope')}</small></div>
            <div><span>{t45n('helpdesk.step45n.helpdeskOverview.assignedToMe')}</span><b>{query.data.assignedToMe}</b><small>{t45n('helpdesk.step45n.helpdeskOverview.yourActiveQueue')}</small></div>
            <div><span>{t45n('helpdesk.step45n.helpdeskOverview.dueToday')}</span><b>{query.data.dueToday}</b><small>{query.data.unassigned} {t45n('assets.step45n.assetsOverview.unassigned')}</small></div>
            <div><span>{t45n('helpdesk.step45n.helpdeskOverview.slaAtRisk')}</span><b>{query.data.slaAtRisk}</b><small>{query.data.slaBreached} {t45n('helpdesk.step45n.helpdeskOverview.breached')}</small></div>
          </div>

          <div className="helpdesk-overview-grid">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>{t45n('helpdesk.step45n.helpdeskOverview.priorityTickets')}</h3>
                  <p>{t45n('helpdesk.step45n.helpdeskOverview.highestPriorityWorkVisibleInYourQueue')}</p>
                </div>
                <Link className="open-resource" to="/helpdesk/tickets">{t45n('helpdesk.step45n.helpdeskOverview.viewAllTickets')}</Link>
              </div>
              <div className="helpdesk-queue-list">
                {query.data.priorityTickets.length
                  ? query.data.priorityTickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
                  : <INNOState compact kind="empty" title={t45n('helpdesk.step45n.helpdeskOverview.noOpenTickets')} description={t45n('helpdesk.step45n.helpdeskOverview.noActivePriorityTicketsAreVisibleInYour')} />}
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>{t45n('helpdesk.step45n.helpdeskOverview.assignedToMe')}</h3>
                  <p>{t45n('helpdesk.step45n.helpdeskOverview.yourCurrentActiveQueue')}</p>
                </div>
                <Link className="open-resource" to="/helpdesk/assigned">{t45n('helpdesk.step45n.helpdeskOverview.viewQueue')}</Link>
              </div>
              <div className="helpdesk-queue-list">
                {query.data.myTickets.length
                  ? query.data.myTickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)
                  : <INNOState compact kind="empty" title={t45n('helpdesk.step45n.helpdeskOverview.nothingAssignedToYou')} description={t45n('helpdesk.step45n.helpdeskOverview.assignedTicketsWillAppearHereWhenWorkEnters')} />}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </INNOPage>
  );
}
