import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionToolbar,
  INNOPage,
  INNOSearchField,
  INNOState,
} from '@inno/ui';
import { getPlatformApps } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

export function AppsPage() {
  const canManageApps = usePermission('admin.apps.view');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['platform', 'apps'],
    queryFn: getPlatformApps,
  });

  const apps = useMemo(() => {
    const items = query.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((app) =>
      app.name.toLowerCase().includes(term)
      || app.id.toLowerCase().includes(term),
    );
  }, [query.data, search]);
  return (
    <INNOPage
      eyebrow="Workspace"
      title="Apps"
      description="Applications currently installed, enabled and permitted for your account."
      actions={canManageApps
        ? <Link className="inno-link-button secondary" to="/admin/apps">Manage Apps</Link>
        : undefined}
    >
      {query.isPending ? <LoadingState label="Loading apps…" /> : null}
      {query.isError
        ? <ErrorState error={query.error} retry={() => void query.refetch()} />
        : null}

      {query.data ? (
        <INNOCollection className="app-launcher-collection">
          <INNOCollectionHeader
            title="All Apps"
            description="Open a module without leaving the INNO.One shell."
            meta={<span>{apps.length} available</span>}
          />
          <INNOCollectionToolbar>
            <INNOSearchField
              label="Search apps"
              value={search}
              onChange={setSearch}
              placeholder="Search apps…"
            />
          </INNOCollectionToolbar>

          {apps.length === 0 ? (
            <div className="collection-state">
              <INNOState
                kind={search ? 'no-results' : 'empty'}
                title={search ? 'No apps match your search' : 'No apps available'}
                description={search
                  ? 'Try another keyword.'
                  : 'Apps appear here only when installed, enabled and permitted.'}
              />
            </div>
          ) : (
            <div className="production-app-grid">
              {apps.map((app) => (
                <Link className="production-app-card" to={app.route} key={app.id}>
                  <span className="production-app-mark" aria-hidden="true">
                    {app.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="production-app-copy">
                    <b>{app.name}</b>
                    <small>
                      {app.navigation.length} {app.navigation.length === 1 ? 'destination' : 'destinations'}
                    </small>
                  </span>
                  <span className="production-app-open" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          )}
        </INNOCollection>
      ) : null}
    </INNOPage>
  );
}
