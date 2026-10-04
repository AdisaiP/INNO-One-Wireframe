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
  getDeviceAutomationDefinition,
  getDeviceAutomationRun,
  getDeviceAutomationRuns,
  getDevices,
  startDeviceAutomationRun,
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

export function DevicesAutomationHistoryPage() {
  const { t, formatDateTime } = useI18n();
  const { automationId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = usePermission('devices.automation.manage');
  const canViewDevices = usePermission('devices.view');
  const canStartRun = canManage && canViewDevices;
  const [page, setPage] = useState(1);
  const [deviceId, setDeviceId] = useState('');
  const selectedRunId = params.get('run') ?? '';

  const definition = useQuery({
    queryKey: ['devices', 'automation-definition', automationId],
    queryFn: () => getDeviceAutomationDefinition(automationId),
    enabled: Boolean(automationId),
  });

  const devices = useQuery({
    queryKey: ['devices', 'automation-run-context'],
    queryFn: () => getDevices({
      page: 1,
      pageSize: 100,
      sort: 'lastSeenAt',
      order: 'desc',
    }),
    enabled: canViewDevices,
    staleTime: 30_000,
  });

  const runs = useQuery({
    queryKey: ['devices', 'automation-runs', automationId, page],
    queryFn: () => getDeviceAutomationRuns(automationId, { page, pageSize: 25 }),
    enabled: Boolean(automationId),
    refetchInterval: (query) => (
      query.state.data?.items.some((item) => ACTIVE_STATUSES.has(item.status))
        ? 750
        : false
    ),
  });

  const selectedRun = useQuery({
    queryKey: ['devices', 'automation-run', automationId, selectedRunId],
    queryFn: () => getDeviceAutomationRun(automationId, selectedRunId),
    enabled: Boolean(automationId && selectedRunId),
    refetchInterval: (query) => (
      query.state.data && ACTIVE_STATUSES.has(query.state.data.status)
        ? 500
        : false
    ),
  });

  const startRun = useMutation({
    mutationFn: () => startDeviceAutomationRun(automationId, { deviceId }),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({
        queryKey: ['devices', 'automation-runs', automationId],
      });
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set('run', run.id);
        return next;
      }, { replace: true });
    },
  });

  useEffect(() => {
    if (!deviceId && devices.data?.items[0]) {
      setDeviceId(devices.data.items[0].id);
    }
  }, [deviceId, devices.data]);

  const deviceMap = useMemo(
    () => new Map((devices.data?.items ?? []).map((device) => [device.id, device])),
    [devices.data],
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
    if (!code) return fallback || t('devices.automation.runs.errorFallback');
    const key = 'devices.automation.runs.error.' + code;
    const translated = t(key);
    return translated === key
      ? fallback || t('devices.automation.runs.errorFallback')
      : translated;
  };
  const runError = startRun.error instanceof ApiError
    ? runtimeError(startRun.error.problem?.code, startRun.error.problem?.detail)
    : startRun.error instanceof Error
      ? startRun.error.message
      : '';

  return (
    <INNOPage
      eyebrow={t('devices.automation.runs.eyebrow')}
      title={t('devices.automation.runs.title', { name: definitionData.name })}
      description={t('devices.automation.runs.description')}
      actions={(
        <Link className="inno-link-button secondary" to={'/devices/automation/' + automationId}>
          {t('devices.automation.runs.back')}
        </Link>
      )}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('devices.automation.runs.boundary.title')}</b>
        <span>
          {t('devices.automation.runs.boundary.description', {
            version: definitionData.version,
          })}
        </span>
      </div>

      {canStartRun ? (
        <section className="automation-run-launcher" aria-label={t('devices.automation.runs.start')}>
          <div>
            <b>{t('devices.automation.runs.start')}</b>
            <span>{t('devices.automation.runs.startDescription')}</span>
          </div>
          <label className="field-block">
            <span>{t('devices.automation.runs.device')}</span>
            <select
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              disabled={devices.isPending || startRun.isPending}
            >
              <option value="">{t('devices.automation.runs.devicePlaceholder')}</option>
              {devices.data?.items.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} · {device.status}
                </option>
              ))}
            </select>
          </label>
          <INNOButton
            type="button"
            disabled={!deviceId || devices.isPending}
            busy={startRun.isPending}
            onClick={() => { if (!startRun.isPending && deviceId) startRun.mutate(); }}
          >
            {t('devices.automation.runs.run')}
          </INNOButton>
          {runError ? <span className="field-error">{runError}</span> : null}
        </section>
      ) : null}

      <INNOCollection className="automation-runs-collection">
        <INNOCollectionHeader
          title={t('devices.automation.runs.list.title')}
          description={t('devices.automation.runs.list.description')}
          meta={runs.data ? (
            <INNOStatus>{t('devices.automation.runs.count', { count: runs.data.totalItems })}</INNOStatus>
          ) : undefined}
        />

        {runs.isPending ? <CollectionLoadingState label={t('devices.automation.runs.loading')} /> : null}
        {runs.isError ? <CollectionErrorState error={runs.error} retry={() => void runs.refetch()} /> : null}
        {runs.data?.items.length === 0 ? (
          <INNOCollectionState
            kind="empty"
            title={t('devices.automation.runs.empty.title')}
            description={t('devices.automation.runs.empty.description')}
          />
        ) : null}

        {runs.data?.items.length ? (
          <>
            <INNOTableWrap width="wide" stickyAction>
              <table>
                <thead>
                  <tr>
                    <th>{t('devices.automation.runs.table.started')}</th>
                    <th>{t('devices.automation.runs.table.version')}</th>
                    <th>{t('devices.automation.runs.table.device')}</th>
                    <th>{t('devices.automation.runs.table.status')}</th>
                    <th>{t('devices.automation.runs.table.attempt')}</th>
                    <th className="action-column">{t('devices.automation.runs.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.items.map((run) => {
                    const device = run.deviceId ? deviceMap.get(run.deviceId) : undefined;
                    return (
                      <tr key={run.id} className={run.id === selectedRunId ? 'selected-row' : undefined}>
                        <td>
                          {formatDateTime(run.startedAt ?? run.createdAt)}
                          <div className="table-meta">{run.id}</div>
                        </td>
                        <td>v{run.workflowVersion}</td>
                        <td>
                          {device ? (
                            <>
                              <b>{device.name}</b>
                              <div className="table-meta">{device.status}</div>
                            </>
                          ) : (run.deviceId ?? '—')}
                        </td>
                        <td>
                          <INNOStatus tone={statusTone(run.status)}>
                            {t('devices.automation.runs.status.' + run.status)}
                          </INNOStatus>
                          {run.errorCode ? <div className="table-meta">{run.errorCode}</div> : null}
                        </td>
                        <td>{run.attemptCount}/{run.maxAttempts}</td>
                        <td className="action-column">
                          <INNORowActions
                            ariaLabel={t('devices.automation.runs.rowActions', { id: run.id })}
                            items={[{
                              id: 'inspect',
                              label: t('devices.automation.runs.inspect'),
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
        title={t('devices.automation.runs.detail.title')}
        description={t('devices.automation.runs.detail.description')}
        onClose={closeDetail}
        size="lg"
      >
        {selectedRun.isPending ? <LoadingState label={t('devices.automation.runs.detail.loading')} /> : null}
        {selectedRun.isError ? (
          <ErrorState error={selectedRun.error} retry={() => void selectedRun.refetch()} />
        ) : null}
        {selectedRun.data ? (
          <div className="automation-run-detail">
            <div className="automation-run-detail-summary">
              <div>
                <span>{t('devices.automation.runs.detail.status')}</span>
                <INNOStatus tone={statusTone(selectedRun.data.status)}>
                  {t('devices.automation.runs.status.' + selectedRun.data.status)}
                </INNOStatus>
              </div>
              <div>
                <span>{t('devices.automation.runs.detail.version')}</span>
                <b>v{selectedRun.data.workflowVersion}</b>
              </div>
              <div>
                <span>{t('devices.automation.runs.detail.duration')}</span>
                <b>
                  {(() => {
                    const value = durationMs(
                      selectedRun.data.startedAt,
                      selectedRun.data.completedAt,
                    );
                    return value === null
                      ? '—'
                      : t('devices.automation.runs.durationMs', { value });
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
              <h3>{t('devices.automation.runs.steps.title')}</h3>
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
                      {t('devices.automation.runs.stepStatus.' + step.status)}
                    </INNOStatus>
                    <span>{t('devices.automation.runs.stepAttempt', { attempt: step.attempt })}</span>
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
