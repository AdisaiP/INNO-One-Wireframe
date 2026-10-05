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
  getAssets,
  getAssetsAutomationDefinition,
  getAssetsAutomationRun,
  getAssetsAutomationRuns,
  getSoftwareLicenses,
  startAssetsAutomationRun,
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

export function AssetsAutomationRunsPage() {
  const { t: t45n } = useStep45NI18n();
  const { t, formatDateTime } = useI18n();
  const { automationId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canManage = usePermission('assets.automation.manage');
  const canViewAssets = usePermission('assets.view');
  const canManageLicenses = usePermission('assets.license.manage');
  const [page, setPage] = useState(1);
  const [resourceId, setResourceId] = useState('');
  const selectedRunId = params.get('run') ?? '';

  const definition = useQuery({
    queryKey: ['assets', 'automation-definition', automationId],
    queryFn: () => getAssetsAutomationDefinition(automationId),
    enabled: Boolean(automationId),
  });

  const triggerNode = definition.data?.nodes.find((node) => node.kind === 'trigger');
  const licenseContext = triggerNode?.catalogKey === 'assets.license.overused';

  const assets = useQuery({
    queryKey: ['assets', 'automation-run-context'],
    queryFn: () => getAssets({ page: 1, pageSize: 100 }),
    enabled: canViewAssets && !licenseContext,
    staleTime: 30_000,
  });

  const licenses = useQuery({
    queryKey: ['assets', 'automation-license-context'],
    queryFn: () => getSoftwareLicenses({ page: 1, pageSize: 100 }),
    enabled: canManageLicenses && licenseContext,
    staleTime: 30_000,
  });

  const runs = useQuery({
    queryKey: ['assets', 'automation-runs', automationId, page],
    queryFn: () => getAssetsAutomationRuns(automationId, { page, pageSize: 25 }),
    enabled: Boolean(automationId),
    refetchInterval: (query) => (
      query.state.data?.items.some((item) => ACTIVE_STATUSES.has(item.status))
        ? 750
        : false
    ),
  });

  const selectedRun = useQuery({
    queryKey: ['assets', 'automation-run', automationId, selectedRunId],
    queryFn: () => getAssetsAutomationRun(automationId, selectedRunId),
    enabled: Boolean(automationId && selectedRunId),
    refetchInterval: (query) => (
      query.state.data && ACTIVE_STATUSES.has(query.state.data.status)
        ? 500
        : false
    ),
  });

  const startRun = useMutation({
    mutationFn: () => startAssetsAutomationRun(
      automationId,
      licenseContext ? { licenseId: resourceId } : { assetId: resourceId },
    ),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({
        queryKey: ['assets', 'automation-runs', automationId],
      });
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set('run', run.id);
        return next;
      }, { replace: true });
    },
  });

  useEffect(() => {
    setResourceId('');
  }, [licenseContext, automationId]);

  useEffect(() => {
    if (resourceId) return;
    if (licenseContext && licenses.data?.items[0]) {
      setResourceId(licenses.data.items[0].id);
      return;
    }
    if (!licenseContext && assets.data?.items[0]) {
      setResourceId(assets.data.items[0].id);
    }
  }, [resourceId, licenseContext, assets.data, licenses.data]);

  const assetMap = useMemo(
    () => new Map((assets.data?.items ?? []).map((asset) => [asset.id, asset])),
    [assets.data],
  );
  const licenseMap = useMemo(
    () => new Map((licenses.data?.items ?? []).map((license) => [license.id, license])),
    [licenses.data],
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
  const canStartRun = canManage
    && (licenseContext ? canManageLicenses : canViewAssets);
  const contextLoading = licenseContext ? licenses.isPending : assets.isPending;

  const runtimeError = (code?: string | null, fallback?: string | null) => {
    if (!code) return fallback || t('assets.automation.runs.errorFallback');
    const key = 'assets.automation.runs.error.' + code;
    const translated = t(key);
    return translated === key
      ? fallback || t('assets.automation.runs.errorFallback')
      : translated;
  };
  const runError = startRun.error instanceof ApiError
    ? runtimeError(startRun.error.problem?.code, startRun.error.problem?.detail)
    : startRun.error instanceof Error
      ? startRun.error.message
      : '';

  const resourceLabel = (type?: string | null, id?: string | null) => {
    if (!id) return '—';
    if (type === 'license') {
      const license = licenseMap.get(id);
      return license ? license.productName + ' · ' + license.vendor : id;
    }
    const asset = assetMap.get(id);
    return asset ? asset.assetTag + ' · ' + asset.name : id;
  };

  return (
    <INNOPage
      eyebrow={t('assets.automation.runs.eyebrow')}
      title={t('assets.automation.runs.title', { name: definitionData.name })}
      description={t('assets.automation.runs.description')}
      actions={(
        <Link className="inno-link-button secondary" to={'/assets/automation/' + automationId}>
          {t('assets.automation.runs.back')}
        </Link>
      )}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('assets.automation.runs.boundary.title')}</b>
        <span>{t('assets.automation.runs.boundary.description', { version: definitionData.version })}</span>
      </div>

      {canStartRun ? (
        <section className="automation-run-launcher" aria-label={t('assets.automation.runs.start')}>
          <div>
            <b>{t('assets.automation.runs.start')}</b>
            <span>{t('assets.automation.runs.startDescription')}</span>
          </div>
          <label className="field-block">
            <span>{t(licenseContext ? 'assets.automation.runs.license' : 'assets.automation.runs.asset')}</span>
            <select
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              disabled={contextLoading || startRun.isPending}
            >
              <option value="">{t(licenseContext
                ? 'assets.automation.runs.licensePlaceholder'
                : 'assets.automation.runs.assetPlaceholder')}</option>
              {licenseContext
                ? licenses.data?.items.map((license) => (
                    <option key={license.id} value={license.id}>
                      {license.productName} · {license.vendor} · {license.usedSeats}/{license.entitledSeats}
                    </option>
                  ))
                : assets.data?.items.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} · {asset.name} · {asset.status}
                    </option>
                  ))}
            </select>
          </label>
          <INNOButton
            type="button"
            disabled={!resourceId || contextLoading}
            busy={startRun.isPending}
            onClick={() => { if (!startRun.isPending && resourceId) startRun.mutate(); }}
          >
            {t('assets.automation.runs.run')}
          </INNOButton>
          {runError ? <span className="field-error">{runError}</span> : null}
        </section>
      ) : null}

      <INNOCollection className="automation-runs-collection">
        <INNOCollectionHeader
          title={t('assets.automation.runs.list.title')}
          description={t('assets.automation.runs.list.description')}
          meta={runs.data ? (
            <INNOStatus>{t('assets.automation.runs.count', { count: runs.data.totalItems })}</INNOStatus>
          ) : undefined}
        />

        {runs.isPending ? <CollectionLoadingState label={t('assets.automation.runs.loading')} /> : null}
        {runs.isError ? <CollectionErrorState error={runs.error} retry={() => void runs.refetch()} /> : null}
        {runs.data?.items.length === 0 ? (
          <INNOCollectionState
            kind="empty"
            title={t('assets.automation.runs.empty.title')}
            description={t('assets.automation.runs.empty.description')}
          />
        ) : null}

        {runs.data?.items.length ? (
          <>
            <INNOTableWrap width="wide" stickyAction>
              <table>
                <thead>
                  <tr>
                    <th>{t('assets.automation.runs.table.started')}</th>
                    <th>{t('assets.automation.runs.table.version')}</th>
                    <th>{t('assets.automation.runs.table.resource')}</th>
                    <th>{t('assets.automation.runs.table.status')}</th>
                    <th>{t('assets.automation.runs.table.attempt')}</th>
                    <th className="action-column">{t('assets.automation.runs.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.items.map((run) => (
                    <tr key={run.id} className={run.id === selectedRunId ? 'selected-row' : undefined}>
                      <td>
                        {formatDateTime(run.startedAt ?? run.createdAt)}
                        <div className="table-meta">{run.id}</div>
                      </td>
                      <td>{t45n('assets.step45n.assetsAutomationRules.v')}{run.workflowVersion}</td>
                      <td>{resourceLabel(run.resourceType, run.resourceId)}</td>
                      <td>
                        <INNOStatus tone={statusTone(run.status)}>
                          {t('assets.automation.runs.status.' + run.status)}
                        </INNOStatus>
                        {run.errorCode ? <div className="table-meta">{run.errorCode}</div> : null}
                      </td>
                      <td>{run.attemptCount}/{run.maxAttempts}</td>
                      <td className="action-column">
                        <INNORowActions
                          ariaLabel={t('assets.automation.runs.rowActions', { id: run.id })}
                          items={[{
                            id: 'inspect',
                            label: t('assets.automation.runs.inspect'),
                            onSelect: () => openRun(run.id),
                          }]}
                        />
                      </td>
                    </tr>
                  ))}
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
        title={t('assets.automation.runs.detail.title')}
        description={t('assets.automation.runs.detail.description')}
        onClose={closeDetail}
        size="lg"
      >
        {selectedRun.isPending ? <LoadingState label={t('assets.automation.runs.detail.loading')} /> : null}
        {selectedRun.isError ? <ErrorState error={selectedRun.error} retry={() => void selectedRun.refetch()} /> : null}
        {selectedRun.data ? (
          <div className="automation-run-detail">
            <div className="automation-run-detail-summary">
              <div>
                <span>{t('assets.automation.runs.detail.status')}</span>
                <INNOStatus tone={statusTone(selectedRun.data.status)}>
                  {t('assets.automation.runs.status.' + selectedRun.data.status)}
                </INNOStatus>
              </div>
              <div>
                <span>{t('assets.automation.runs.detail.version')}</span>
                <b>{t45n('assets.step45n.assetsAutomationRules.v')}{selectedRun.data.workflowVersion}</b>
              </div>
              <div>
                <span>{t('assets.automation.runs.detail.duration')}</span>
                <b>{(() => {
                  const value = durationMs(selectedRun.data.startedAt, selectedRun.data.completedAt);
                  return value === null ? '—' : t('assets.automation.runs.durationMs', { value });
                })()}</b>
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
              <h3>{t('assets.automation.runs.steps.title')}</h3>
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
                      {t('assets.automation.runs.stepStatus.' + step.status)}
                    </INNOStatus>
                    <span>{t('assets.automation.runs.stepAttempt', { attempt: step.attempt })}</span>
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
