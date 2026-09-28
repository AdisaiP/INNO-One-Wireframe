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
  const query = useQuery({
    queryKey: ['admin', 'security'],
    queryFn: getAdminSecurity,
    refetchOnWindowFocus: false,
  });

  const rows: SecurityRow[] = query.data?.items.flatMap((provider) =>
    provider.controls.map((control) => ({ provider, control }))) ?? [];

  return (
    <INNOPage
      eyebrow="Admin Center · Security"
      title="Security"
      description="Inspect runtime security posture without exposing credentials or inventing policy settings that are not part of the current contract."
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh Posture
        </INNOButton>
      )}
    >
      {query.isPending ? <LoadingState label="Checking security posture…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div>
              <span>Providers</span>
              <b>{query.data.summary.providers}</b>
              <small>Registered posture sources</small>
            </div>
            <div>
              <span>Healthy</span>
              <b>{query.data.summary.healthy}</b>
              <small>Controls verified now</small>
            </div>
            <div>
              <span>Needs attention</span>
              <b>{query.data.summary.attention}</b>
              <small>Runtime settings to review</small>
            </div>
            <div>
              <span>Unavailable</span>
              <b>{query.data.summary.unavailable}</b>
              <small>Checks that could not run</small>
            </div>
          </div>

          <INNOState
            compact
            title="Security policy changes are not exposed yet"
            description="The current contracts reserve Security permissions but do not freeze mutable MFA, password, session, or identity-provider policy resources. This step reports only runtime posture that can be verified safely."
          />

          <INNOCollection>
            <INNOCollectionHeader
              title="Security Posture"
              description={'Configuration mode: ' + query.data.configurationMode + '. Last checked ' + formatCheckedAt(query.data.checkedAt) + '.'}
              meta={(
                <INNOStatus tone={query.data.summary.attention || query.data.summary.unavailable ? 'warning' : 'success'} dot>
                  {query.data.summary.attention || query.data.summary.unavailable
                    ? 'Review recommended'
                    : 'No detected issues'}
                </INNOStatus>
              )}
            />

            {rows.length === 0 ? (
              <div className="collection-state">
                <INNOState
                  kind="empty"
                  title="No security posture providers"
                  description="Register a security posture provider before exposing this Admin surface."
                />
              </div>
            ) : (
              <INNOTableWrap width="xwide">
                <table>
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Control</th>
                      <th>Status</th>
                      <th>Observed value</th>
                      <th>Detail</th>
                      <th>Last check</th>
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
                          <div className="table-meta">{provider.durationMs} ms</div>
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
