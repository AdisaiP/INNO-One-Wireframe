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
  const location = useLocation();
  const inDevices = location.pathname.startsWith('/devices');
  const inProfile = location.pathname.startsWith('/profile');

  return (
    <div className="inno-production-shell">
      <header className="prod-header">
        <NavLink className="prod-brand" to={canViewDevices ? '/devices' : '/profile'}>
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
          <span className="grow" />
          <NavLink className={inProfile ? 'active' : ''} to="/profile" aria-label="Profile & Settings">P</NavLink>
        </aside>

        <aside className="prod-side" aria-label={inProfile ? 'Account navigation' : 'Devices navigation'}>
          {inProfile ? (
            <>
              <div className="prod-side-title">Account</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink to="/profile">Profile & Settings</NavLink>
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
