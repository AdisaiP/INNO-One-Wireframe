import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOCollection,
  INNOCollectionHeader,
  INNOPage,
  INNOState,
  INNOStatus,
} from '@inno/ui';
import { getAdminApps, updateAdminApp } from '../api/client';
import type { AdminAppModule } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

function statusTone(status: AdminAppModule['status']) {
  if (status === 'enabled') return 'success' as const;
  if (status === 'not-installed') return 'warning' as const;
  return 'neutral' as const;
}

export function AdminAppsPage() {
  const canManageApps = usePermission('admin.apps.manage');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['platform', 'admin-apps'],
    queryFn: getAdminApps,
  });
  const mutation = useMutation({
    mutationFn: ({
      appId,
      eTag,
      enabled,
    }: {
      appId: string;
      eTag?: string | null;
      enabled: boolean;
    }) => updateAdminApp(appId, eTag, enabled),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform', 'admin-apps'] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'apps'] }),
        queryClient.invalidateQueries({ queryKey: ['platform', 'me'] }),
      ]);
    },
  });
  const items = query.data?.items ?? [];
  const installed = items.filter((item) => item.installed).length;
  const enabled = items.filter((item) => item.enabled).length;
  const available = items.filter((item) => !item.installed).length;

  return (
    <INNOPage
      eyebrow="Admin Center"
      title="Apps & Modules"
      description="Manage module availability from the central registry."
      actions={<Link className="inno-link-button secondary" to="/apps">Preview Launcher</Link>}
    >
      {query.isPending ? <LoadingState label="Loading module registry…" /> : null}
      {query.isError
        ? <ErrorState error={query.error} retry={() => void query.refetch()} />
        : null}
      {mutation.isError ? (
        <INNOState
          kind="error"
          compact
          title="Module availability was not changed"
          description={mutation.error instanceof Error
            ? mutation.error.message
            : 'Refresh the registry and try again.'}
        />
      ) : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>Registry schema</span><b>{query.data.schemaVersion}</b><small>Manifest contract</small></div>
            <div><span>Installed</span><b>{installed}</b><small>Packages present</small></div>
            <div><span>Enabled</span><b>{enabled}</b><small>Organization availability</small></div>
            <div><span>Available</span><b>{available}</b><small>Install workflow not exposed</small></div>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title="Module Registry"
              description="Installed modules can be enabled or disabled. Inspect is always available."
            />
            <div className="production-module-list">
              {items.map((app) => {
                const busy = mutation.isPending
                  && mutation.variables?.appId === app.id;
                return (
                  <article className="production-module-row" key={app.id}>
                    <span className="production-app-mark" aria-hidden="true">
                      {app.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="production-module-identity">
                      <div className="production-module-title">
                        <b>{app.name}</b>
                        <INNOStatus tone={statusTone(app.status)}>
                          {app.status === 'not-installed' ? 'Available' : app.status === 'enabled' ? 'Enabled' : 'Disabled'}
                        </INNOStatus>
                      </div>
                      <small>{app.route} · {app.dependencies.length} dependencies</small>
                    </div>

                    <div className="production-module-actions">
                      {app.installed && canManageApps ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={app.enabled}
                          aria-label={(app.enabled ? 'Disable ' : 'Enable ') + app.name}
                          className={'production-switch' + (app.enabled ? ' on' : '')}
                          disabled={busy}
                          aria-busy={busy || undefined}
                          onClick={() => mutation.mutate({
                            appId: app.id,
                            eTag: app.eTag,
                            enabled: !app.enabled,
                          })}
                        >
                          <span aria-hidden="true" />
                        </button>
                      ) : null}
                      <details className="production-module-inspect">
                        <summary>Inspect</summary>
                        <div className="production-module-detail">
                          <div><span>Entry permission</span><b>{app.entryPermission}</b></div>
                          <div><span>Dependencies</span><b>{app.dependencies.join(', ') || 'None'}</b></div>
                          <div><span>Capabilities</span><b>{app.capabilities.join(', ') || 'None'}</b></div>
                          <div><span>Events</span><b>{app.events.join(', ') || 'None'}</b></div>
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          </INNOCollection>
        </>
      ) : null}
    </INNOPage>
  );
}
