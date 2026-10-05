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
import { getAssetsAutomationDefinitions } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';

export function AssetsAutomationRulesPage() {
  const { t, formatDateTime } = useI18n();
  const navigate = useNavigate();
  const canManage = usePermission('assets.automation.manage');
  const canViewRuns = usePermission('assets.automation.run.view');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch]);

  const query = useQuery({
    queryKey: ['assets', 'automation-definitions', page, deferredSearch],
    queryFn: () => getAssetsAutomationDefinitions({
      page,
      pageSize: 25,
      search: deferredSearch,
    }),
  });

  const items = query.data?.items ?? [];

  return (
    <INNOPage
      eyebrow={t('assets.automation.eyebrow')}
      title={t('assets.automation.title')}
      description={t('assets.automation.description')}
      actions={canManage ? (
        <Link className="inno-link-button" to="/assets/automation/new">
          {t('assets.automation.new')}
        </Link>
      ) : undefined}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('assets.automation.boundary.title')}</b>
        <span>{t('assets.automation.boundary.description')}</span>
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title={t('assets.automation.list.title')}
          description={t('assets.automation.list.description')}
          meta={query.data ? (
            <INNOStatus tone="neutral">
              {t('assets.automation.count', { count: query.data.totalItems })}
            </INNOStatus>
          ) : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label={t('assets.automation.search.label')}
            value={search}
            onChange={setSearch}
            placeholder={t('assets.automation.search.placeholder')}
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
                    <th>{t('assets.automation.table.name')}</th>
                    <th className="numeric-column">{t('assets.automation.table.version')}</th>
                    <th>{t('assets.automation.table.status')}</th>
                    <th>{t('assets.automation.table.updated')}</th>
                    <th className="action-column">{t('assets.automation.table.action')}</th>
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
                              label: t('assets.automation.runs'),
                              onSelect: () => navigate('/assets/automation/' + item.id + '/runs'),
                            }] : []),
                            ...(canManage ? [{
                              id: 'edit',
                              label: t('assets.automation.edit'),
                              onSelect: () => navigate('/assets/automation/' + item.id),
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
              ? t('assets.automation.noResults.title')
              : t('assets.automation.empty.title')}
            description={search
              ? t('assets.automation.noResults.description')
              : t('assets.automation.empty.description')}
            action={search ? (
              <INNOButton variant="secondary" onClick={() => setSearch('')}>
                {t('assets.automation.clearSearch')}
              </INNOButton>
            ) : canManage ? (
              <Link className="inno-link-button" to="/assets/automation/new">
                {t('assets.automation.new')}
              </Link>
            ) : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
