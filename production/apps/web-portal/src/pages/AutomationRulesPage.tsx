import { useDeferredValue, useEffect, useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOPage,
  INNOPagination,
  INNORowActions,
  INNOSearchField,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getHelpdeskAutomationDefinitions } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';

export function AutomationRulesPage() {
  const { t, formatDateTime } = useI18n();
  const navigate = useNavigate();
  const canManage = usePermission('helpdesk.automation.manage');
  const canViewRuns = usePermission('helpdesk.automation.run.view');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch]);

  const query = useQuery({
    queryKey: ['helpdesk', 'automation-definitions', page, deferredSearch],
    queryFn: () => getHelpdeskAutomationDefinitions({
      page,
      pageSize: 25,
      search: deferredSearch,
    }),
  });

  const items = query.data?.items ?? [];

  return (
    <INNOPage
      eyebrow={t('helpdesk.automation.eyebrow')}
      title={t('helpdesk.automation.title')}
      description={t('helpdesk.automation.description')}
      actions={canManage ? (
        <Link className="inno-link-button" to="/helpdesk/automation/new">
          {t('helpdesk.automation.new')}
        </Link>
      ) : undefined}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('helpdesk.automation.builder.definitionBoundary.title')}</b>
        <span>{t('helpdesk.automation.runtime.description')}</span>
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title={t('helpdesk.automation.list.title')}
          description={t('helpdesk.automation.runtime.description')}
          meta={query.data ? (
            <INNOStatus tone="neutral">
              {t('helpdesk.automation.count', { count: query.data.totalItems })}
            </INNOStatus>
          ) : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label={t('helpdesk.automation.search.label')}
            value={search}
            onChange={setSearch}
            placeholder={t('helpdesk.automation.search.placeholder')}
          />
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : items.length ? (
          <>
            <INNOTableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t('helpdesk.automation.table.name')}</th>
                    <th className="numeric-column">{t('helpdesk.automation.table.version')}</th>
                    <th className="numeric-column">{t('helpdesk.automation.table.nodes')}</th>
                    <th className="numeric-column">{t('helpdesk.automation.table.connections')}</th>
                    <th>{t('helpdesk.automation.table.status')}</th>
                    <th>{t('helpdesk.automation.table.updated')}</th>
                    <th className="action-column">{t('helpdesk.automation.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.name}</b>
                        <div className="table-meta">{item.id}</div>
                      </td>
                      <td className="numeric-column">v{item.version}</td>
                      <td className="numeric-column">{item.nodeCount}</td>
                      <td className="numeric-column">{item.edgeCount}</td>
                      <td>
                        <INNOStatus tone="neutral">
                          {item.status === 'draft' ? t('workflow.status.draft') : item.status}
                        </INNOStatus>
                      </td>
                      <td>{formatDateTime(item.updatedAt)}</td>
                      <td className="action-column">
                        <INNORowActions
                          ariaLabel={item.name}
                          items={[
                            ...(canViewRuns ? [{
                              id: 'runs',
                              label: t('helpdesk.automation.runs.open'),
                              onSelect: () => navigate('/helpdesk/automation/' + item.id + '/runs'),
                            }] : []),
                            ...(canManage ? [{
                              id: 'edit',
                              label: t('helpdesk.automation.edit'),
                              onSelect: () => navigate('/helpdesk/automation/' + item.id),
                            }] : []),
                          ]}
                        />
                      </td>
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
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search
              ? t('helpdesk.automation.noResults.title')
              : t('helpdesk.automation.empty.title')}
            description={search
              ? t('helpdesk.automation.noResults.description')
              : t('helpdesk.automation.empty.description')}
            action={search
              ? (
                <INNOButton variant="secondary" onClick={() => setSearch('')}>
                  {t('helpdesk.automation.clearSearch')}
                </INNOButton>
              )
              : canManage ? (
                <Link className="inno-link-button" to="/helpdesk/automation/new">
                  {t('helpdesk.automation.new')}
                </Link>
              ) : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
