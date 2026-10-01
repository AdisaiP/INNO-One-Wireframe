import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOPage,
  INNOPurposeNote,
  INNORowActions,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getAdminIntegrations, testAdminIntegration } from '../api/client';
import type { AdminIntegrationStatus, AdminIntegrationsResponse } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

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
      eyebrow="Admin Center · Platform"
      title="Integrations"
      description="Monitor registered platform integrations without exposing credentials or vendor-specific identifiers."
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh Health
        </INNOButton>
      )}
    >
      {query.isPending ? <LoadingState label="Checking integrations…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>Registered</span><b>{items.length}</b><small>DI-registered providers</small></div>
            <div><span>Connected</span><b>{connected}</b><small>Healthy now</small></div>
            <div><span>Needs attention</span><b>{attention}</b><small>Degraded or not configured</small></div>
            <div><span>Disabled</span><b>{disabled}</b><small>Disabled by environment</small></div>
          </div>

          <INNOPurposeNote
            tone="info"
            title="Configuration remains deployment-managed"
            description="This page exposes health and safe connection tests only. Credentials, secrets, TLS overrides, and provider configuration are never returned by the Admin API."
          />

          <INNOCollection>
            <INNOCollectionHeader
              title="Integration Registry"
              description="Providers register through the shared integration-health contract; future modules can contribute entries without changing this page."
            />
            {items.length === 0 ? (
              <div className="collection-state">
                <INNOState
                  kind="empty"
                  title="No integrations registered"
                  description="Register an integration-health provider in the application dependency container."
                />
              </div>
            ) : (
              <INNOTableWrap width="wide">
                <table>
                  <thead>
                    <tr>
                      <th>Integration</th>
                      <th>Category</th>
                      <th>Owner</th>
                      <th>Endpoint</th>
                      <th>Health</th>
                      <th>Last check</th>
                      <th className="action-column">Action</th>
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
                            <div className="table-meta">{item.durationMs} ms</div>
                          </td>
                          <td className="action-column">
                            {canManage && item.canTest ? (
                              <INNORowActions
                                ariaLabel={'Actions for ' + item.name}
                                items={[{
                                  id: 'test',
                                  label: 'Test',
                                  busy: testing,
                                  disabled: test.isPending && !testing,
                                  onSelect: () => test.mutate(item.id),
                                }]}
                              />
                            ) : (
                              <span className="table-meta">
                                {item.canTest ? 'View only' : 'Unavailable'}
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
              title="Integration test failed"
              description={test.error instanceof Error
                ? test.error.message
                : 'Refresh the registry and try again.'}
            />
          ) : null}
        </>
      ) : null}
    </INNOPage>
  );
}
