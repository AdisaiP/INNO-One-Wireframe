import { useQuery } from '@tanstack/react-query';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOPage,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getAdminSecurity } from '../api/client';
import type {
  AdminSecurityControl,
  AdminSecurityPostureItem,
  AdminSecurityStatus,
} from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function statusTone(status: AdminSecurityStatus) {
  if (status === 'healthy') return 'success' as const;
  if (status === 'attention') return 'warning' as const;
  if (status === 'unavailable') return 'danger' as const;
  return 'neutral' as const;
}

function statusLabel(status: AdminSecurityStatus) {
  if (status === 'informational') return 'Informational';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

type SecurityRow = {
  provider: AdminSecurityPostureItem;
  control: AdminSecurityControl;
};

export function AdminSecurityPage() {
  const { t: t45n } = useStep45NI18n();
  const query = useQuery({
    queryKey: ['admin', 'security'],
    queryFn: getAdminSecurity,
    refetchOnWindowFocus: false,
  });

  const rows: SecurityRow[] = query.data?.items.flatMap((provider) =>
    provider.controls.map((control) => ({ provider, control }))) ?? [];

  return (
    <INNOPage
      eyebrow={t45n('admin.step45n.adminAudit.adminCenterSecurity')}
      title={t45n('navigation.security')}
      description={t45n('admin.step45n.adminSecurity.inspectRuntimeSecurityPostureAndVerifiedControlsPolicy')}
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t45n('admin.step45n.adminSecurity.refreshPosture')}</INNOButton>
      )}
    >
      {query.isPending ? <LoadingState label={t45n('admin.step45n.adminSecurity.checkingSecurityPosture')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div>
              <span>{t45n('admin.step45n.adminSecurity.providers')}</span>
              <b>{query.data.summary.providers}</b>
              <small>{t45n('admin.step45n.adminSecurity.registeredPostureSources')}</small>
            </div>
            <div>
              <span>{t45n('common.status.healthy')}</span>
              <b>{query.data.summary.healthy}</b>
              <small>{t45n('admin.step45n.adminSecurity.controlsVerifiedNow')}</small>
            </div>
            <div>
              <span>{t45n('admin.step45n.adminIntegrations.needsAttention')}</span>
              <b>{query.data.summary.attention}</b>
              <small>{t45n('admin.step45n.adminSecurity.runtimeSettingsToReview')}</small>
            </div>
            <div>
              <span>{t45n('admin.step45n.adminBranding.unavailable')}</span>
              <b>{query.data.summary.unavailable}</b>
              <small>{t45n('admin.step45n.adminSecurity.checksThatCouldNotRun')}</small>
            </div>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title={t45n('admin.step45n.adminSecurity.securityPosture')}
              description={t45n('admin.step45n.adminSecurity.configurationMode') + ' ' + query.data.configurationMode + t45n('admin.step45n.adminSecurity.lastChecked') + ' ' + formatCheckedAt(query.data.checkedAt) + '.'}
              meta={(
                <INNOStatus tone={query.data.summary.attention || query.data.summary.unavailable ? 'warning' : 'success'} dot>
                  {query.data.summary.attention || query.data.summary.unavailable
                    ? t45n('admin.step45n.adminSecurity.reviewRecommended')
                    : t45n('admin.step45n.adminSecurity.noDetectedIssues')}
                </INNOStatus>
              )}
            />

            {rows.length === 0 ? (
              <div className="collection-state">
                <INNOState
                  kind="empty"
                  title={t45n('admin.step45n.adminSecurity.noSecurityPostureProviders')}
                  description={t45n('admin.step45n.adminSecurity.registerASecurityPostureProviderBeforeExposingThis')}
                />
              </div>
            ) : (
              <INNOTableWrap width="xwide">
                <table>
                  <thead>
                    <tr>
                      <th>{t45n('admin.step45n.adminSecurity.area')}</th>
                      <th>{t45n('admin.step45n.adminSecurity.control')}</th>
                      <th>{t45n('reports.runs.status')}</th>
                      <th>{t45n('admin.step45n.adminSecurity.observedValue')}</th>
                      <th>{t45n('admin.settings.table.detail')}</th>
                      <th>{t45n('admin.step45n.adminIntegrations.lastCheck')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ provider, control }) => (
                      <tr key={provider.id + ':' + control.id}>
                        <td>
                          <b>{provider.name}</b>
                          <div className="table-meta">
                            {provider.category} · {provider.ownerModule}
                          </div>
                        </td>
                        <td>
                          <b>{control.name}</b>
                          <div className="table-meta">{control.id}</div>
                        </td>
                        <td>
                          <INNOStatus tone={statusTone(control.status)} dot>
                            {statusLabel(control.status)}
                          </INNOStatus>
                        </td>
                        <td>{control.value}</td>
                        <td>
                          {control.detail}
                          <div className="table-meta">{provider.message}</div>
                        </td>
                        <td>
                          {formatCheckedAt(provider.checkedAt)}
                          <div className="table-meta">{provider.durationMs} {t45n('admin.step45n.adminIntegrations.ms')}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
            )}
          </INNOCollection>
        </>
      ) : null}
    </INNOPage>
  );
}
