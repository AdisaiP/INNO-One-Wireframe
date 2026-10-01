import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOEditorFooter,
  INNOEditorFooterEnd,
  INNOEditorFooterNote,
  INNOEditorFooterStart,
  INNOPage,
  INNOSearchField,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  getDeviceGroups,
  getInventoryQueries,
  getInventoryQueryResults,
  getOperation,
  runInventoryQuery,
  saveInventoryQuery,
} from '../api/client';
import type { InventoryQueryDefinition, InventoryQueryItem } from '../api/types';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import './InventoryQueryPage.css';

const blankDefinition: InventoryQueryDefinition = {
  factType: 'software',
  field: 'name',
  operator: 'contains',
  value: '',
  scopeType: 'all',
  scopeId: null,
};

function operatorOptions(field: InventoryQueryDefinition['field']) {
  if (field === 'version') {
    return [
      { value: 'equals', label: 'equals' },
      { value: 'version_less_than', label: 'version is less than' },
    ] as const;
  }

  return [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'equals' },
  ] as const;
}

function formatDefinition(item: InventoryQueryItem) {
  const definition = item.definition;
  return [
    definition.field,
    definition.operator.replaceAll('_', ' '),
    definition.value,
  ].join(' ');
}

export function InventoryQueryPage() {
  const canManage = usePermission('devices.manage');
  const queryClient = useQueryClient();
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
      if (!queryName.trim()) throw new Error('Enter a name before saving this query.');
      if (!definition.value.trim()) throw new Error('Enter a condition value.');
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
      if (!definition.value.trim()) throw new Error('Enter a condition value.');
      if (definition.scopeType === 'group' && !definition.scopeId) {
        throw new Error('Select a Device Group.');
      }
      return runInventoryQuery(
        selectedSavedId
          ? { savedQueryId: selectedSavedId }
          : { definition },
      );
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

  const currentStatus = operation.data?.status
    ?? (run.isPending ? 'queued' : undefined);
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
      if (patch.field) {
        next.operator = patch.field === 'version' ? 'equals' : 'contains';
      }
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
  const operatorChoices = operatorOptions(definition.field);

  return (
    <INNOPage
      eyebrow="Devices · Inventory"
      title="Inventory Query"
      description="Search current endpoint software inventory using a modeled query and effective device scope."
    >
      {feedback ? <div className="form-success" role="status">{feedback}</div> : null}
      {formError ? <div className="form-error" role="alert">{formError}</div> : null}

      <div className="inventory-query-layout">
        <aside className="inventory-query-support panel-stack">
          <INNOCollection>
            <INNOCollectionHeader
              title="Saved Queries"
              description="Reusable query definitions saved to your account."
              meta={<INNOStatus>{savedQueries.data?.totalItems ?? 0}</INNOStatus>}
            />
            <INNOCollectionToolbar>
              <INNOSearchField
                label="Search saved queries"
                value={savedSearch}
                onChange={setSavedSearch}
                placeholder="Search saved queries"
              />
            </INNOCollectionToolbar>
            {savedQueries.isPending ? (
              <CollectionLoadingState label="Loading saved queries…" />
            ) : savedQueries.isError ? (
              <CollectionErrorState
                error={savedQueries.error}
                retry={() => void savedQueries.refetch()}
              />
            ) : savedQueries.data.items.length ? (
              <div className="inventory-saved-list">
                {savedQueries.data.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={'inventory-saved-item' + (item.id === selectedSavedId ? ' active' : '')}
                    onClick={() => selectSaved(item)}
                  >
                    <span>
                      <b>{item.name}</b>
                      <small>{formatDefinition(item)}</small>
                    </span>
                    <span className="inventory-saved-meta">
                      {item.lastMatchCount == null ? 'Not run' : item.lastMatchCount + ' matches'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <INNOCollectionState
                kind={savedSearch ? 'no-results' : 'empty'}
                title={savedSearch ? 'No saved queries found' : 'No saved queries yet'}
                description={savedSearch
                  ? 'Try another search.'
                  : canManage
                    ? 'Build a query and save it for reuse.'
                    : 'Saved queries created by a device manager will appear here.'}
              />
            )}
          </INNOCollection>

          <section className="prod-panel inventory-fact-coverage">
            <div className="prod-panel-head">
              <div>
                <h3>Fact coverage</h3>
                <p>Only evidence-backed inventory facts are exposed.</p>
              </div>
              <INNOStatus tone="success">Available</INNOStatus>
            </div>
            <div className="inventory-fact-row">
              <span>Software</span>
              <b>Latest endpoint inventory snapshot</b>
            </div>
            <p className="table-meta">
              Process, Service, File and Folder remain unavailable until a production telemetry source exists.
            </p>
          </section>
        </aside>

        <section className="inventory-query-builder prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>Query Builder</h3>
              <p>One condition · modeled fields only · no unrestricted query language.</p>
            </div>
            {selectedSaved ? <INNOStatus tone="info">Saved query</INNOStatus> : <INNOStatus>Draft</INNOStatus>}
          </div>

          <div className="editor-form inventory-builder-body">
            <div className="editor-grid">
              <label className="field-block field-wide">
                <span>Query name</span>
                <input
                  value={queryName}
                  onChange={(event) => {
                    setQueryName(event.target.value);
                    if (selectedSavedId) setSelectedSavedId('');
                  }}
                  placeholder="Example: Chrome below approved version"
                  maxLength={160}
                />
              </label>
              <label className="field-block">
                <span>Scope</span>
                <select
                  value={definition.scopeType}
                  onChange={(event) => patchDefinition({
                    scopeType: event.target.value as InventoryQueryDefinition['scopeType'],
                  })}
                >
                  <option value="all">All accessible devices</option>
                  <option value="group">Device Group</option>
                </select>
              </label>
              <label className="field-block">
                <span>Device Group</span>
                <select
                  value={definition.scopeId ?? ''}
                  disabled={definition.scopeType !== 'group' || groups.isPending}
                  onChange={(event) => patchDefinition({ scopeId: event.target.value || null })}
                >
                  <option value="">Select group</option>
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="inventory-condition-row" aria-label="Inventory query condition">
              <label className="field-block">
                <span>Fact</span>
                <select value="software" disabled>
                  <option value="software">Software</option>
                </select>
              </label>
              <label className="field-block">
                <span>Field</span>
                <select
                  value={definition.field}
                  onChange={(event) => patchDefinition({
                    field: event.target.value as InventoryQueryDefinition['field'],
                  })}
                >
                  <option value="name">Software name</option>
                  <option value="version">Version</option>
                  <option value="publisher">Publisher</option>
                </select>
              </label>
              <label className="field-block">
                <span>Operator</span>
                <select
                  value={definition.operator}
                  onChange={(event) => patchDefinition({
                    operator: event.target.value as InventoryQueryDefinition['operator'],
                  })}
                >
                  {operatorChoices.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="field-block inventory-value-field">
                <span>Value</span>
                <input
                  value={definition.value}
                  onChange={(event) => patchDefinition({ value: event.target.value })}
                  placeholder={definition.field === 'version' ? '129.0.0' : 'Chrome'}
                  maxLength={500}
                />
              </label>
            </div>

            <div className="inventory-query-preview" aria-live="polite">
              <span>Query</span>
              <code>
                SOFTWARE.{definition.field.toUpperCase()} {definition.operator.replaceAll('_', ' ').toUpperCase()} {definition.value || '…'}
              </code>
            </div>

            {operationId ? (
              <div className="inventory-operation" role="status">
                <div>
                  <span>Shared operation</span>
                  <b>{currentStatus ?? 'queued'} · {progress}%</b>
                </div>
                <div className="scan-progress-track" aria-label={'Inventory query progress ' + progress + '%'}>
                  <span style={{ width: progress + '%' }} />
                </div>
                <small>{operationId}</small>
              </div>
            ) : null}
          </div>

          <INNOEditorFooter>
            <INNOEditorFooterStart>
              <INNOButton variant="secondary" onClick={newQuery}>New Query</INNOButton>
              <INNOEditorFooterNote>
                Save requires Devices Manage. Run uses your effective Devices View scope.
              </INNOEditorFooterNote>
            </INNOEditorFooterStart>
            <INNOEditorFooterEnd>
              {canManage && !selectedSavedId ? (
                <INNOButton
                  variant="secondary"
                  busy={save.isPending}
                  disabled={!queryName.trim() || !definition.value.trim() || isRunning}
                  onClick={() => save.mutate()}
                >
                  Save Query
                </INNOButton>
              ) : null}
              <INNOButton
                busy={run.isPending || isRunning}
                disabled={!definition.value.trim()
                  || (definition.scopeType === 'group' && !definition.scopeId)
                  || isRunning}
                onClick={() => run.mutate()}
              >
                {isRunning ? 'Running…' : 'Run Query'}
              </INNOButton>
            </INNOEditorFooterEnd>
          </INNOEditorFooter>
        </section>
      </div>

      <INNOCollection className="inventory-query-results">
        <INNOCollectionHeader
          title="Matching Devices"
          description="Materialized results from the current completed query run."
          meta={results.data ? <INNOStatus>{results.data.totalItems} matches</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label="Search inventory query results"
            value={resultSearch}
            onChange={setResultSearch}
            placeholder="Search device, software or publisher"
          />
        </INNOCollectionToolbar>

        {!runId ? (
          <INNOCollectionState
            kind="empty"
            title="Run a query to see results"
            description="Build a condition above, then run it against your effective device scope."
          />
        ) : operation.isError ? (
          <CollectionErrorState error={operation.error} retry={() => void operation.refetch()} />
        ) : currentStatus === 'queued' || currentStatus === 'running' ? (
          <CollectionLoadingState label={'Inventory query ' + (currentStatus ?? 'queued') + '…'} />
        ) : currentStatus === 'failed' ? (
          <INNOCollectionState
            kind="error"
            title="Inventory query failed"
            description={operation.data?.errorCode
              ? 'Operation failed with ' + operation.data.errorCode + '.'
              : 'The query could not be completed.'}
          />
        ) : results.isPending ? (
          <CollectionLoadingState label="Loading query results…" />
        ) : results.isError ? (
          <CollectionErrorState error={results.error} retry={() => void results.refetch()} />
        ) : results.data.items.length === 0 ? (
          <INNOCollectionState
            kind={resultSearch ? 'no-results' : 'empty'}
            title={resultSearch ? 'No matching results' : 'No devices matched'}
            description={resultSearch
              ? 'Try another result search.'
              : 'The completed inventory query returned no matching devices.'}
            action={resultSearch
              ? <INNOButton variant="secondary" onClick={() => setResultSearch('')}>Clear search</INNOButton>
              : undefined}
          />
        ) : (
          <INNOTableWrap width="xwide" stickyAction>
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Software</th>
                  <th>Version</th>
                  <th>Publisher</th>
                  <th>Observed</th>
                  <th className="action-column">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.data.items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.deviceName}</b></td>
                    <td>{item.user ?? '—'}</td>
                    <td>{item.ipAddress ?? '—'}</td>
                    <td>{item.factName}</td>
                    <td>{item.factVersion ?? '—'}</td>
                    <td>{item.factPublisher ?? '—'}</td>
                    <td>{new Date(item.observedAt).toLocaleString()}</td>
                    <td className="action-column">
                      <Link className="inno-row-action" to={'/devices/' + item.deviceId}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>
    </INNOPage>
  );
}
