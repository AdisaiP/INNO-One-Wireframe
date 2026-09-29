import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  INNOIcon,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionToolbar,
  INNOPage,
  INNOPagination,
  INNOSearchField,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  getAdminAudit,
  getAdminAuditDetail,
  getAdminAuditFacets,
} from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatWhen(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function toIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function prettyMetadata(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AdminAuditPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [module, setModule] = useState('all');
  const [action, setAction] = useState('all');
  const [targetType, setTargetType] = useState('all');
  const [classification, setClassification] = useState('all');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const selectedId = params.get('audit') ?? '';

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, module, action, targetType, classification, actor, from, to]);

  const facets = useQuery({
    queryKey: ['admin', 'audit', 'facets'],
    queryFn: getAdminAuditFacets,
  });

  const list = useQuery({
    queryKey: [
      'admin',
      'audit',
      page,
      deferredSearch,
      module,
      action,
      targetType,
      classification,
      actor,
      from,
      to,
    ],
    queryFn: () => getAdminAudit({
      page,
      pageSize: 50,
      search: deferredSearch,
      module,
      action,
      targetType,
      classification,
      actor,
      from: toIso(from),
      to: toIso(to),
    }),
  });

  const detail = useQuery({
    queryKey: ['admin', 'audit', 'detail', selectedId],
    queryFn: () => getAdminAuditDetail(selectedId),
    enabled: !!selectedId,
  });

  const hasFilters = Boolean(
    search.trim()
    || module !== 'all'
    || action !== 'all'
    || targetType !== 'all'
    || classification !== 'all'
    || actor.trim()
    || from
    || to,
  );

  const selectedInPage = useMemo(
    () => list.data?.items.find((item) => item.auditId === selectedId) ?? null,
    [list.data, selectedId],
  );

  function selectAudit(auditId: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('audit', auditId);
      return next;
    }, { replace: true });
  }

  function clearSelection() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('audit');
      return next;
    }, { replace: true });
  }

  function clearFilters() {
    setSearch('');
    setModule('all');
    setAction('all');
    setTargetType('all');
    setClassification('all');
    setActor('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  return (
    <INNOPage
      eyebrow="Admin Center · Security"
      title="Audit Log"
      description="Read the immutable audit ledger across platform and module boundaries."
    >
      <INNOState
        compact
        title="Audit records are read-only"
        description="This view shows persisted audit facts exactly as stored. It does not infer canonical envelope fields that are not present in the current ledger."
      />

      <div className="admin-audit-layout">
        <INNOCollection>
          <INNOCollectionHeader
            title="Audit Records"
            description="Newest records first. Filters are applied on the server."
            meta={list.data ? <INNOStatus>{list.data.totalItems} records</INNOStatus> : undefined}
          />

          <INNOCollectionToolbar>
            <INNOSearchField
              label="Search audit records"
              value={search}
              onChange={setSearch}
              placeholder="Search action, target, actor, correlation or trace…"
            />
            <INNOSelectField label="Module" value={module} onChange={setModule}>
              <option value="all">Module: All</option>
              {facets.data?.modules.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
            <INNOSelectField label="Action" value={action} onChange={setAction}>
              <option value="all">Action: All</option>
              {facets.data?.actions.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
            <INNOSelectField label="Target type" value={targetType} onChange={setTargetType}>
              <option value="all">Target: All</option>
              {facets.data?.targetTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
            <INNOSelectField label="Classification" value={classification} onChange={setClassification}>
              <option value="all">Class: All</option>
              {facets.data?.classifications.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
          </INNOCollectionToolbar>

          <div className="admin-audit-filter-row">
            <label className="field-block">
              <span>Actor ID</span>
              <input
                value={actor}
                onChange={(event) => setActor(event.target.value)}
                placeholder="user_…"
              />
            </label>
            <label className="field-block">
              <span>From</span>
              <input
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="field-block">
              <span>To</span>
              <input
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            {hasFilters ? (
              <button type="button" className="audit-clear-button" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>

          {list.isPending ? <div className="collection-state"><LoadingState label="Loading audit records…" /></div> : null}
          {list.isError ? <div className="collection-state"><ErrorState error={list.error} retry={() => void list.refetch()} /></div> : null}
          {list.data?.items.length === 0 ? (
            <div className="collection-state">
              <INNOState
                kind={hasFilters ? 'no-results' : 'empty'}
                title={hasFilters ? 'No matching audit records' : 'No audit records'}
                description={hasFilters ? 'Adjust the search or filters.' : 'Audit facts will appear after privileged or auditable activity occurs.'}
              />
            </div>
          ) : null}

          {list.data?.items.length ? (
            <>
              <INNOTableWrap width="xwide">
                <table>
                  <thead>
                    <tr>
                      <th>Occurred</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Target</th>
                      <th>Correlation</th>
                      <th className="action-column">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.items.map((item) => (
                      <tr key={item.auditId} className={item.auditId === selectedId ? 'selected-row' : undefined}>
                        <td>
                          {formatWhen(item.occurredAt)}
                          <div className="table-meta">{item.classification}</div>
                        </td>
                        <td>
                          <b className="audit-action">{item.action}</b>
                          <div className="table-meta">{item.module}</div>
                        </td>
                        <td>
                          <b>{item.actorName ?? item.actorId}</b>
                          <div className="table-meta">{item.actorName ? item.actorId : item.actorType}</div>
                        </td>
                        <td>
                          <b>{item.targetType}</b>
                          <div className="table-meta audit-opaque-id">{item.targetId}</div>
                        </td>
                        <td>
                          <span className="audit-opaque-id">{item.correlationId ?? '—'}</span>
                        </td>
                        <td className="action-column">
                          <button
                            type="button"
                            className="device-row-action"
                            aria-label={'Open audit record ' + item.auditId}
                            onClick={() => selectAudit(item.auditId)}
                          >
                            <INNOIcon token="action.next" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
              <INNOPagination
                page={list.data.page}
                pageSize={list.data.pageSize}
                totalItems={list.data.totalItems}
                totalPages={list.data.totalPages}
                onPageChange={setPage}
              />
            </>
          ) : null}
        </INNOCollection>

        <section className="prod-panel admin-audit-detail">
          <div className="prod-panel-head">
            <div>
              <h3>Audit Detail</h3>
              <p>{selectedId ? 'Immutable stored audit fact.' : 'Select a record to inspect it.'}</p>
            </div>
            {selectedId ? (
              <button type="button" className="audit-close-button" onClick={clearSelection}>
                Close
              </button>
            ) : null}
          </div>

          {!selectedId ? (
            <div className="collection-state">
              <INNOState title="Select an audit record" description="Choose a row to inspect actor, target, correlation, trace and metadata." />
            </div>
          ) : null}
          {selectedId && detail.isPending ? <div className="collection-state"><LoadingState label="Loading audit detail…" /></div> : null}
          {selectedId && detail.isError ? <div className="collection-state"><ErrorState error={detail.error} retry={() => void detail.refetch()} /></div> : null}
          {detail.data ? (
            <div className="admin-audit-detail-body">
              <dl className="audit-detail-list">
                <div><dt>Audit ID</dt><dd>{detail.data.auditId}</dd></div>
                <div><dt>Occurred</dt><dd>{formatWhen(detail.data.occurredAt)}</dd></div>
                <div><dt>Action</dt><dd>{detail.data.action}</dd></div>
                <div><dt>Module</dt><dd>{detail.data.module}</dd></div>
                <div><dt>Actor</dt><dd>{detail.data.actorName ?? detail.data.actorId}</dd></div>
                <div><dt>Actor ID</dt><dd>{detail.data.actorId}</dd></div>
                <div><dt>Target</dt><dd>{detail.data.targetType} · {detail.data.targetId}</dd></div>
                <div><dt>Classification</dt><dd>{detail.data.classification}</dd></div>
                <div><dt>Correlation ID</dt><dd>{detail.data.correlationId ?? '—'}</dd></div>
                <div><dt>Trace ID</dt><dd>{detail.data.traceId ?? '—'}</dd></div>
              </dl>
              <div className="audit-metadata-block">
                <b>Metadata</b>
                <pre>{prettyMetadata(detail.data.metadata)}</pre>
              </div>
            </div>
          ) : selectedInPage && !detail.isPending ? null : null}
        </section>
      </div>
    </INNOPage>
  );
}
