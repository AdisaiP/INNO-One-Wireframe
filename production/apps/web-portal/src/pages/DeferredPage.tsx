import { Link } from 'react-router-dom';
import { INNOPage, INNOState, type INNOStateKind } from '@inno/ui';
import { ModuleDisabledState, PermissionState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function DeferredPage({
  name,
  kind = 'disabled',
}: {
  name: string;
  kind?: Extract<INNOStateKind, 'permission' | 'disabled' | 'no-results'>;
}) {
  const { t: t45n } = useStep45NI18n();
  if (kind === 'permission') {
    return (
      <INNOPage eyebrow={t45n('navigation.access')} title={name}>
        <PermissionState
          action={<Link className="inno-link-button secondary" to="/">{t45n('common.step45n.deferred.backToWorkspace')}</Link>}
        />
      </INNOPage>
    );
  }

  if (kind === 'disabled') {
    return (
      <INNOPage eyebrow={t45n('common.step45n.deferred.availability')} title={name}>
        <ModuleDisabledState
          action={<Link className="inno-link-button secondary" to="/apps">{t45n('common.step45n.deferred.openApps')}</Link>}
        />
      </INNOPage>
    );
  }

  return (
    <INNOPage eyebrow={t45n('common.step45n.deferred.navigation')} title={name}>
      <INNOState
        kind="no-results"
        title={t45n('common.step45n.deferred.pageNotFound')}
        description={t45n('common.step45n.deferred.theRequestedRouteDoesNotExistInThe')}
        action={<Link className="inno-link-button secondary" to="/">{t45n('common.step45n.deferred.backToWorkspace')}</Link>}
      />
    </INNOPage>
  );
}
