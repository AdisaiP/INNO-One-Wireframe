import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNODrawer,
  INNOPage,
  INNOState,
  INNOStatus,
} from '@inno/ui';
import { getAdminApps, updateAdminApp } from '../api/client';
import type { AdminAppModule } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function statusTone(status: AdminAppModule['status']) {
  if (status === 'enabled') return 'success' as const;
  if (status === 'not-installed') return 'warning' as const;
  return 'neutral' as const;
}

export function AdminAppsPage() {
  const { t: t45n } = useStep45NI18n();
  const canManageApps = usePermission('admin.apps.manage');
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AdminAppModule | null>(null);
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
      eyebrow={t45n('navigation.admin')}
      title={t45n('navigation.appsModules')}
      description={t45n('admin.step45n.adminApps.manageModuleAvailabilityFromTheCentralRegistry')}
      actions={<Link className="inno-link-button secondary" to="/apps">{t45n('admin.step45n.adminApps.previewLauncher')}</Link>}
    >
      {query.isPending ? <LoadingState label={t45n('admin.step45n.adminApps.loadingModuleRegistry')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {mutation.isError ? (
        <INNOState
          kind="error"
          compact
          title={t45n('admin.step45n.adminApps.moduleAvailabilityWasNotChanged')}
          description={mutation.error instanceof Error
            ? mutation.error.message
            : t45n('admin.step45n.adminApps.refreshTheRegistryAndTryAgain')}
        />
      ) : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div><span>{t45n('admin.step45n.adminApps.registrySchema')}</span><b>{query.data.schemaVersion}</b><small>{t45n('admin.step45n.adminApps.manifestContract')}</small></div>
            <div><span>{t45n('admin.step45n.adminApps.installed')}</span><b>{installed}</b><small>{t45n('admin.step45n.adminApps.packagesPresent')}</small></div>
            <div><span>{t45n('reports.schedules.enabled')}</span><b>{enabled}</b><small>{t45n('admin.step45n.adminApps.organizationAvailability')}</small></div>
            <div><span>{t45n('admin.step45n.adminApps.available')}</span><b>{available}</b><small>{t45n('admin.step45n.adminApps.installWorkflowNotExposed')}</small></div>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title={t45n('admin.step45n.adminApps.moduleRegistry')}
              description={t45n('admin.step45n.adminApps.installedModulesCanBeEnabledOrDisabledInspect')}
            />
            <div className="production-module-list">
              {items.map((app) => {
                const busy = mutation.isPending && mutation.variables?.appId === app.id;
                return (
                  <article className="production-module-row" key={app.id}>
                    <span className="production-app-mark" aria-hidden="true">
                      {app.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="production-module-identity">
                      <div className="production-module-title">
                        <b>{app.name}</b>
                        <INNOStatus tone={statusTone(app.status)}>
                          {app.status === 'not-installed' ? t45n('admin.step45n.adminApps.available') : app.status === 'enabled' ? t45n('reports.schedules.enabled') : t45n('admin.step45n.adminApps.disabled')}
                        </INNOStatus>
                      </div>
                      <small>{app.route} · {app.dependencies.length} {t45n('admin.step45n.adminApps.dependencies2')}</small>
                    </div>

                    <div className="production-module-actions">
                      {app.installed && canManageApps ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={app.enabled}
                          aria-label={(app.enabled ? t45n('admin.step45n.adminApps.disable') + ' ' : t45n('admin.step45n.adminApps.enable') + ' ') + app.name}
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
                      <INNOButton type="button" variant="secondary" onClick={() => setSelected(app)}>{t45n('helpdesk.automation.runs.inspect')}</INNOButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </INNOCollection>
        </>
      ) : null}

      <INNODrawer
        open={Boolean(selected)}
        title={selected?.name ?? t45n('admin.step45n.adminApps.module')}
        description={t45n('admin.step45n.adminApps.technicalManifestAndModuleCapabilityMetadata')}
        onClose={() => setSelected(null)}
        size="md"
        className="admin-app-inspect-drawer"
      >
        {selected ? (
          <div className="production-kv-grid">
            <div className="kv-row"><span>{t45n('reports.runs.status')}</span><b>{selected.status}</b></div>
            <div className="kv-row"><span>{t45n('admin.step45n.adminApps.route')}</span><b>{selected.route}</b></div>
            <div className="kv-row"><span>{t45n('admin.step45n.adminApps.entryPermission')}</span><b>{selected.entryPermission}</b></div>
            <div className="kv-row"><span>{t45n('admin.step45n.adminApps.dependencies')}</span><b>{selected.dependencies.join(', ') || t45n('admin.step45n.adminApps.none')}</b></div>
            <div className="kv-row"><span>{t45n('admin.step45n.adminApps.capabilities')}</span><b>{selected.capabilities.join(', ') || t45n('admin.step45n.adminApps.none')}</b></div>
            <div className="kv-row"><span>{t45n('admin.step45n.adminApps.events')}</span><b>{selected.events.join(', ') || t45n('admin.step45n.adminApps.none')}</b></div>
          </div>
        ) : null}
      </INNODrawer>
    </INNOPage>
  );
}
