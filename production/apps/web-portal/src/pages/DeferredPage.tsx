import { Link } from 'react-router-dom';
import { INNOPage, INNOState, type INNOStateKind } from '@inno/ui';
import { ModuleDisabledState, PermissionState } from '../components/Feedback';

export function DeferredPage({
  name,
  kind = 'disabled',
}: {
  name: string;
  kind?: Extract<INNOStateKind, 'permission' | 'disabled' | 'no-results'>;
}) {
  if (kind === 'permission') {
    return (
      <INNOPage eyebrow="Access" title={name}>
        <PermissionState
          action={<Link className="inno-link-button secondary" to="/">Back to Workspace</Link>}
        />
      </INNOPage>
    );
  }

  if (kind === 'disabled') {
    return (
      <INNOPage eyebrow="Availability" title={name}>
        <ModuleDisabledState
          action={<Link className="inno-link-button secondary" to="/apps">Open Apps</Link>}
        />
      </INNOPage>
    );
  }

  return (
    <INNOPage eyebrow="Navigation" title={name}>
      <INNOState
        kind="no-results"
        title="Page not found"
        description="The requested route does not exist in the current INNO.One production surface."
        action={<Link className="inno-link-button secondary" to="/">Back to Workspace</Link>}
      />
    </INNOPage>
  );
}
