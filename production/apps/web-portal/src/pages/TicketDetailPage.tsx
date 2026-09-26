import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { INNOButton, INNOPage } from '@inno/ui';
import {
  getTicket,
  reassignTicket,
  replyToTicket,
  resolveTicket,
} from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function minutesLabel(minutes: number) {
  if (minutes < 60) return minutes + ' min';
  const hours = minutes / 60;
  return Number.isInteger(hours) ? hours + ' hours' : hours.toFixed(1) + ' hours';
}

export function TicketDetailPage() {
  const { ticketId = '' } = useParams();
  const queryClient = useQueryClient();
  const canReply = usePermission('helpdesk.ticket.reply');
  const canAssign = usePermission('helpdesk.ticket.assign');
  const canResolve = usePermission('helpdesk.ticket.resolve');
  const [replyBody, setReplyBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public');
  const [showAssign, setShowAssign] = useState(false);
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [team, setTeam] = useState('Support L1');
  const [actionError, setActionError] = useState('');

  const ticketQuery = useQuery({
    queryKey: ['helpdesk', 'ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    enabled: Boolean(ticketId),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['helpdesk'] });
  };

  const replyMutation = useMutation({
    mutationFn: () => replyToTicket(ticketId, { body: replyBody, visibility }),
    onSuccess: async () => {
      setReplyBody('');
      setVisibility('public');
      setActionError('');
      await refresh();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: () => reassignTicket(ticketId, ticketQuery.data?.eTag ?? '', {
      assigneeUserId: assigneeUserId || undefined,
      team,
    }),
    onSuccess: async () => {
      setShowAssign(false);
      setActionError('');
      await refresh();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveTicket(ticketId, ticketQuery.data?.eTag ?? '', {
      resolutionCode: 'fixed',
      note: 'Resolved from the Helpdesk workspace',
    }),
    onSuccess: async () => {
      setActionError('');
      await refresh();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  if (ticketQuery.isPending) {
    return <div className="page-loading-wrap"><LoadingState label="Loading ticket…" /></div>;
  }

  if (ticketQuery.isError) {
    return <div className="page-error-wrap"><ErrorState error={ticketQuery.error} retry={() => void ticketQuery.refetch()} /></div>;
  }

  const ticket = ticketQuery.data;
  const resolved = ticket.status === 'resolved';

  return (
    <INNOPage eyebrow="Helpdesk" title={ticket.ticketNumber}>
      <div className="resource-breadcrumb">
        <Link to="/helpdesk">Helpdesk</Link><span>›</span>
        <Link to="/helpdesk/tickets">Tickets</Link><span>›</span>
        <span>{ticket.ticketNumber}</span>
      </div>

      <div className="resource-head-actions helpdesk-resource-head">
        <div>
          <div className="resource-title-line">
            <h2>{ticket.subject}</h2>
            <span className={'status-dot ' + (resolved ? 'offline' : 'online')}>{ticket.statusName}</span>
          </div>
          <div className="resource-meta-line">
            <span>{ticket.ticketNumber}</span><span>·</span>
            <span>{ticket.category?.name ?? 'Uncategorized'}</span><span>·</span>
            <span>{ticket.organization?.name ?? '—'}</span>
          </div>
        </div>
        <div className="ticket-resource-actions">
          {canResolve && !resolved ? (
            <INNOButton
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate()}
            >
              {resolveMutation.isPending ? 'Resolving…' : 'Resolve'}
            </INNOButton>
          ) : null}
          {canAssign && !resolved ? (
            <INNOButton variant="secondary" onClick={() => setShowAssign((value) => !value)}>
              Reassign
            </INNOButton>
          ) : null}
        </div>
      </div>

      {actionError ? <div className="form-error ticket-action-error" role="alert">{actionError}</div> : null}

      <div className="production-stat-strip helpdesk-detail-stats">
        <div><span>Priority</span><b>{ticket.priority}</b><small>Urgency: {ticket.urgency}</small></div>
        <div><span>Assignee</span><b>{ticket.assignee?.name ?? ticket.team ?? 'Unassigned'}</b><small>{ticket.team ?? 'No queue'}</small></div>
        <div>
          <span>SLA</span>
          <b>{ticket.sla ? ticket.sla.elapsedPercent + '% elapsed' : '—'}</b>
          <small>{ticket.sla?.state ?? 'No SLA'}</small>
        </div>
        <div><span>Requester</span><b>{ticket.requester.name}</b><small>{ticket.organization?.name ?? '—'}</small></div>
      </div>

      {showAssign ? (
        <section className="prod-panel ticket-assign-panel">
          <div className="prod-panel-head">
            <div><h3>Reassign ticket</h3><p>Choose queue and assignee.</p></div>
          </div>
          <div className="editor-form">
            <div className="editor-grid">
              <label className="field-block">
                <span>Team</span>
                <select value={team} onChange={(event) => setTeam(event.target.value)}>
                  <option>Support L1</option>
                  <option>Network Support</option>
                  <option>Application Team</option>
                </select>
              </label>
              <label className="field-block">
                <span>Assignee</span>
                <select value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)}>
                  <option value="">Queue only</option>
                  {ticket.assigneeOptions.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="editor-footer">
              <INNOButton variant="secondary" onClick={() => setShowAssign(false)}>Cancel</INNOButton>
              <INNOButton disabled={assignMutation.isPending} onClick={() => assignMutation.mutate()}>
                {assignMutation.isPending ? 'Reassigning…' : 'Reassign'}
              </INNOButton>
            </div>
          </div>
        </section>
      ) : null}

      <div className="ticket-detail-grid">
        <div className="panel-stack">
          <section className="prod-panel">
            <div className="prod-panel-head">
              <div><h3>Conversation</h3><p>Requester and support updates.</p></div>
              <span className="prod-tag">{ticket.messages.length} messages</span>
            </div>
            <div className="ticket-thread">
              {ticket.messages.map((message) => (
                <article className={'ticket-message ' + (message.isRequester ? 'requester' : 'agent')} key={message.id}>
                  <div className="ticket-message-avatar">{message.authorName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</div>
                  <div>
                    <div className="ticket-message-head">
                      <b>{message.authorName}</b>
                      {message.visibility === 'internal' ? <span className="prod-tag">Internal note</span> : null}
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                    <div className="ticket-message-body">{message.body}</div>
                  </div>
                </article>
              ))}

              {canReply && !resolved ? (
                <div className="ticket-composer">
                  <label className="field-block">
                    <span>{visibility === 'internal' ? 'Internal note' : 'Reply'}</span>
                    <textarea
                      rows={5}
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder={visibility === 'internal' ? 'Write an internal note…' : 'Write a reply…'}
                    />
                  </label>
                  <div className="ticket-composer-foot">
                    <label className="ticket-note-toggle">
                      <input
                        type="checkbox"
                        checked={visibility === 'internal'}
                        onChange={(event) => setVisibility(event.target.checked ? 'internal' : 'public')}
                      />
                      Internal note
                    </label>
                    <INNOButton
                      disabled={replyMutation.isPending || !replyBody.trim()}
                      onClick={() => replyMutation.mutate()}
                    >
                      {replyMutation.isPending ? 'Sending…' : visibility === 'internal' ? 'Add Note' : 'Send Reply'}
                    </INNOButton>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Activity</h3><p>Ticket status and assignment history.</p></div></div>
            <div className="ticket-activity-list">
              {ticket.activities.map((activity) => (
                <div className="ticket-activity-row" key={activity.id}>
                  <span className="ticket-activity-mark" aria-hidden="true" />
                  <div>
                    <b>{activity.title}</b>
                    {activity.detail ? <span>{activity.detail}</span> : null}
                  </div>
                  <time>{formatDate(activity.occurredAt)}</time>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="panel-stack">
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Properties</h3><p>Canonical ticket context.</p></div></div>
            <div className="production-kv-grid ticket-properties">
              <div className="kv-row"><span>Requester</span><b>{ticket.requester.name}</b></div>
              <div className="kv-row"><span>Organization</span><b>{ticket.organization?.name ?? '—'}</b></div>
              <div className="kv-row"><span>Category</span><b>{ticket.category?.name ?? '—'}</b></div>
              <div className="kv-row"><span>Impact</span><b>{ticket.impact}</b></div>
              <div className="kv-row"><span>Urgency</span><b>{ticket.urgency}</b></div>
              <div className="kv-row"><span>Priority</span><b>{ticket.priority}</b></div>
              <div className="kv-row"><span>Assignee</span><b>{ticket.assignee?.name ?? '—'}</b></div>
              <div className="kv-row"><span>Team</span><b>{ticket.team ?? '—'}</b></div>
            </div>
          </section>

          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>SLA</h3><p>Resolved service target for this ticket.</p></div></div>
            {ticket.sla ? (
              <div className="ticket-sla-panel">
                <div className="kv-row"><span>Response</span><b>{minutesLabel(ticket.sla.responseMinutes)}</b></div>
                <div className="kv-row"><span>Resolution</span><b>{minutesLabel(ticket.sla.resolutionMinutes)}</b></div>
                <div className="kv-row"><span>State</span><b>{ticket.sla.state}</b></div>
                <div className="sla-progress"><span style={{ width: Math.min(ticket.sla.elapsedPercent, 100) + '%' }} /></div>
                <small>Resolution due {formatDate(ticket.sla.resolutionDueAt)}</small>
              </div>
            ) : <div className="compact-empty">No SLA policy resolved.</div>}
          </section>

          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Related context</h3><p>Cross-module references only.</p></div></div>
            {ticket.relatedDevice ? (
              <Link className="related-resource-row" to={'/devices/' + ticket.relatedDevice.id}>
                <div>
                  <b>{ticket.relatedDevice.name}</b>
                  <span>{ticket.relatedDevice.operatingSystem ?? 'Unknown OS'} · {ticket.relatedDevice.status}</span>
                </div>
                <span>Open</span>
              </Link>
            ) : <div className="compact-empty">No Device linked to this ticket.</div>}
          </section>
        </aside>
      </div>
    </INNOPage>
  );
}
