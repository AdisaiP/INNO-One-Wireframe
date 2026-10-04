import { useDeferredValue, useEffect, useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOPage,
  INNOPagination,
  INNOSearchField,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getHelpdeskAutomationDefinitions } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import './WorkflowProductPages.css';

export function AutomationRulesPage() {
  const { t, formatDateTime } = useI18n();
  const canManage = usePermission('helpdesk.automation.manage');
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
        <span>{t('helpdesk.automation.list.description')}</span>
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title={t('helpdesk.automation.list.title')}
          description={t('helpdesk.automation.list.description')}
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
                        <RouterRowAction
                          to={'/helpdesk/automation/' + item.id}
                          ariaLabel={item.name}
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
