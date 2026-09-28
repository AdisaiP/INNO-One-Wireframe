import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../auth/keycloak';
import { PRODUCT_BRAND } from './branding';
import { usePermission, useProfile } from './ProfileContext';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

type ShellIconName = 'apps' | 'devices' | 'assets' | 'helpdesk' | 'admin' | 'profile' | 'search' | 'menu';

function ShellIcon({ name }: { name: ShellIconName }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9 } as const;
  if (name === 'apps') return <svg {...common} aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>;
  if (name === 'devices') return <svg {...common} aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></svg>;
  if (name === 'assets') return <svg {...common} aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5"/></svg>;
  if (name === 'helpdesk') return <svg {...common} aria-hidden="true"><path d="M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-3"/><path d="M4 14h3v5H5a1 1 0 0 1-1-1v-4ZM20 14h-3v5h2a1 1 0 0 0 1-1v-4Z"/></svg>;
  if (name === 'admin') return <svg {...common} aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.37.39.7.7.94.31.24.69.38 1.08.4H21v4h-.1a1.7 1.7 0 0 0-1.5.66Z"/></svg>;
  if (name === 'profile') return <svg {...common} aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>;
  if (name === 'menu') return <svg {...common} aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
  return <svg {...common} aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}

export function AppShell() {
  const profile = useProfile();
  const canViewApps = usePermission('platform.apps.view');
  const canAdmin = usePermission('admin.access');
  const canAdminOrganization = usePermission('admin.organization.view');
  const canAdminLocations = usePermission('admin.locations.view');
  const canAdminPositions = usePermission('admin.positions.view');
  const canAdminUsers = usePermission('admin.users.view');
  const canAdminRoles = usePermission('admin.roles.view');
  const canAdminScopes = usePermission('admin.access_scopes.view');
  const canAdminIntegrations = usePermission('admin.integrations.view');
  const canAdminSecurity = usePermission('admin.security.view');
  const canAdminAudit = usePermission('admin.audit.view');
  const canAdminBranding = usePermission('admin.branding.manage');
  const canAdminApps = usePermission('admin.apps.view');
  const canViewDevices = usePermission('devices.view');
  const canDeployDevices = usePermission('devices.deploy');
  const canViewAssets = usePermission('assets.view');
  const canPrintAssetQr = usePermission('assets.qr.print');
  const canManageAssetLicenses = usePermission('assets.license.manage');
  const canViewHelpdesk = usePermission('helpdesk.ticket.view');
  const canViewAutomation = usePermission('helpdesk.automation.view');
  const canManageSla = usePermission('helpdesk.sla.manage');
  const location = useLocation();
  const navigate = useNavigate();
  const [sideOpen, setSideOpen] = useState(false);
  const [shellSearch, setShellSearch] = useState('');
  const inApps = location.pathname === '/apps';
  const inAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const inAdminApps = location.pathname.startsWith('/admin/apps');
  const inDevices = location.pathname.startsWith('/devices');
  const inDeviceDetail = /^\/devices\/[^/]+$/.test(location.pathname)
    && !['/devices/discovery', '/devices/groups', '/devices/add'].includes(location.pathname);
  const inAssets = location.pathname.startsWith('/assets');
  const inAssetDetail = /^\/assets\/[^/]+$/.test(location.pathname)
    && !['/assets/inventory', '/assets/ownership', '/assets/owners', '/assets/custom-fields', '/assets/qr-labels', '/assets/software-baselines', '/assets/software-licenses', '/assets/contracts'].includes(location.pathname);
  const inHelpdesk = location.pathname.startsWith('/helpdesk');
  const inTicketWorkspace = /^\/helpdesk\/tickets(?:\/new|\/[^/]+)?$/.test(location.pathname);
  const inProfile = location.pathname.startsWith('/profile');
  const homePath = canViewDevices ? '/devices' : canViewHelpdesk ? '/helpdesk' : canViewAssets ? '/assets' : '/profile';
  const searchTargets = useMemo(() => {
    const items = [{ label: 'Profile & Settings', path: '/profile' }];
    if (canViewApps) items.unshift({ label: 'Apps', path: '/apps' });
    if (canAdmin) items.push({ label: 'Admin Center', path: '/admin' });
    if (canAdminOrganization) items.push({ label: 'Organization Structure', path: '/admin/organization' });
    if (canAdminLocations) items.push({ label: 'Locations', path: '/admin/locations' });
    if (canAdminPositions) items.push({ label: 'Positions', path: '/admin/positions' });
    if (canAdminUsers) items.push({ label: 'Users', path: '/admin/users' });
    if (canAdminRoles) items.push({ label: 'Roles & Permissions', path: '/admin/roles' });
    if (canAdminScopes) items.push({ label: 'Access Scopes', path: '/admin/access-scopes' });
    if (canAdminIntegrations) items.push({ label: 'Integrations', path: '/admin/integrations' });
    if (canAdminSecurity) items.push({ label: 'Security', path: '/admin/security' });
    if (canAdminAudit) items.push({ label: 'Audit Log', path: '/admin/audit' });
    if (canAdminBranding) items.push({ label: 'Branding', path: '/admin/branding' });
    if (canAdminApps) items.push({ label: 'Apps & Modules', path: '/admin/apps' });
    if (canViewDevices) items.unshift(
      { label: 'Devices', path: '/devices' },
      { label: 'Discovery', path: '/devices/discovery' },
      { label: 'Device Groups', path: '/devices/groups' },
    );
    if (canDeployDevices) items.push({ label: 'Agent Deployment', path: '/devices/add' });
    if (canViewAssets) items.push(
      { label: 'Assets Overview', path: '/assets' },
      { label: 'Asset Inventory', path: '/assets/inventory' },
      { label: 'Software Baselines', path: '/assets/software-baselines' },
      { label: 'Contracts & Warranty', path: '/assets/contracts' },
    );
    if (canManageAssetLicenses) items.push({ label: 'Software Licenses', path: '/assets/software-licenses' });
    if (canViewHelpdesk) items.push(
      { label: 'Helpdesk Overview', path: '/helpdesk' },
      { label: 'Tickets', path: '/helpdesk/tickets' },
      { label: 'Assigned to Me', path: '/helpdesk/assigned' },
      { label: 'Team Queue', path: '/helpdesk/team' },
      { label: 'SLA & Escalation', path: '/helpdesk/sla' },
    );
    if (canViewAutomation) items.push({ label: 'Automation', path: '/helpdesk/automation' });
    return items;
  }, [canAdmin, canAdminApps, canAdminAudit, canAdminBranding, canAdminIntegrations, canAdminLocations, canAdminOrganization, canAdminPositions, canAdminRoles, canAdminScopes, canAdminSecurity, canAdminUsers, canDeployDevices, canManageAssetLicenses, canViewApps, canViewAssets, canViewAutomation, canViewDevices, canViewHelpdesk]);

  useEffect(() => setSideOpen(false), [location.pathname]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = shellSearch.trim().toLowerCase();
    if (!query) return;
    const match = searchTargets.find((item) => item.label.toLowerCase().includes(query));
    if (match) {
      navigate(match.path);
      setShellSearch('');
    }
  }

  return (
    <div className="inno-production-shell">
      <header className="prod-header">
        <NavLink className="prod-brand" to={homePath}>
          <span className="prod-logo-mark">{PRODUCT_BRAND.compactMark}</span>
          <span className="prod-brand-name">{PRODUCT_BRAND.productNamePrefix}<b>{PRODUCT_BRAND.productNameEmphasis}</b></span>
        </NavLink>
        <div className="prod-header-center">
          <button className="prod-context-toggle" type="button" onClick={() => setSideOpen((value) => !value)} aria-expanded={sideOpen} aria-label="Toggle contextual navigation">
            <ShellIcon name="menu" />
          </button>
          <form className="prod-global-search" role="search" onSubmit={submitSearch}>
            <ShellIcon name="search" />
            <input
              value={shellSearch}
              onChange={(event) => setShellSearch(event.target.value)}
              placeholder={'Search ' + PRODUCT_BRAND.productName + '…'}
              aria-label={'Search available ' + PRODUCT_BRAND.productName + ' pages'}
            />
            <span className="prod-search-hint" aria-hidden="true">Enter</span>
          </form>
        </div>
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
          {canViewApps ? (
            <NavLink className={inApps ? 'active' : ''} to="/apps" aria-label="Apps" title="Apps"><ShellIcon name="apps" /></NavLink>
          ) : null}
          {canViewDevices ? (
            <NavLink className={inDevices ? 'active' : ''} to="/devices" aria-label="Devices" title="Devices"><ShellIcon name="devices" /></NavLink>
          ) : null}
          {canViewAssets ? (
            <NavLink className={inAssets ? 'active' : ''} to="/assets" aria-label="Assets" title="Assets"><ShellIcon name="assets" /></NavLink>
          ) : null}
          {canViewHelpdesk ? (
            <NavLink className={inHelpdesk ? 'active' : ''} to="/helpdesk" aria-label="Helpdesk" title="Helpdesk"><ShellIcon name="helpdesk" /></NavLink>
          ) : null}
          <span className="grow" />
          {canAdmin ? (
            <NavLink className={inAdmin ? 'active' : ''} to="/admin" aria-label="Admin Center" title="Admin Center"><ShellIcon name="admin" /></NavLink>
          ) : null}
          <NavLink className={inProfile ? 'active' : ''} to="/profile" aria-label="Profile & Settings" title="Profile & Settings"><ShellIcon name="profile" /></NavLink>
        </aside>

        {sideOpen ? <button className="prod-side-backdrop" type="button" aria-label="Close contextual navigation" onClick={() => setSideOpen(false)} /> : null}

        <aside
          className={`prod-side${sideOpen ? ' open' : ''}`}
          aria-label={inProfile ? 'Account navigation' : inAdmin ? 'Admin navigation' : inApps ? 'Apps navigation' : inAssets ? 'Assets navigation' : inHelpdesk ? 'Helpdesk navigation' : inDevices ? 'Devices navigation' : 'Workspace context'}
        >
          {inProfile ? (
            <>
              <div className="prod-side-title">Account</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink to="/profile">Profile & Settings</NavLink>
            </>
          ) : inAdmin ? (
            <>
              <div className="prod-side-title">Admin Center</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/admin">Overview</NavLink>
              {(canAdminOrganization || canAdminLocations || canAdminPositions || canAdminUsers) ? <div className="prod-side-section">Organization</div> : null}
              {canAdminOrganization ? <NavLink to="/admin/organization">Structure</NavLink> : null}
              {canAdminLocations ? <NavLink to="/admin/locations">Locations</NavLink> : null}
              {canAdminPositions ? <NavLink to="/admin/positions">Positions</NavLink> : null}
              {canAdminUsers ? <NavLink to="/admin/users">Users</NavLink> : null}
              {(canAdminRoles || canAdminScopes) ? <div className="prod-side-section">Access</div> : null}
              {canAdminRoles ? <NavLink to="/admin/roles">Roles & Permissions</NavLink> : null}
              {canAdminScopes ? <NavLink to="/admin/access-scopes">Access Scopes</NavLink> : null}
              {(canAdminIntegrations || canAdminSecurity || canAdminAudit || canAdminBranding || canAdminApps) ? <div className="prod-side-section">Platform</div> : null}
              {canAdminIntegrations ? <NavLink to="/admin/integrations">Integrations</NavLink> : null}
              {canAdminSecurity ? <NavLink to="/admin/security">Security</NavLink> : null}
              {canAdminAudit ? <NavLink to="/admin/audit">Audit Log</NavLink> : null}
              {canAdminBranding ? <NavLink to="/admin/branding">Branding</NavLink> : null}
              {canAdminApps ? <NavLink to="/admin/apps">Apps & Modules</NavLink> : null}
            </>
          ) : inApps ? (
            <>
              <div className="prod-side-title">Apps</div>
              <div className="prod-side-section">Launcher</div>
              <NavLink end to="/apps">All Apps</NavLink>
              {canAdminApps ? <NavLink to="/admin/apps">Apps & Modules</NavLink> : null}
            </>
          ) : inAssets ? (
            <>
              <div className="prod-side-title">Assets</div>
              <div className="prod-side-section">Inventory</div>
              <NavLink end to="/assets">Overview</NavLink>
              <NavLink to="/assets/inventory" className={({ isActive }) => isActive || inAssetDetail ? 'active' : ''}>Asset Inventory</NavLink>
              <div className="prod-side-section">Management</div>
              <NavLink to="/assets/software-baselines">Software Baselines</NavLink>
              {canManageAssetLicenses ? <NavLink to="/assets/software-licenses">Software Licenses</NavLink> : null}
              <NavLink to="/assets/contracts">Contracts & Warranty</NavLink>
              <NavLink to="/assets/custom-fields">Custom Fields</NavLink>
              {canPrintAssetQr ? <NavLink to="/assets/qr-labels">QR Labels</NavLink> : null}
              <div className="prod-side-section">Ownership</div>
              <NavLink end to="/assets/ownership">Ownership & Users</NavLink>
              <NavLink to="/assets/owners">User Profiles</NavLink>
              <NavLink to="/assets/ownership/submissions">Agent Submissions</NavLink>
            </>
          ) : inHelpdesk ? (
            <>
              <div className="prod-side-title">Helpdesk</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/helpdesk">Overview</NavLink>
              <NavLink end to="/helpdesk/tickets" className={({ isActive }) => isActive || inTicketWorkspace ? 'active' : ''}>Tickets</NavLink>
              <NavLink to="/helpdesk/assigned">Assigned to Me</NavLink>
              <NavLink to="/helpdesk/team">Team Queue</NavLink>
              <div className="prod-side-section">Manage</div>
              <NavLink to="/helpdesk/sla">SLA & Escalation</NavLink>
              {canManageSla ? <NavLink to="/helpdesk/calendar">Business Calendar</NavLink> : null}
              {canViewAutomation ? <NavLink to="/helpdesk/automation">Automation</NavLink> : null}
            </>
          ) : inDevices ? (
            <>
              <div className="prod-side-title">Devices</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/devices" className={({ isActive }) => isActive || inDeviceDetail ? 'active' : ''}>Devices</NavLink>
              <NavLink to="/devices/discovery">Discovery</NavLink>
              <NavLink to="/devices/groups">Device Groups</NavLink>
              {canDeployDevices ? <NavLink to="/devices/add">Agent Deployment</NavLink> : null}
            </>
          ) : (
            <>
              <div className="prod-side-title">INNO.One</div>
              <div className="prod-side-section">Workspace</div>
              <div className="prod-side-note">This route is outside the currently enabled production modules.</div>
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
