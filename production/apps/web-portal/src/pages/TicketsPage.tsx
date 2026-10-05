import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOIcon, INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState, INNOCollectionToolbar, INNOPage, INNOPagination, INNOSearchField, INNOSelectField, INNOStatus, INNOTableWrap, INNOToolbarMeta, INNOToolbarSpacer } from '@inno/ui';
import { getTicketStatuses, getTickets } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export type TicketQueueMode = 'all' | 'mine' | 'team';

function formatRelative(
  value: string,
  locale: 'en-US' | 'th-TH',
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return t('common.step45n.workspacePages.time.now');
  if (minutes < 60) return t('common.step45n.workspacePages.time.minutesAgo', { count: minutes });
  if (minutes < 1440) return t('common.step45n.workspacePages.time.hoursAgo', { count: Math.round(minutes / 60) });
  const formatLocale = locale === 'th-TH' ? 'th-TH-u-ca-gregory-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(formatLocale).format(date);
}

function ticketStatusLabel(
  code: string,
  fallback: string,
  t: (key: string) => string,
) {
  if (code === 'open') return t('helpdesk.step45n.tickets.status.open');
  if (code === 'in_progress') return t('helpdesk.step45n.tickets.status.inProgress');
  if (code === 'waiting') return t('helpdesk.step45n.tickets.status.waiting');
  if (code === 'resolved') return t('helpdesk.step45n.tickets.status.resolved');
  return fallback;
}

export function TicketsPage({ mode = 'all' }: { mode?: TicketQueueMode }) {
  const { t: t45n, locale } = useStep45NI18n();
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

  const title = mode === 'mine'
    ? t45n('helpdesk.step45n.tickets.assignedTitle')
    : mode === 'team'
      ? t45n('helpdesk.step45n.tickets.teamTitle')
      : t45n('helpdesk.step45n.tickets.title');
  const helper = mode === 'mine'
    ? t45n('helpdesk.step45n.tickets.assignedDescription')
    : mode === 'team'
      ? t45n('helpdesk.step45n.tickets.teamDescription')
      : t45n('helpdesk.step45n.tickets.description');

  const pageActions = mode === 'team'
    ? (canManageSla ? <Link className="inno-link-button secondary" to="/helpdesk/sla">{t45n('helpdesk.step45n.tickets.slaMonitor')}</Link> : undefined)
    : (canCreate ? <Link className="inno-link-button" to="/helpdesk/tickets/new">{t45n('helpdesk.step45n.helpdeskOverview.createTicket')}</Link> : undefined);

  return (
    <INNOPage eyebrow={t45n('navigation.helpdesk')} title={title} description={helper} actions={pageActions}>
      <INNOCollection>
        <INNOCollectionHeader
          title={mode === 'mine' ? t45n('helpdesk.step45n.tickets.myQueue') : mode === 'team' ? t45n('helpdesk.step45n.tickets.teamTickets') : t45n('helpdesk.step45n.tickets.activeTickets')}
          description={query.data ? t45n('helpdesk.step45n.tickets.inScope', { count: query.data.totalItems }) : t45n('helpdesk.step45n.tickets.operationalQueue')}
          meta={query.data ? <INNOStatus>{query.data.totalItems} {t45n('helpdesk.step45n.tickets.tickets')}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label={t45n('helpdesk.step45n.tickets.searchTickets')} value={search} onChange={setSearch} placeholder={t45n('helpdesk.step45n.tickets.searchTicketNumberOrSubject')} />
          <INNOSelectField label={t45n('assets.step45n.assetInventory.statusFilter')} value={status} onChange={setStatus}>
            <option value="all">{t45n('admin.step45n.adminUsers.statusAll')}</option>
            {(statuses.data ?? []).map((item) => (
              <option key={item.id} value={item.code}>{ticketStatusLabel(item.code, item.name, t45n)}</option>
            ))}
          </INNOSelectField>
          <INNOSelectField label={t45n('helpdesk.step45n.tickets.priorityFilter')} value={priority} onChange={setPriority}>
            <option value="all">{t45n('helpdesk.step45n.tickets.priorityAll')}</option>
            <option value="P1">{t45n('helpdesk.step45n.tickets.p1Critical')}</option>
            <option value="P2">{t45n('helpdesk.step45n.tickets.p2High')}</option>
            <option value="P3">{t45n('helpdesk.step45n.tickets.p3Normal')}</option>
            <option value="P4">{t45n('helpdesk.step45n.tickets.p4Low')}</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
          <INNOToolbarMeta>{t45n('assets.step45n.assetInventory.authorizationFilteredServerSide')}</INNOToolbarMeta>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label={t45n('helpdesk.step45n.tickets.loadingTickets')} />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState
            kind={search || status !== 'all' || priority !== 'all' ? 'no-results' : 'empty'}
            title={search || status !== 'all' || priority !== 'all' ? t45n('helpdesk.step45n.tickets.noTicketsFound') : t45n('helpdesk.step45n.tickets.noTicketsInThisQueue')}
            description={search || status !== 'all' || priority !== 'all'
              ? t45n('admin.step45n.adminAccessScopes.tryAnotherSearchOrClearTheFilters')
              : t45n('helpdesk.step45n.tickets.thereIsNoCurrentWorkInThisScoped')}
            action={search || status !== 'all' || priority !== 'all' ? (
              <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); }}>
                {t45n('admin.step45n.adminAccessScopes.clearFilters')}</INNOButton>
            ) : undefined}
          />
        ) : mode === 'all' ? (
          <>
            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr>
                    <th>{t45n('reports.column.ticketNumber')}</th><th>{t45n('reports.runs.status')}</th><th>{t45n('reports.column.priority')}</th><th>{t45n('reports.column.requester')}</th><th>{t45n('reports.column.assignee')}</th><th>{t45n('helpdesk.step45n.ticketDetail.sla')}</th><th>{t45n('reports.table.updated')}</th><th className="action-column">{t45n('reports.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((ticket) => (
                    <tr key={ticket.id}>
                      <td><b>{ticket.subject}</b><div className="table-meta">{ticket.ticketNumber} · {ticket.category ?? t45n('helpdesk.step45n.helpdeskOverview.uncategorized')} · {ticket.organization ?? '—'}</div></td>
                      <td><INNOStatus tone={ticket.status === 'resolved' ? 'neutral' : 'success'} dot>{ticketStatusLabel(ticket.status, ticket.statusName, t45n)}</INNOStatus></td>
                      <td><span className={'priority-chip ' + ticket.priority.toLowerCase()}>{ticket.priority}</span></td>
                      <td>{ticket.requester}</td>
                      <td>{ticket.assignee ?? ticket.team ?? t45n('assets.automation.editor.owner.unassigned')}</td>
                      <td><span className={'sla-chip ' + (ticket.slaState ?? 'active')}>{ticket.slaState ?? '—'}</span>{ticket.slaState ? <div className="table-meta">{ticket.slaElapsedPercent}{t45n('helpdesk.step45n.tickets.elapsed')}</div> : null}</td>
                      <td>{formatRelative(ticket.updatedAt, locale, t45n)}</td>
                      <td className="action-column"><RouterRowAction to={'/helpdesk/tickets/' + ticket.id} ariaLabel={t45n('helpdesk.step45n.tickets.openTicket', { ticketNumber: ticket.ticketNumber })} /></td>
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
                    <span>{ticket.team ?? ticket.category ?? t45n('helpdesk.step45n.helpdeskOverview.uncategorized')} · {ticket.organization ?? ticket.requester}</span>
                  </div>
                  <span className={'priority-chip ' + ticket.priority.toLowerCase()}>{ticket.priority}</span>
                  <INNOStatus tone={ticket.status === 'resolved' ? 'neutral' : 'success'}>{ticketStatusLabel(ticket.status, ticket.statusName, t45n)}</INNOStatus>
                  <div className={'helpdesk-queue-sla ' + (ticket.slaState ?? 'active')}>{ticket.slaState ? ticket.slaElapsedPercent + t45n('helpdesk.step45n.tickets.elapsed') : t45n('helpdesk.step45n.tickets.noSla')}</div>
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
