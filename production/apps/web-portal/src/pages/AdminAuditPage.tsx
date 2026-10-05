import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  INNOIcon,
  INNORowActions,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNODrawer,
  INNOPage,
  INNOPagination,
  INNOPurposeNote,
  INNOSearchField,
  INNOSelectField,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  getAdminAudit,
  getAdminAuditDetail,
  getAdminAuditFacets,
} from '../api/client';
import { CollectionErrorState, CollectionLoadingState, ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

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
  const { t: t45n } = useStep45NI18n();
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
      eyebrow={t45n('admin.step45n.adminAudit.adminCenterSecurity')}
      title={t45n('navigation.auditLog')}
      description={t45n('admin.step45n.adminAudit.readTheImmutableAuditLedgerAcrossPlatformAnd')}
    >
      <INNOPurposeNote
        title={t45n('admin.step45n.adminAudit.auditRecordsAreReadOnly')}
        description={t45n('admin.step45n.adminAudit.thisViewShowsPersistedAuditFactsExactlyAs')}
      />

      <INNOCollection className="admin-audit-collection">
          <INNOCollectionHeader
            title={t45n('admin.step45n.adminAudit.auditRecords')}
            description={t45n('admin.step45n.adminAudit.newestRecordsFirstFiltersAreAppliedOnThe')}
            meta={list.data ? <INNOStatus>{list.data.totalItems} {t45n('admin.step45n.adminAudit.records')}</INNOStatus> : undefined}
          />

          <INNOCollectionToolbar>
            <INNOSearchField
              label={t45n('admin.step45n.adminAudit.searchAuditRecords')}
              value={search}
              onChange={setSearch}
              placeholder={t45n('admin.step45n.adminAudit.searchActionTargetActorCorrelationOrTrace')}
            />
            <INNOSelectField label={t45n('admin.step45n.adminApps.module')} value={module} onChange={setModule}>
              <option value="all">{t45n('admin.step45n.adminAudit.moduleAll')}</option>
              {facets.data?.modules.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
            <INNOSelectField label={t45n('reports.table.action')} value={action} onChange={setAction}>
              <option value="all">{t45n('admin.step45n.adminAudit.actionAll')}</option>
              {facets.data?.actions.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
            <INNOSelectField label={t45n('admin.step45n.adminAudit.targetType')} value={targetType} onChange={setTargetType}>
              <option value="all">{t45n('admin.step45n.adminAudit.targetAll')}</option>
              {facets.data?.targetTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
            <INNOSelectField label={t45n('admin.step45n.adminAudit.classification')} value={classification} onChange={setClassification}>
              <option value="all">{t45n('admin.step45n.adminAudit.classAll')}</option>
              {facets.data?.classifications.map((value) => <option key={value} value={value}>{value}</option>)}
            </INNOSelectField>
          </INNOCollectionToolbar>

          <div className="admin-audit-filter-row">
            <label className="field-block">
              <span>{t45n('admin.step45n.adminAudit.actorId')}</span>
              <input
                value={actor}
                onChange={(event) => setActor(event.target.value)}
                placeholder={t45n('admin.step45n.adminAudit.user')}
              />
            </label>
            <label className="field-block">
              <span>{t45n('admin.step45n.adminAudit.from')}</span>
              <input
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="field-block">
              <span>{t45n('admin.step45n.adminAudit.to')}</span>
              <input
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            {hasFilters ? (
              <button type="button" className="audit-clear-button" onClick={clearFilters}>
                {t45n('admin.step45n.adminAccessScopes.clearFilters')}</button>
            ) : null}
          </div>

          {list.isPending ? <CollectionLoadingState label={t45n('admin.step45n.adminAudit.loadingAuditRecords')} /> : null}
          {list.isError ? <CollectionErrorState error={list.error} retry={() => void list.refetch()} /> : null}
          {list.data?.items.length === 0 ? (
            <INNOCollectionState
              kind={hasFilters ? 'no-results' : 'empty'}
              title={hasFilters ? t45n('admin.step45n.adminAudit.noMatchingAuditRecords') : t45n('admin.step45n.adminAudit.noAuditRecords')}
              description={hasFilters ? t45n('admin.step45n.adminAudit.adjustTheSearchOrFilters') : t45n('admin.step45n.adminAudit.auditFactsWillAppearAfterPrivilegedOrAuditable')}
            />
          ) : null}

          {list.data?.items.length ? (
            <>
              <INNOTableWrap width="xwide" stickyAction>
                <table>
                  <thead>
                    <tr>
                      <th>{t45n('admin.step45n.adminAudit.occurred')}</th>
                      <th>{t45n('reports.table.action')}</th>
                      <th>{t45n('admin.step45n.adminAudit.actor')}</th>
                      <th>{t45n('admin.step45n.adminAudit.target')}</th>
                      <th>{t45n('admin.step45n.adminAudit.correlation')}</th>
                      <th className="action-column">{t45n('reports.table.action')}</th>
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
                          <INNORowActions
                            ariaLabel={t45n('admin.step45n.adminAudit.auditRecord') + ' ' + item.auditId}
                            items={[{ id: 'open', label: t45n('common.step45n.search.open'), onSelect: () => selectAudit(item.auditId) }]}
                          />
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

      <INNODrawer
        open={Boolean(selectedId)}
        title={t45n('admin.step45n.adminAudit.auditDetail')}
        description={t45n('admin.step45n.adminAudit.immutableStoredAuditFact')}
        onClose={clearSelection}
        size="lg"
      >
        {detail.isPending ? <div className="collection-state"><LoadingState label={t45n('admin.step45n.adminAudit.loadingAuditDetail')} /></div> : null}
        {detail.isError ? <div className="collection-state"><ErrorState error={detail.error} retry={() => void detail.refetch()} /></div> : null}
        {detail.data ? (
          <div className="admin-audit-detail-body">
            <dl className="audit-detail-list">
              <div><dt>{t45n('admin.step45n.adminAudit.auditId')}</dt><dd>{detail.data.auditId}</dd></div>
              <div><dt>{t45n('admin.step45n.adminAudit.occurred')}</dt><dd>{formatWhen(detail.data.occurredAt)}</dd></div>
              <div><dt>{t45n('reports.table.action')}</dt><dd>{detail.data.action}</dd></div>
              <div><dt>{t45n('admin.step45n.adminApps.module')}</dt><dd>{detail.data.module}</dd></div>
              <div><dt>{t45n('admin.step45n.adminAudit.actor')}</dt><dd>{detail.data.actorName ?? detail.data.actorId}</dd></div>
              <div><dt>{t45n('admin.step45n.adminAudit.actorId')}</dt><dd>{detail.data.actorId}</dd></div>
              <div><dt>{t45n('admin.step45n.adminAudit.target')}</dt><dd>{detail.data.targetType} · {detail.data.targetId}</dd></div>
              <div><dt>{t45n('admin.step45n.adminAudit.classification')}</dt><dd>{detail.data.classification}</dd></div>
              <div><dt>{t45n('admin.step45n.adminAudit.correlationId')}</dt><dd>{detail.data.correlationId ?? '—'}</dd></div>
              <div><dt>{t45n('admin.step45n.adminAudit.traceId')}</dt><dd>{detail.data.traceId ?? '—'}</dd></div>
            </dl>
            <div className="audit-metadata-block">
              <b>{t45n('admin.step45n.adminAudit.metadata')}</b>
              <pre>{prettyMetadata(detail.data.metadata)}</pre>
            </div>
          </div>
        ) : null}
      </INNODrawer>
    </INNOPage>
  );
}
