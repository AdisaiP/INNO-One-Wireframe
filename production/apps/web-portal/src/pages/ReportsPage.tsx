import { useDeferredValue, useEffect, useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { getReports, startReportRun } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';

export function ReportsPage() {
  const { t, formatDateTime } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = usePermission('reports.create');
  const canManage = usePermission('reports.manage');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState('');

  useEffect(() => setPage(1), [deferredSearch]);

  const query = useQuery({
    queryKey: ['reports', 'definitions', page, deferredSearch],
    queryFn: () => getReports({ page, pageSize: 25, search: deferredSearch }),
  });

  const run = useMutation({
    mutationFn: (reportId: string) => startReportRun(reportId),
    onSuccess: async (result, reportId) => {
      setFeedback(result.status === 'completed'
        ? t('reports.toast.generated')
        : result.errorDetail || result.errorCode || t('reports.run.failed'));
      await queryClient.invalidateQueries({ queryKey: ['reports', 'runs', reportId] });
      navigate('/reports/' + reportId + '/runs');
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const items = query.data?.items ?? [];

  return (
    <INNOPage
      eyebrow={t('reports.eyebrow')}
      title={t('reports.title')}
      description={t('reports.description')}
      actions={(
        <div className="page-header-actions">
          <Link className="inno-link-button secondary" to="/reports/schedules">
            {t('reports.schedules')}
          </Link>
          {canCreate ? (
            <Link className="inno-link-button" to="/reports/new">
              {t('reports.new')}
            </Link>
          ) : null}
        </div>
      )}
    >
      {feedback ? <div className="workflow-product-boundary" role="status">{feedback}</div> : null}

      <INNOCollection>
        <INNOCollectionHeader
          title={t('reports.title')}
          description={t('reports.description')}
          meta={query.data ? <INNOStatus>{query.data.totalItems}</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label={t('reports.search')}
            value={search}
            onChange={setSearch}
            placeholder={t('reports.search')}
          />
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : items.length ? (
          <>
            <INNOTableWrap stickyAction>
              <table>
                <thead>
                  <tr>
                    <th>{t('reports.table.name')}</th>
                    <th>{t('reports.table.source')}</th>
                    <th>{t('reports.table.format')}</th>
                    <th>{t('reports.table.updated')}</th>
                    <th className="action-column">{t('reports.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.name}</b>
                        {item.description ? <div className="table-meta">{item.description}</div> : null}
                      </td>
                      <td>{t('reports.source.' + item.sourceKey)}</td>
                      <td><INNOStatus>{item.outputFormat.toUpperCase()}</INNOStatus></td>
                      <td>{formatDateTime(item.updatedAt)}</td>
                      <td className="action-column">
                        <INNORowActions
                          ariaLabel={item.name}
                          items={[
                            ...(canCreate ? [{
                              id: 'generate',
                              label: t('reports.action.generate'),
                              onSelect: () => run.mutate(item.id),
                            }] : []),
                            {
                              id: 'runs',
                              label: t('reports.action.runs'),
                              onSelect: () => navigate('/reports/' + item.id + '/runs'),
                            },
                            ...(canManage ? [{
                              id: 'edit',
                              label: t('reports.action.edit'),
                              onSelect: () => navigate('/reports/' + item.id),
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
            title={t(search ? 'reports.noResults.title' : 'reports.empty.title')}
            description={t(search ? 'reports.noResults.description' : 'reports.empty.description')}
            action={search ? (
              <INNOButton variant="secondary" onClick={() => setSearch('')}>
                {t('reports.action.clear')}
              </INNOButton>
            ) : canCreate ? (
              <Link className="inno-link-button" to="/reports/new">{t('reports.new')}</Link>
            ) : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
