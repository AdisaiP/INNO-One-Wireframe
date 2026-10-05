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
import { getDeviceAutomationDefinitions } from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function DevicesAutomationRulesPage() {
  const { t: t45n } = useStep45NI18n();
  const { t, formatDateTime } = useI18n();
  const navigate = useNavigate();
  const canManage = usePermission('devices.automation.manage');
  const canViewRuns = usePermission('devices.automation.run.view');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [deferredSearch]);

  const query = useQuery({
    queryKey: ['devices', 'automation-definitions', page, deferredSearch],
    queryFn: () => getDeviceAutomationDefinitions({
      page,
      pageSize: 25,
      search: deferredSearch,
    }),
  });

  const items = query.data?.items ?? [];

  return (
    <INNOPage
      eyebrow={t('devices.automation.eyebrow')}
      title={t('devices.automation.title')}
      description={t('devices.automation.description')}
      actions={canManage ? (
        <Link className="inno-link-button" to="/devices/automation/new">
          {t('devices.automation.new')}
        </Link>
      ) : undefined}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('devices.automation.boundary.title')}</b>
        <span>{t('devices.automation.boundary.description')}</span>
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title={t('devices.automation.list.title')}
          description={t('devices.automation.list.description')}
          meta={query.data ? (
            <INNOStatus tone="neutral">
              {t('devices.automation.count', { count: query.data.totalItems })}
            </INNOStatus>
          ) : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label={t('devices.automation.search.label')}
            value={search}
            onChange={setSearch}
            placeholder={t('devices.automation.search.placeholder')}
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
                    <th>{t('devices.automation.table.name')}</th>
                    <th className="numeric-column">{t('devices.automation.table.version')}</th>
                    <th>{t('devices.automation.table.status')}</th>
                    <th>{t('devices.automation.table.updated')}</th>
                    <th className="action-column">{t('devices.automation.table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.name}</b>
                        <div className="table-meta">{item.id}</div>
                      </td>
                      <td className="numeric-column">{t45n('assets.step45n.assetsAutomationRules.v')}{item.version}</td>
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
                              id: 'history',
                              label: t('devices.automation.history'),
                              onSelect: () => navigate('/devices/automation/' + item.id + '/history'),
                            }] : []),
                            ...(canManage ? [{
                              id: 'edit',
                              label: t('devices.automation.edit'),
                              onSelect: () => navigate('/devices/automation/' + item.id),
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
              ? t('devices.automation.noResults.title')
              : t('devices.automation.empty.title')}
            description={search
              ? t('devices.automation.noResults.description')
              : t('devices.automation.empty.description')}
            action={search ? (
              <INNOButton variant="secondary" onClick={() => setSearch('')}>
                {t('devices.automation.clearSearch')}
              </INNOButton>
            ) : canManage ? (
              <Link className="inno-link-button" to="/devices/automation/new">
                {t('devices.automation.new')}
              </Link>
            ) : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
