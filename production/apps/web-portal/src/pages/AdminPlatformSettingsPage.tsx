import { useQuery } from '@tanstack/react-query';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOPage,
  INNOPurposeNote,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getAdminPlatformSettings } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminPlatformSettingsPage() {
  const query = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: getAdminPlatformSettings,
    refetchOnWindowFocus: false,
  });

  return (
    <INNOPage
      eyebrow="Admin Center · Platform"
      title="Platform Settings"
      description="Inspect the effective global platform conventions and deployment-managed values that are defined by the frozen contracts."
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh Settings
        </INNOButton>
      )}
    >
      {query.isPending ? <LoadingState label="Loading platform settings…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <div className="production-stat-strip">
            <div>
              <span>Environment</span>
              <b className="platform-setting-stat-value">{query.data.environment}</b>
              <small>Current hosting environment</small>
            </div>
            <div>
              <span>Groups</span>
              <b>{query.data.groups.length}</b>
              <small>Effective settings groups</small>
            </div>
            <div>
              <span>Settings</span>
              <b>{query.data.items.length}</b>
              <small>Safe values exposed</small>
            </div>
            <div>
              <span>Mode</span>
              <b className="platform-setting-stat-value">Read only</b>
              <small>{query.data.configurationMode}</small>
            </div>
          </div>

          <INNOPurposeNote
            title="Platform settings are deployment-managed"
            description="The current contracts reserve admin.settings.manage, but they do not define a persisted global settings resource or audited update API. This page therefore exposes only safe effective values and frozen platform conventions."
          />

          <INNOCollection>
            <INNOCollectionHeader
              title="Effective Platform Settings"
              description={'Last checked ' + formatCheckedAt(query.data.checkedAt) + '. Sensitive deployment configuration is intentionally excluded.'}
              meta={(
                <INNOStatus tone="success" dot>
                  Contract aligned
                </INNOStatus>
              )}
            />

            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Setting</th>
                    <th>Effective value</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.group}</td>
                      <td>
                        <b>{item.name}</b>
                        <div className="table-meta">{item.id}</div>
                      </td>
                      <td>
                        <code className="platform-setting-value">{item.value}</code>
                      </td>
                      <td>{item.source}</td>
                      <td>
                        <INNOStatus tone={item.status === 'frozen' ? 'success' : 'neutral'} dot>
                          {item.status === 'frozen' ? 'Frozen' : 'Effective'}
                        </INNOStatus>
                      </td>
                      <td>{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
          </INNOCollection>

          <INNOPurposeNote
            title="Future mutation boundary"
            description="Before timezone defaults, retention values, notification defaults, or other global settings become editable, define the settings schema, validation, ETag concurrency, audit events, and ownership boundaries. Module-specific settings should remain with their owning module."
          />
        </>
      ) : null}
    </INNOPage>
  );
}
