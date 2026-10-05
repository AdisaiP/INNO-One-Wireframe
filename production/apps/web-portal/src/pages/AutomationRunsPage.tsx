import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNODrawer,
  INNOPage,
  INNOPagination,
  INNORowActions,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  ApiError,
  getHelpdeskAutomationDefinition,
  getHelpdeskAutomationRun,
  getHelpdeskAutomationRuns,
  getTickets,
  startHelpdeskAutomationRun,
} from '../api/client';
import type { AutomationRunStatus } from '../api/types';
import { usePermission } from '../app/ProfileContext';
import {
  CollectionErrorState,
  CollectionLoadingState,
  ErrorState,
  LoadingState,
} from '../components/Feedback';
import './WorkflowProductPages.css';
import { useI18n as useStep45NI18n } from '@inno/i18n';

const ACTIVE_STATUSES = new Set<AutomationRunStatus>(['queued', 'running', 'waiting']);

function statusTone(status: AutomationRunStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'waiting') return 'warning';
  return 'neutral';
}

function durationMs(startedAt?: string | null, completedAt?: string | null) {
  if (!startedAt || !completedAt) return null;
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

export function AutomationRunsPage() {
  const { t: t45n } = useStep45NI18n();
  const { t, formatDateTime } = useI18n();
  const { automationId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = usePermission('helpdesk.automation.manage');
  const canViewTickets = usePermission('helpdesk.ticket.view');
  const canStartRun = canManage && canViewTickets;
  const [page, setPage] = useState(1);
  const [ticketId, setTicketId] = useState('');
  const selectedRunId = params.get('run') ?? '';

  const definition = useQuery({
    queryKey: ['helpdesk', 'automation-definition', automationId],
    queryFn: () => getHelpdeskAutomationDefinition(automationId),
    enabled: Boolean(automationId),
  });

  const tickets = useQuery({
    queryKey: ['helpdesk', 'tickets', 'automation-run-context'],
    queryFn: () => getTickets({ page: 1, pageSize: 100, sort: 'updatedAt', order: 'desc' }),
    enabled: canViewTickets,
    staleTime: 30_000,
  });

  const runs = useQuery({
    queryKey: ['helpdesk', 'automation-runs', automationId, page],
    queryFn: () => getHelpdeskAutomationRuns(automationId, { page, pageSize: 25 }),
    enabled: Boolean(automationId),
    refetchInterval: (query) => (
      query.state.data?.items.some((item) => ACTIVE_STATUSES.has(item.status))
        ? 750
        : false
    ),
  });

  const selectedRun = useQuery({
    queryKey: ['helpdesk', 'automation-run', automationId, selectedRunId],
    queryFn: () => getHelpdeskAutomationRun(automationId, selectedRunId),
    enabled: Boolean(automationId && selectedRunId),
    refetchInterval: (query) => (
      query.state.data && ACTIVE_STATUSES.has(query.state.data.status)
        ? 500
        : false
    ),
  });

  const startRun = useMutation({
    mutationFn: () => startHelpdeskAutomationRun(automationId, { ticketId }),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({
        queryKey: ['helpdesk', 'automation-runs', automationId],
      });
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set('run', run.id);
        return next;
      }, { replace: true });
    },
  });

  useEffect(() => {
    if (!ticketId && tickets.data?.items[0]) {
      setTicketId(tickets.data.items[0].id);
    }
  }, [ticketId, tickets.data]);

  const ticketMap = useMemo(
    () => new Map((tickets.data?.items ?? []).map((ticket) => [ticket.id, ticket])),
    [tickets.data],
  );

  const closeDetail = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('run');
      return next;
    }, { replace: true });
  };

  const openRun = (runId: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('run', runId);
      return next;
    }, { replace: true });
  };

  if (definition.isPending) {
    return <div className="page-loading-wrap"><LoadingState /></div>;
  }
  if (definition.isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState error={definition.error} retry={() => void definition.refetch()} />
      </div>
    );
  }

  const definitionData = definition.data;
  const runtimeError = (code?: string | null, fallback?: string | null) => {
    if (!code) return fallback || t('helpdesk.automation.runs.errorFallback');
    const key = 'helpdesk.automation.runs.error.' + code;
    const translated = t(key);
    return translated === key
      ? fallback || t('helpdesk.automation.runs.errorFallback')
      : translated;
  };
  const runError = startRun.error instanceof ApiError
    ? runtimeError(startRun.error.problem?.code, startRun.error.problem?.detail)
    : startRun.error instanceof Error
      ? startRun.error.message
      : '';

  return (
    <INNOPage
      eyebrow={t('helpdesk.automation.runs.eyebrow')}
      title={t('helpdesk.automation.runs.title', { name: definitionData.name })}
      description={t('helpdesk.automation.runs.description')}
      actions={(
        <Link className="inno-link-button secondary" to={'/helpdesk/automation/' + automationId}>
          {t('helpdesk.automation.runs.back')}
        </Link>
      )}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('helpdesk.automation.runs.boundary.title')}</b>
        <span>
          {t('helpdesk.automation.runs.boundary.description', {
            version: definitionData.version,
          })}
        </span>
      </div>

      {canStartRun ? (
        <section className="automation-run-launcher" aria-label={t('helpdesk.automation.runs.start')}>
          <div>
            <b>{t('helpdesk.automation.runs.start')}</b>
            <span>{t('helpdesk.automation.runs.startDescription')}</span>
          </div>
          <label className="field-block">
            <span>{t('helpdesk.automation.runs.ticket')}</span>
            <select
              value={ticketId}
              onChange={(event) => setTicketId(event.target.value)}
              disabled={tickets.isPending || startRun.isPending}
            >
              <option value="">{t('helpdesk.automation.runs.ticketPlaceholder')}</option>
              {tickets.data?.items.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.ticketNumber} · {ticket.subject}
                </option>
              ))}
            </select>
          </label>
          <INNOButton
            type="button"
            disabled={!ticketId || tickets.isPending}
            busy={startRun.isPending}
            onClick={() => { if (!startRun.isPending && ticketId) startRun.mutate(); }}
          >
            {t('helpdesk.automation.runs.run')}
          </INNOButton>
          {runError ? <span className="field-error">{runError}</span> : null}
        </section>
      ) : null}

      <INNOCollection className="automation-runs-collection">
        <INNOCollectionHeader
          title={t('helpdesk.automation.runs.list.title')}
          description={t('helpdesk.automation.runs.list.description')}
          meta={runs.data ? (
            <INNOStatus>{t('helpdesk.automation.runs.count', { count: runs.data.totalItems })}</INNOStatus>
          ) : undefined}
        />

        {runs.isPending ? <CollectionLoadingState label={t('helpdesk.automation.runs.loading')} /> : null}
        {runs.isError ? <CollectionErrorState error={runs.error} retry={() => void runs.refetch()} /> : null}
        {runs.data?.items.length === 0 ? (
          <INNOCollectionState
            kind="empty"
            title={t('helpdesk.automation.runs.empty.title')}
            description={t('helpdesk.automation.runs.empty.description')}
          />
        ) : null}

        {runs.data?.items.length ? (
          <>
            <INNOTableWrap width="wide" stickyAction>
              <table>
                <thead>
                  <tr>
                    <th>{t('helpdesk.automation.runs.table.started')}</th>
                    <th>{t('helpdesk.automation.runs.table.version')}</th>
                    <th>{t('helpdesk.automation.runs.table.ticket')}</th>
                    <th>{t('helpdesk.automation.runs.table.status')}</th>
                    <th>{t('helpdesk.automation.runs.table.attempt')}</th>
                    <th className="action-column">{t('helpdesk.automation.runs.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.items.map((run) => {
                    const ticket = run.ticketId ? ticketMap.get(run.ticketId) : undefined;
                    return (
                      <tr key={run.id} className={run.id === selectedRunId ? 'selected-row' : undefined}>
                        <td>
                          {formatDateTime(run.startedAt ?? run.createdAt)}
                          <div className="table-meta">{run.id}</div>
                        </td>
                        <td>{t45n('assets.step45n.assetsAutomationRules.v')}{run.workflowVersion}</td>
                        <td>
                          {ticket ? (
                            <>
                              <b>{ticket.ticketNumber}</b>
                              <div className="table-meta">{ticket.subject}</div>
                            </>
                          ) : (run.ticketId ?? '—')}
                        </td>
                        <td>
                          <INNOStatus tone={statusTone(run.status)}>
                            {t('helpdesk.automation.runs.status.' + run.status)}
                          </INNOStatus>
                          {run.errorCode ? <div className="table-meta">{run.errorCode}</div> : null}
                        </td>
                        <td>{run.attemptCount}/{run.maxAttempts}</td>
                        <td className="action-column">
                          <INNORowActions
                            ariaLabel={t('helpdesk.automation.runs.rowActions', { id: run.id })}
                            items={[{
                              id: 'inspect',
                              label: t('helpdesk.automation.runs.inspect'),
                              onSelect: () => openRun(run.id),
                            }]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={runs.data.page}
              pageSize={runs.data.pageSize}
              totalItems={runs.data.totalItems}
              totalPages={runs.data.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </INNOCollection>

      <INNODrawer
        open={Boolean(selectedRunId)}
        title={t('helpdesk.automation.runs.detail.title')}
        description={t('helpdesk.automation.runs.detail.description')}
        onClose={closeDetail}
        size="lg"
      >
        {selectedRun.isPending ? <LoadingState label={t('helpdesk.automation.runs.detail.loading')} /> : null}
        {selectedRun.isError ? (
          <ErrorState error={selectedRun.error} retry={() => void selectedRun.refetch()} />
        ) : null}
        {selectedRun.data ? (
          <div className="automation-run-detail">
            <div className="automation-run-detail-summary">
              <div>
                <span>{t('helpdesk.automation.runs.detail.status')}</span>
                <INNOStatus tone={statusTone(selectedRun.data.status)}>
                  {t('helpdesk.automation.runs.status.' + selectedRun.data.status)}
                </INNOStatus>
              </div>
              <div>
                <span>{t('helpdesk.automation.runs.detail.version')}</span>
                <b>{t45n('assets.step45n.assetsAutomationRules.v')}{selectedRun.data.workflowVersion}</b>
              </div>
              <div>
                <span>{t('helpdesk.automation.runs.detail.duration')}</span>
                <b>
                  {(() => {
                    const value = durationMs(
                      selectedRun.data.startedAt,
                      selectedRun.data.completedAt,
                    );
                    return value === null
                      ? '—'
                      : t('helpdesk.automation.runs.durationMs', { value });
                  })()}
                </b>
              </div>
            </div>

            {selectedRun.data.errorCode ? (
              <div className="workflow-builder-validation-item is-error">
                <div>
                  <b>{selectedRun.data.errorCode}</b>
                  <div>{runtimeError(selectedRun.data.errorCode, selectedRun.data.errorDetail)}</div>
                </div>
              </div>
            ) : null}

            <div className="automation-run-steps">
              <h3>{t('helpdesk.automation.runs.steps.title')}</h3>
              {selectedRun.data.steps.map((step) => {
                const node = selectedRun.data.definitionSnapshot.nodes.find(
                  (candidate) => candidate.id === step.nodeId,
                );
                const label = node?.labelKey ? t(node.labelKey) : node?.label ?? step.nodeId;
                return (
                  <div key={step.id} className="automation-run-step">
                    <div>
                      <b>{label}</b>
                      <span>{step.catalogKey}</span>
                    </div>
                    <INNOStatus tone={
                      step.status === 'completed'
                        ? 'success'
                        : step.status === 'failed' || step.status === 'interrupted'
                          ? 'danger'
                          : step.status === 'waiting'
                            ? 'warning'
                            : 'neutral'
                    }>
                      {t('helpdesk.automation.runs.stepStatus.' + step.status)}
                    </INNOStatus>
                    <span>{t('helpdesk.automation.runs.stepAttempt', { attempt: step.attempt })}</span>
                    {step.errorCode ? (
                      <small>{step.errorCode}: {runtimeError(step.errorCode, step.errorDetail)}</small>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </INNODrawer>
    </INNOPage>
  );
}
