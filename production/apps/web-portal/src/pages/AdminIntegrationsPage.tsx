import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOPage,
  INNORowActions,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getAdminIntegrations, testAdminIntegration } from '../api/client';
import type { AdminIntegrationStatus, AdminIntegrationsResponse } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function statusTone(status: AdminIntegrationStatus['status']) {
  if (status === 'connected') return 'success' as const;
  if (status === 'degraded') return 'danger' as const;
  if (status === 'not-configured') return 'warning' as const;
  return 'neutral' as const;
}

function statusLabel(status: AdminIntegrationStatus['status']) {
  if (status === 'not-configured') return 'Not configured';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminIntegrationsPage() {
  const { t: t45n } = useStep45NI18n();
  const canManage = usePermission('admin.integrations.manage');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: getAdminIntegrations,
    refetchOnWindowFocus: false,
  });

  const test = useMutation({
    mutationFn: testAdminIntegration,
    onSuccess: (snapshot) => {
      queryClient.setQueryData<AdminIntegrationsResponse>(
        ['admin', 'integrations'],
        (current) => current
          ? {
              items: current.items.map((item) =>
                item.id === snapshot.id ? snapshot : item),
            }
          : current,
      );
    },
  });

  const items = query.data?.items ?? [];
  const connected = items.filter((item) => item.status === 'connected').length;
  const attention = items.filter((item) =>
    item.status === 'degraded' || item.status === 'not-configured').length;
  const disabled = items.filter((item) => item.status === 'disabled').length;

  return (
    <INNOPage
      eyebrow={t45n('admin.settings.eyebrow')}
      title={t45n('navigation.integrations')}
      description={t45n('admin.step45n.adminIntegrations.monitorRegisteredIntegrationHealthAndRunSafeConnection')}
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t45n('admin.step45n.adminIntegrations.refreshHealth')}</INNOButton>
      )}
    >
      {query.isPending ? <LoadingState label={t45n('admin.step45n.adminIntegrations.checkingIntegrations')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>{t45n('reports.column.registeredAt')}</span><b>{items.length}</b><small>{t45n('admin.step45n.adminIntegrations.diRegisteredProviders')}</small></div>
            <div><span>{t45n('common.status.connected')}</span><b>{connected}</b><small>{t45n('admin.step45n.adminIntegrations.healthyNow')}</small></div>
            <div><span>{t45n('admin.step45n.adminIntegrations.needsAttention')}</span><b>{attention}</b><small>{t45n('admin.step45n.adminIntegrations.degradedOrNotConfigured')}</small></div>
            <div><span>{t45n('admin.step45n.adminApps.disabled')}</span><b>{disabled}</b><small>{t45n('admin.step45n.adminIntegrations.disabledByEnvironment')}</small></div>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title={t45n('admin.step45n.adminIntegrations.integrationRegistry')}
              description={t45n('admin.step45n.adminIntegrations.providersRegisterThroughTheSharedIntegrationHealthContract')}
            />
            {items.length === 0 ? (
              <div className="collection-state">
                <INNOState
                  kind="empty"
                  title={t45n('admin.step45n.adminIntegrations.noIntegrationsRegistered')}
                  description={t45n('admin.step45n.adminIntegrations.registerAnIntegrationHealthProviderInTheApplication')}
                />
              </div>
            ) : (
              <INNOTableWrap width="wide">
                <table>
                  <thead>
                    <tr>
                      <th>{t45n('admin.step45n.adminIntegrations.integration')}</th>
                      <th>{t45n('reports.column.category')}</th>
                      <th>{t45n('reports.column.owner')}</th>
                      <th>{t45n('admin.step45n.adminIntegrations.endpoint')}</th>
                      <th>{t45n('admin.step45n.adminIntegrations.health')}</th>
                      <th>{t45n('admin.step45n.adminIntegrations.lastCheck')}</th>
                      <th className="action-column">{t45n('reports.table.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const testing = test.isPending && test.variables === item.id;
                      return (
                        <tr key={item.id}>
                          <td>
                            <b>{item.name}</b>
                            <div className="table-meta">{item.provider}</div>
                          </td>
                          <td>{item.category}</td>
                          <td>{item.ownerModule}</td>
                          <td>
                            <code className="integration-endpoint">{item.endpoint}</code>
                            <div className="table-meta">
                              {item.capabilities.join(' · ')}
                            </div>
                          </td>
                          <td>
                            <INNOStatus tone={statusTone(item.status)} dot>
                              {statusLabel(item.status)}
                            </INNOStatus>
                            <div className="table-meta integration-health-message">
                              {item.message}
                            </div>
                          </td>
                          <td>
                            {formatCheckedAt(item.checkedAt)}
                            <div className="table-meta">{item.durationMs} {t45n('admin.step45n.adminIntegrations.ms')}</div>
                          </td>
                          <td className="action-column">
                            {canManage && item.canTest ? (
                              <INNORowActions
                                ariaLabel={t45n('admin.step45n.adminIntegrations.actionsFor') + ' ' + item.name}
                                items={[{
                                  id: 'test',
                                  label: t45n('admin.step45n.adminIntegrations.test'),
                                  busy: testing,
                                  disabled: test.isPending && !testing,
                                  onSelect: () => test.mutate(item.id),
                                }]}
                              />
                            ) : (
                              <span className="table-meta">
                                {item.canTest ? t45n('admin.step45n.adminAccessScopes.viewOnly') : t45n('admin.step45n.adminBranding.unavailable')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </INNOTableWrap>
            )}
          </INNOCollection>

          {test.isError ? (
            <INNOState
              kind="error"
              compact
              title={t45n('admin.step45n.adminIntegrations.integrationTestFailed')}
              description={test.error instanceof Error
                ? test.error.message
                : t45n('admin.step45n.adminApps.refreshTheRegistryAndTryAgain')}
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
