import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOIcon,
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOPage,
  INNOSearchField,
} from '@inno/ui';
import { getPlatformApps } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AppsPage() {
  const { t: t45n } = useStep45NI18n();
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
      eyebrow={t45n('navigation.workspace')}
      title={t45n('navigation.apps')}
      description={t45n('common.step45n.apps.appsAvailableToYourOrganizationAndRole')}
      actions={canManageApps
        ? <Link className="inno-link-button secondary" to="/admin/apps">{t45n('common.step45n.apps.manageApps')}</Link>
        : undefined}
      illustration={<img src="/illustrations/apps-ecosystem.svg" alt="" />}
    >
      {query.isPending ? <LoadingState label={t45n('common.step45n.apps.loadingApps')} /> : null}
      {query.isError
        ? <ErrorState error={query.error} retry={() => void query.refetch()} />
        : null}

      {query.data ? (
        <INNOCollection className="app-launcher-collection">
          <INNOCollectionHeader
            title={t45n('navigation.allApps')}
            description={t45n('common.step45n.apps.openAModuleWithoutLeavingTheInnoOne')}
            meta={<span>{apps.length} {t45n('common.step45n.apps.available')}</span>}
          />
          <INNOCollectionToolbar>
            <INNOSearchField
              label={t45n('common.step45n.apps.searchApps')}
              value={search}
              onChange={setSearch}
              placeholder={t45n('common.step45n.apps.searchApps2')}
            />
          </INNOCollectionToolbar>

          {apps.length === 0 ? (
            <INNOCollectionState
              kind={search ? 'no-results' : 'empty'}
              title={search ? t45n('common.step45n.apps.noAppsMatchYourSearch') : t45n('common.step45n.apps.noAppsAvailable')}
              description={search
                ? t45n('common.step45n.apps.tryAnotherKeyword')
                : t45n('common.step45n.apps.appsAppearHereOnlyWhenInstalledEnabledAnd')}
              action={search ? <INNOButton variant="secondary" onClick={() => setSearch('')}>{t45n('assets.automation.clearSearch')}</INNOButton> : undefined}
            />
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
                      {app.navigation.length} {app.navigation.length === 1 ? t45n('common.step45n.apps.destination') : t45n('common.step45n.apps.destinations')}
                    </small>
                  </span>
                  <span className="production-app-open" aria-hidden="true"><INNOIcon token="action.next" size={15} /></span>
                </Link>
              ))}
            </div>
          )}
        </INNOCollection>
      ) : null}
    </INNOPage>
  );
}
