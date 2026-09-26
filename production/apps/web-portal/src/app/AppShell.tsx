import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { logout } from '../auth/keycloak';
import { usePermission, useProfile } from './ProfileContext';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AppShell() {
  const profile = useProfile();
  const canViewDevices = usePermission('devices.view');
  const canDeployDevices = usePermission('devices.deploy');
  const canViewHelpdesk = usePermission('helpdesk.ticket.view');
  const location = useLocation();
  const inDevices = location.pathname.startsWith('/devices');
  const inHelpdesk = location.pathname.startsWith('/helpdesk');
  const inProfile = location.pathname.startsWith('/profile');
  const homePath = canViewDevices ? '/devices' : canViewHelpdesk ? '/helpdesk' : '/profile';

  return (
    <div className="inno-production-shell">
      <header className="prod-header">
        <NavLink className="prod-brand" to={homePath}>
          <span className="prod-logo-mark">I1</span>
          <span>INNO.<b>One</b></span>
        </NavLink>
        <div className="prod-header-center" aria-hidden="true" />
        <div className="prod-header-actions">
          <NavLink className="prod-user" to="/profile" aria-label="Open Profile & Settings">
            <span className="prod-avatar">{initials(profile.fullName)}</span>
            <span className="prod-user-copy">
              <b>{profile.fullName}</b>
              <small>{profile.roles[0] ?? 'User'}</small>
            </span>
          </NavLink>
          <button className="prod-icon-button" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="prod-shell-body">
        <aside className="prod-rail" aria-label="App navigation">
          {canViewDevices ? (
            <NavLink className={inDevices ? 'active' : ''} to="/devices" aria-label="Devices">D</NavLink>
          ) : null}
          {canViewHelpdesk ? (
            <NavLink className={inHelpdesk ? 'active' : ''} to="/helpdesk" aria-label="Helpdesk">H</NavLink>
          ) : null}
          <span className="grow" />
          <NavLink className={inProfile ? 'active' : ''} to="/profile" aria-label="Profile & Settings">P</NavLink>
        </aside>

        <aside
          className="prod-side"
          aria-label={inProfile ? 'Account navigation' : inHelpdesk ? 'Helpdesk navigation' : 'Devices navigation'}
        >
          {inProfile ? (
            <>
              <div className="prod-side-title">Account</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink to="/profile">Profile & Settings</NavLink>
            </>
          ) : inHelpdesk ? (
            <>
              <div className="prod-side-title">Helpdesk</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/helpdesk">Overview</NavLink>
              <NavLink end to="/helpdesk/tickets">Tickets</NavLink>
              <NavLink to="/helpdesk/assigned">Assigned to Me</NavLink>
              <NavLink to="/helpdesk/team">Team Queue</NavLink>
            </>
          ) : (
            <>
              <div className="prod-side-title">Devices</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/devices">Devices</NavLink>
              <NavLink to="/devices/discovery">Discovery</NavLink>
              <NavLink to="/devices/groups">Device Groups</NavLink>
              {canDeployDevices ? <NavLink to="/devices/add">Agent Deployment</NavLink> : null}
            </>
          )}
        </aside>

        <div className="prod-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
