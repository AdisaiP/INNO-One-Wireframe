import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RouterRowAction } from '../components/RouterRowAction';
import {
  INNOButton, INNOCollection, INNOCollectionHeader, INNOCollectionState,
  INNOCollectionToolbar, INNODrawer, INNOEditorFooter, INNOEditorFooterEnd,
  INNOEditorFooterNote, INNOEditorFooterStart, INNOPage, INNOSearchField,
  INNOStatus, INNOTableWrap,
} from '@inno/ui';
import {
  getDeviceGroups, getInventoryQueries, getInventoryQueryResults, getOperation,
  runInventoryQuery, saveInventoryQuery,
} from '../api/client';
import type { InventoryQueryDefinition, InventoryQueryItem } from '../api/types';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import './InventoryQueryPage.css';
import { useI18n as useStep45NI18n } from '@inno/i18n';

const blankDefinition: InventoryQueryDefinition = {
  factType: 'software',
  field: 'name',
  operator: 'contains',
  value: '',
  scopeType: 'all',
  scopeId: null,
};

function formatDefinition(item: InventoryQueryItem) {
  const definition = item.definition;
  return [
    definition.field,
    definition.operator.replaceAll('_', ' '),
    definition.value,
  ].join(' ');
}

function clauseLabel(definition: InventoryQueryDefinition) {
  const field = definition.field === 'name'
    ? 'Software name'
    : definition.field === 'version'
      ? 'Version'
      : 'Publisher';
  return field + ' ' + definition.operator.replaceAll('_', ' ') + ' ' + (definition.value || '…');
}

export function InventoryQueryPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('devices.manage');
  const queryClient = useQueryClient();
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedSearch, setSavedSearch] = useState('');
  const deferredSavedSearch = useDeferredValue(savedSearch);
  const [resultSearch, setResultSearch] = useState('');
  const [selectedSavedId, setSelectedSavedId] = useState('');
  const [queryName, setQueryName] = useState('');
  const [definition, setDefinition] = useState<InventoryQueryDefinition>(blankDefinition);
  const [operationId, setOperationId] = useState('');
  const [runId, setRunId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');

  const savedQueries = useQuery({
    queryKey: ['devices', 'inventory-queries', deferredSavedSearch],
    queryFn: () => getInventoryQueries(deferredSavedSearch),
  });

  const groups = useQuery({
    queryKey: ['devices', 'groups', 'inventory-query'],
    queryFn: () => getDeviceGroups({ page: 1, pageSize: 100, status: 'active' }),
  });

  const operation = useQuery({
    queryKey: ['operation', operationId],
    queryFn: () => getOperation(operationId),
    enabled: Boolean(operationId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 800 : false;
    },
  });

  const results = useQuery({
    queryKey: ['devices', 'inventory-query-results', runId, resultSearch],
    queryFn: () => getInventoryQueryResults(runId, {
      page: 1,
      pageSize: 50,
      search: resultSearch,
    }),
    enabled: Boolean(runId) && operation.data?.status === 'succeeded',
  });

  const save = useMutation({
    mutationFn: () => {
      if (!queryName.trim()) throw new Error(t45n('devices.step45n.inventoryQuery.enterANameBeforeSavingThisQuery'));
      if (!definition.value.trim()) throw new Error(t45n('devices.step45n.inventoryQuery.enterAConditionValue'));
      return saveInventoryQuery(queryName.trim(), definition);
    },
    onSuccess: async (saved) => {
      setFormError('');
      setFeedback('Query saved.');
      setSelectedSavedId(saved.id);
      await queryClient.invalidateQueries({ queryKey: ['devices', 'inventory-queries'] });
    },
    onError: (error: Error) => {
      setFeedback('');
      setFormError(error.message);
    },
  });

  const run = useMutation({
    mutationFn: () => {
      if (!definition.value.trim()) throw new Error(t45n('devices.step45n.inventoryQuery.enterAConditionValue'));
      if (definition.scopeType === 'group' && !definition.scopeId) throw new Error(t45n('devices.step45n.inventoryQuery.selectADeviceGroup'));
      return runInventoryQuery(selectedSavedId ? { savedQueryId: selectedSavedId } : { definition });
    },
    onSuccess: (accepted) => {
      setFormError('');
      setFeedback('Inventory query queued.');
      setOperationId(accepted.operationId);
      setRunId(accepted.resource.runId);
      setResultSearch('');
    },
    onError: (error: Error) => {
      setFeedback('');
      setFormError(error.message);
    },
  });

  const currentStatus = operation.data?.status ?? (run.isPending ? 'queued' : undefined);
  const progress = operation.data?.progress ?? (run.isPending ? 1 : 0);
  const isRunning = currentStatus === 'queued' || currentStatus === 'running';
  const selectedSaved = useMemo(
    () => savedQueries.data?.items.find((item) => item.id === selectedSavedId) ?? null,
    [savedQueries.data, selectedSavedId],
  );

  function patchDefinition(patch: Partial<InventoryQueryDefinition>) {
    setSelectedSavedId('');
    setDefinition((current) => {
      const next = { ...current, ...patch };
      if (patch.field) next.operator = patch.field === 'version' ? 'equals' : 'contains';
      if (patch.scopeType === 'all') next.scopeId = null;
      return next;
    });
    setFeedback('');
    setFormError('');
  }

  function selectSaved(item: InventoryQueryItem) {
    setSelectedSavedId(item.id);
    setQueryName(item.name);
    setDefinition(item.definition);
    setOperationId('');
    setRunId('');
    setFeedback('');
    setFormError('');
    setSavedOpen(false);
  }

  function newQuery() {
    setSelectedSavedId('');
    setQueryName('');
    setDefinition(blankDefinition);
    setOperationId('');
    setRunId('');
    setFeedback('');
    setFormError('');
  }

  const availableGroups = groups.data?.items ?? [];
  const operatorChoices = definition.field === 'version'
    ? [
        { value: 'equals', label: t45n('devices.step45n.inventoryQuery.equals') },
        { value: 'version_less_than', label: t45n('devices.step45n.inventoryQuery.isLowerThan') },
      ] as const
    : [
        { value: 'contains', label: t45n('devices.step45n.inventoryQuery.contains') },
        { value: 'equals', label: t45n('devices.step45n.inventoryQuery.equals') },
      ] as const;
  const selectedGroup = availableGroups.find((group) => group.id === definition.scopeId);
  const scopeLabel = definition.scopeType === 'group'
    ? selectedGroup?.name ?? 'Select a Device Group'
    : 'All accessible devices';

  return (
    <INNOPage
      eyebrow={t45n('devices.step45n.inventoryQuery.devicesInventory')}
      title={t45n('navigation.inventoryQuery')}
      description={t45n('devices.step45n.inventoryQuery.findDevicesBySoftwareNameVersionOrPublisher')}
      actions={<INNOButton type="button" variant="secondary" onClick={() => setSavedOpen(true)}>{t45n('devices.step45n.inventoryQuery.savedQueries')}</INNOButton>}
    >
      {feedback ? <div className="form-success" role="status">{feedback}</div> : null}
      {formError ? <div className="form-error" role="alert">{formError}</div> : null}

      <section className="inventory-query-builder prod-panel">
        <div className="prod-panel-head inventory-builder-head">
          <div>
            <h3>{t45n('devices.step45n.inventoryQuery.buildQuery')}</h3>
            <p>{t45n('devices.step45n.inventoryQuery.defineOneSoftwareConditionAndChooseWhereTo')}</p>
          </div>
          <div className="inventory-builder-head-actions">
            {selectedSaved ? <INNOStatus tone="info">{selectedSaved.name}</INNOStatus> : <INNOStatus>{t45n('common.status.unsaved')}</INNOStatus>}
            <INNOButton type="button" variant="secondary" onClick={newQuery}>{t45n('devices.step45n.inventoryQuery.newQuery')}</INNOButton>
          </div>
        </div>

        <div className="inventory-builder-body">
          <div className="inventory-query-setup">
            <label className="field-block inventory-query-name">
              <span>{t45n('devices.step45n.inventoryQuery.queryName')}</span>
              <input
                autoComplete="off"
                name="inventory-query-name"
                value={queryName}
                onChange={(event) => {
                  setQueryName(event.target.value);
                  if (selectedSavedId) setSelectedSavedId('');
                }}
                placeholder={t45n('devices.step45n.inventoryQuery.exampleChromeBelowApprovedVersion')}
                maxLength={160}
              />
            </label>
            <label className="field-block">
              <span>{t45n('devices.step45n.inventoryQuery.searchScope')}</span>
              <select
                value={definition.scopeType}
                onChange={(event) => patchDefinition({
                  scopeType: event.target.value as InventoryQueryDefinition['scopeType'],
                })}
              >
                <option value="all">{t45n('devices.step45n.inventoryQuery.allAccessibleDevices')}</option>
                <option value="group">{t45n('admin.step45n.adminAccessScopeEdit.deviceGroup')}</option>
              </select>
            </label>
            {definition.scopeType === 'group' ? (
              <label className="field-block">
                <span>{t45n('admin.step45n.adminAccessScopeEdit.deviceGroup')}</span>
                <select
                  value={definition.scopeId ?? ''}
                  disabled={groups.isPending}
                  onChange={(event) => patchDefinition({ scopeId: event.target.value || null })}
                >
                  <option value="">{t45n('devices.step45n.inventoryQuery.selectGroup')}</option>
                  {availableGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          <div className="inventory-clause-block">
            <div className="inventory-clause-heading">
              <div>
                <span className="inventory-clause-kicker">{t45n('devices.step45n.inventoryQuery.softwareInventory')}</span>
                <h4>{t45n('devices.step45n.inventoryQuery.matchDevicesWhere')}</h4>
              </div>
              <small>{t45n('devices.step45n.inventoryQuery.currentSourceLatestEndpointSoftwareSnapshot')}</small>
            </div>
            <div className="inventory-condition-row" aria-label={t45n('devices.step45n.inventoryQuery.inventoryQueryCondition')}>
              <label className="field-block">
                <span>{t45n('reports.editor.filterField')}</span>
                <select
                  value={definition.field}
                  onChange={(event) => patchDefinition({
                    field: event.target.value as InventoryQueryDefinition['field'],
                  })}
                >
                  <option value="name">{t45n('devices.step45n.inventoryQuery.softwareName')}</option>
                  <option value="version">{t45n('reports.runs.version')}</option>
                  <option value="publisher">{t45n('devices.step45n.deviceDetail.publisher')}</option>
                </select>
              </label>
              <label className="field-block">
                <span>{t45n('reports.editor.filterOperator')}</span>
                <select
                  value={definition.operator}
                  onChange={(event) => patchDefinition({
                    operator: event.target.value as InventoryQueryDefinition['operator'],
                  })}
                >
                  {operatorChoices.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="field-block inventory-value-field">
                <span>{t45n('reports.editor.filterValue')}</span>
                <input
                  autoComplete="off"
                  name="inventory-query-value"
                  value={definition.value}
                  onChange={(event) => patchDefinition({ value: event.target.value })}
                  placeholder={definition.field === 'version' ? t45n('devices.step45n.inventoryQuery.eG12900') : t45n('devices.step45n.inventoryQuery.eGChrome')}
                  maxLength={500}
                />
              </label>
            </div>
          </div>

          <div className="inventory-query-summary" aria-live="polite">
            <div><span>{t45n('workflow.kind.condition')}</span><b>{clauseLabel(definition)}</b></div>
            <div><span>{t45n('admin.step45n.adminAccessScopes.scope')}</span><b>{scopeLabel}</b></div>
          </div>

          {operationId ? (
            <div className="inventory-operation" role="status">
              <div>
                <span>{t45n('devices.step45n.inventoryQuery.queryRun')}</span>
                <b>{currentStatus ?? t45n('devices.step45n.inventoryQuery.queued')} · {progress}%</b>
              </div>
              <div className="scan-progress-track" aria-label={t45n('devices.step45n.inventoryQuery.inventoryQueryProgress') + ' ' + progress + '%'}>
                <span style={{ width: progress + '%' }} />
              </div>
            </div>
          ) : null}
        </div>

        <INNOEditorFooter>
          <INNOEditorFooterStart>
            <INNOEditorFooterNote>
              {selectedSaved
                ? t45n('devices.step45n.inventoryQuery.runningUsesTheSavedDefinitionUntilYouChange')
                : t45n('devices.step45n.inventoryQuery.runThisDefinitionNowOrSaveItFor')}
            </INNOEditorFooterNote>
          </INNOEditorFooterStart>
          <INNOEditorFooterEnd>
            {canManage ? (
              <INNOButton
                variant="secondary"
                busy={save.isPending}
                disabled={!queryName.trim() || !definition.value.trim() || isRunning}
                onClick={() => save.mutate()}
              >
                {selectedSavedId ? t45n('devices.step45n.inventoryQuery.saveAsNew') : t45n('devices.step45n.inventoryQuery.saveQuery')}
              </INNOButton>
            ) : null}
            <INNOButton
              busy={run.isPending || isRunning}
              disabled={!definition.value.trim()
                || (definition.scopeType === 'group' && !definition.scopeId)
                || isRunning}
              onClick={() => run.mutate()}
            >
              {isRunning ? t45n('devices.step45n.inventoryQuery.running') : t45n('devices.step45n.inventoryQuery.runQuery')}
            </INNOButton>
          </INNOEditorFooterEnd>
        </INNOEditorFooter>
      </section>

      <INNOCollection className="inventory-query-results">
        <INNOCollectionHeader
          title={t45n('devices.step45n.inventoryQuery.results')}
          description={t45n('devices.step45n.inventoryQuery.devicesMatchedByTheLatestCompletedRun')}
          meta={results.data ? <INNOStatus>{results.data.totalItems} {t45n('devices.step45n.inventoryQuery.matches')}</INNOStatus> : undefined}
        />
        {runId && operation.data?.status === 'succeeded' ? (
          <INNOCollectionToolbar>
            <INNOSearchField
              label={t45n('devices.step45n.inventoryQuery.searchInventoryQueryResults')}
              value={resultSearch}
              onChange={setResultSearch}
              placeholder={t45n('devices.step45n.inventoryQuery.searchDeviceSoftwareOrPublisher')}
            />
          </INNOCollectionToolbar>
        ) : null}

        {!runId ? (
          <INNOCollectionState kind="empty" title={t45n('devices.step45n.inventoryQuery.noQueryRunYet')} description={t45n('devices.step45n.inventoryQuery.enterAConditionAboveAndSelectRunQuery')} />
        ) : operation.isError ? (
          <CollectionErrorState error={operation.error} retry={() => void operation.refetch()} />
        ) : currentStatus === 'queued' || currentStatus === 'running' ? (
          <CollectionLoadingState label={t45n('devices.step45n.inventoryQuery.inventoryQuery') + ' ' + (currentStatus ?? t45n('devices.step45n.inventoryQuery.queued')) + '…'} />
        ) : currentStatus === 'failed' ? (
          <INNOCollectionState
            kind="error"
            title={t45n('devices.step45n.inventoryQuery.inventoryQueryFailed')}
            description={operation.data?.errorCode ? t45n('devices.step45n.inventoryQuery.operationFailedWith') + ' ' + operation.data.errorCode + '.' : t45n('devices.step45n.inventoryQuery.theQueryCouldNotBeCompleted')}
          />
        ) : results.isPending ? (
          <CollectionLoadingState label={t45n('devices.step45n.inventoryQuery.loadingQueryResults')} />
        ) : results.isError ? (
          <CollectionErrorState error={results.error} retry={() => void results.refetch()} />
        ) : results.data.items.length === 0 ? (
          <INNOCollectionState
            kind={resultSearch ? 'no-results' : 'empty'}
            title={resultSearch ? t45n('devices.step45n.inventoryQuery.noMatchingResults') : t45n('devices.step45n.inventoryQuery.noDevicesMatched')}
            description={resultSearch ? t45n('devices.step45n.inventoryQuery.tryAnotherResultSearch') : t45n('devices.step45n.inventoryQuery.theCompletedQueryReturnedNoMatchingDevices')}
            action={resultSearch ? <INNOButton variant="secondary" onClick={() => setResultSearch('')}>{t45n('assets.automation.clearSearch')}</INNOButton> : undefined}
          />
        ) : (
          <INNOTableWrap width="xwide" stickyAction>
            <table>
              <thead>
                <tr>
                  <th>{t45n('reports.column.hostname')}</th><th>{t45n('common.user')}</th><th>{t45n('reports.column.ipAddress')}</th><th>{t45n('devices.step45n.deviceDetail.software')}</th>
                  <th>{t45n('reports.runs.version')}</th><th>{t45n('devices.step45n.deviceDetail.publisher')}</th><th>{t45n('devices.step45n.inventoryQuery.observed')}</th><th className="action-column">{t45n('reports.table.action')}</th>
                </tr>
              </thead>
              <tbody>{results.data.items.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.deviceName}</b></td>
                  <td>{item.user ?? '—'}</td>
                  <td>{item.ipAddress ?? '—'}</td>
                  <td>{item.factName}</td>
                  <td>{item.factVersion ?? '—'}</td>
                  <td>{item.factPublisher ?? '—'}</td>
                  <td>{new Date(item.observedAt).toLocaleString()}</td>
                  <td className="action-column"><RouterRowAction to={'/devices/' + item.deviceId} ariaLabel={t45n('common.step45n.search.open') + ' ' + item.deviceName} /></td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>

      <INNODrawer
        open={savedOpen}
        title={t45n('devices.step45n.inventoryQuery.savedQueries')}
        description={t45n('devices.step45n.inventoryQuery.loadAReusableQueryDefinitionIntoTheBuilder')}
        onClose={() => setSavedOpen(false)}
        size="md"
        className="inventory-saved-drawer"
      >
        <div className="inventory-saved-drawer-body">
          <INNOSearchField
            label={t45n('devices.step45n.inventoryQuery.searchSavedQueries')}
            value={savedSearch}
            onChange={setSavedSearch}
            placeholder={t45n('devices.step45n.inventoryQuery.searchSavedQueries')}
          />
          {savedQueries.isPending ? (
            <CollectionLoadingState label={t45n('devices.step45n.inventoryQuery.loadingSavedQueries')} />
          ) : savedQueries.isError ? (
            <CollectionErrorState error={savedQueries.error} retry={() => void savedQueries.refetch()} />
          ) : savedQueries.data.items.length ? (
            <div className="inventory-saved-list">
              {savedQueries.data.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={'inventory-saved-item' + (item.id === selectedSavedId ? ' active' : '')}
                  onClick={() => selectSaved(item)}
                >
                  <span><b>{item.name}</b><small>{formatDefinition(item)}</small></span>
                  <span className="inventory-saved-meta">{item.lastMatchCount == null ? t45n('devices.step45n.inventoryQuery.notRun') : item.lastMatchCount + ' ' + t45n('devices.step45n.inventoryQuery.matches')}</span>
                </button>
              ))}
            </div>
          ) : (
            <INNOCollectionState
              kind={savedSearch ? 'no-results' : 'empty'}
              title={savedSearch ? t45n('devices.step45n.inventoryQuery.noSavedQueriesFound') : t45n('devices.step45n.inventoryQuery.noSavedQueriesYet')}
              description={savedSearch ? t45n('reports.noResults.description') : canManage ? t45n('devices.step45n.inventoryQuery.saveAQueryFromTheBuilderForReuse') : t45n('devices.step45n.inventoryQuery.noSavedQueryIsAvailable')}
            />
          )}
        </div>
      </INNODrawer>
    </INNOPage>
  );
}
