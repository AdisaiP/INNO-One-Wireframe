import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { INNOIcon, type INNOIconToken } from '@inno/ui';
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

function NavIcon({ token }: { token: INNOIconToken }) {
  return <INNOIcon token={token} size={18} />;
}

function SideNavLabel({ token, children }: { token: INNOIconToken; children: ReactNode }) {
  return (
    <span className="prod-side-link-content">
      <INNOIcon token={token} size={15} />
      <span>{children}</span>
    </span>
  );
}

export function AppShell() {
  const profile = useProfile();
  const canWorkspace = usePermission('platform.workspace.access');
  const canViewApps = usePermission('platform.apps.view');
  const canViewNotifications = usePermission('platform.notifications.view');
  const canUseSearch = usePermission('platform.search.use');
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
  const canAdminSettings = usePermission('admin.settings.manage');
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
  const [sideCollapsed, setSideCollapsed] = useState(() => window.localStorage.getItem('inno.ui.sidebar.collapsed') === '1');
  const [shellSearch, setShellSearch] = useState('');
  const inApps = location.pathname === '/apps';
  const inDesignSystem = location.pathname.startsWith('/internal/design-system');
  const inAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/') || inDesignSystem;
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
  const inNotifications = location.pathname.startsWith('/notifications');
  const inSearch = location.pathname.startsWith('/search');
  const inWorkspace = location.pathname === '/' || location.pathname.startsWith('/workspace/');
  const inAccount = inProfile || inNotifications;
  const homePath = canWorkspace ? '/' : canViewDevices ? '/devices' : canViewHelpdesk ? '/helpdesk' : canViewAssets ? '/assets' : '/profile';
  const designSystemHash = location.hash || '#foundations';
  const contextLabel = inWorkspace || inSearch ? 'Workspace'
    : inAccount ? 'Account'
      : inDesignSystem ? 'Design System'
        : inAdmin ? 'Admin Center'
          : inApps ? 'Apps'
          : inAssets ? 'Assets'
            : inHelpdesk ? 'Helpdesk'
              : inDevices ? 'Devices'
                : 'INNO.One';

  useEffect(() => setSideOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    window.localStorage.setItem('inno.ui.sidebar.collapsed', sideCollapsed ? '1' : '0');
  }, [sideCollapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSideOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (inSearch) {
      setShellSearch(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [inSearch, location.search]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = shellSearch.trim();
    if (!query) return;
    navigate('/search?q=' + encodeURIComponent(query));
  }

  function openContextNavigation() {
    if (window.matchMedia('(max-width: 1180px)').matches) {
      setSideOpen(true);
      return;
    }
    setSideCollapsed(false);
  }

  function closeContextNavigation() {
    if (window.matchMedia('(max-width: 1180px)').matches) {
      setSideOpen(false);
      return;
    }
    setSideCollapsed(true);
  }

  return (
    <div className={'inno-production-shell' + (sideCollapsed ? ' side-collapsed' : '') + (sideOpen ? ' side-open' : '')}>
      <header className="prod-header">
        <NavLink className="prod-brand" to={homePath}>
          <span className="prod-logo-mark">{PRODUCT_BRAND.compactMark}</span>
          <span className="prod-brand-name">{PRODUCT_BRAND.productNamePrefix}<b>{PRODUCT_BRAND.productNameEmphasis}</b></span>
        </NavLink>
        <div className="prod-header-center">
          {canUseSearch ? (
            <form className="prod-global-search" role="search" onSubmit={submitSearch}>
              <NavIcon token="action.search" />
              <input
                value={shellSearch}
                onChange={(event) => setShellSearch(event.target.value)}
                placeholder="Search devices, assets and tickets…"
                aria-label="Search INNO.One resources"
              />
              <span className="prod-search-hint" aria-hidden="true">Enter</span>
            </form>
          ) : null}
        </div>
        <div className="prod-header-actions">
          {canViewNotifications ? (
            <NavLink
              className={({ isActive }) => 'prod-icon-button prod-notification-link' + (isActive ? ' active' : '')}
              to="/notifications"
              aria-label="Open Notifications"
              title="Notifications"
            >
              <NavIcon token="section.notifications" />
            </NavLink>
          ) : null}
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
          {canWorkspace ? (
            <NavLink className={inWorkspace ? 'active' : ''} to="/" aria-label="Workspace Home" title="Workspace Home"><NavIcon token="nav.workspace" /></NavLink>
          ) : null}
          {canViewApps ? (
            <NavLink className={inApps ? 'active' : ''} to="/apps" aria-label="Apps" title="Apps"><NavIcon token="nav.apps" /></NavLink>
          ) : null}
          {canViewDevices ? (
            <NavLink className={inDevices ? 'active' : ''} to="/devices" aria-label="Devices" title="Devices"><NavIcon token="nav.devices" /></NavLink>
          ) : null}
          {canViewAssets ? (
            <NavLink className={inAssets ? 'active' : ''} to="/assets" aria-label="Assets" title="Assets"><NavIcon token="nav.assets" /></NavLink>
          ) : null}
          {canViewHelpdesk ? (
            <NavLink className={inHelpdesk ? 'active' : ''} to="/helpdesk" aria-label="Helpdesk" title="Helpdesk"><NavIcon token="nav.helpdesk" /></NavLink>
          ) : null}
          <span className="grow" />
          {canAdmin ? (
            <NavLink className={inAdmin ? 'active' : ''} to="/admin" aria-label="Admin Center" title="Admin Center"><NavIcon token="nav.admin" /></NavLink>
          ) : null}
          <NavLink className={inAccount ? 'active' : ''} to="/profile" aria-label="Profile & Settings" title="Profile & Settings"><NavIcon token="section.profile" /></NavLink>
        </aside>

        {sideOpen ? <button className="prod-side-backdrop" type="button" aria-label="Close contextual navigation" onClick={() => setSideOpen(false)} /> : null}

        <aside
          className={`prod-side${sideOpen ? ' open' : ''}`}
          aria-label={inWorkspace ? 'Workspace navigation' : inSearch ? 'Search navigation' : inAccount ? 'Account navigation' : inDesignSystem ? 'Design System navigation' : inAdmin ? 'Admin navigation' : inApps ? 'Apps navigation' : inAssets ? 'Assets navigation' : inHelpdesk ? 'Helpdesk navigation' : inDevices ? 'Devices navigation' : 'Workspace context'}
        >
          <button
            className="prod-side-collapse"
            type="button"
            onClick={closeContextNavigation}
            aria-label={sideOpen ? 'Close contextual navigation' : 'Collapse contextual navigation'}
            title={sideOpen ? 'Close navigation' : 'Collapse sidebar'}
          >
            <NavIcon token={sideOpen ? 'action.close' : 'action.collapse'} />
          </button>
          {inWorkspace ? (
            <>
              <div className="prod-side-title">Workspace</div>
              <div className="prod-side-section">Start</div>
              <NavLink end to="/"><SideNavLabel token="nav.workspace">Home</SideNavLabel></NavLink>
              {canViewApps ? <NavLink to="/apps"><SideNavLabel token="nav.apps">Apps</SideNavLabel></NavLink> : null}
              {canUseSearch ? <NavLink to="/search"><SideNavLabel token="action.search">Search</SideNavLabel></NavLink> : null}
              <div className="prod-side-section">My Workspace</div>
              <NavLink to="/workspace/continue"><SideNavLabel token="section.continue">Continue Working</SideNavLabel></NavLink>
              <NavLink to="/workspace/attention"><SideNavLabel token="section.attention">Needs Attention</SideNavLabel></NavLink>
              <NavLink to="/workspace/recent"><SideNavLabel token="section.recent">Recent</SideNavLabel></NavLink>
              <div className="prod-side-section">Account</div>
              {canViewNotifications ? <NavLink to="/notifications"><SideNavLabel token="section.notifications">Notifications</SideNavLabel></NavLink> : null}
              <NavLink to="/profile"><SideNavLabel token="section.profile">Profile & Settings</SideNavLabel></NavLink>
            </>
          ) : inSearch ? (
            <>
              <div className="prod-side-title">Workspace</div>
              <div className="prod-side-section">Discover</div>
              <NavLink end to="/search"><SideNavLabel token="action.search">Search</SideNavLabel></NavLink>
              {canViewApps ? <NavLink to="/apps"><SideNavLabel token="nav.apps">Apps</SideNavLabel></NavLink> : null}
            </>
          ) : inAccount ? (
            <>
              <div className="prod-side-title">Account</div>
              <div className="prod-side-section">Workspace</div>
              {canViewNotifications ? <NavLink to="/notifications"><SideNavLabel token="section.notifications">Notifications</SideNavLabel></NavLink> : null}
              <NavLink to="/profile"><SideNavLabel token="section.profile">Profile & Settings</SideNavLabel></NavLink>
            </>
          ) : inDesignSystem ? (
            <>
              <div className="prod-side-title">Design System</div>
              <div className="prod-side-section">Release</div>
              <a className={designSystemHash === '#freeze' ? 'active' : ''} href="#freeze"><SideNavLabel token="section.security">Frozen Contract</SideNavLabel></a>
              <div className="prod-side-section">Foundations</div>
              <a className={designSystemHash === '#foundations' ? 'active' : ''} href="#foundations"><SideNavLabel token="section.branding">Foundations</SideNavLabel></a>
              <a className={designSystemHash === '#buttons' ? 'active' : ''} href="#buttons"><SideNavLabel token="section.automation">Actions</SideNavLabel></a>
              <a className={designSystemHash === '#forms' ? 'active' : ''} href="#forms"><SideNavLabel token="section.customFields">Forms</SideNavLabel></a>
              <a className={designSystemHash === '#data' ? 'active' : ''} href="#data"><SideNavLabel token="section.inventory">Data Table</SideNavLabel></a>
              <a className={designSystemHash === '#hierarchy' ? 'active' : ''} href="#hierarchy"><SideNavLabel token="section.organization">Hierarchy</SideNavLabel></a>
              <div className="prod-side-section">Feedback</div>
              <a className={designSystemHash === '#states' ? 'active' : ''} href="#states"><SideNavLabel token="status.info">States</SideNavLabel></a>
              <a className={designSystemHash === '#interactions' ? 'active' : ''} href="#interactions"><SideNavLabel token="section.automation">Interactions</SideNavLabel></a>
              <a className={designSystemHash === '#overlays' ? 'active' : ''} href="#overlays"><SideNavLabel token="nav.apps">Dialog & Sheet</SideNavLabel></a>
              <a className={designSystemHash === '#responsive' ? 'active' : ''} href="#responsive"><SideNavLabel token="nav.devices">Responsive</SideNavLabel></a>
              <a className={designSystemHash === '#navigation' ? 'active' : ''} href="#navigation"><SideNavLabel token="section.groups">Navigation</SideNavLabel></a>
              <a className={designSystemHash === '#icons' ? 'active' : ''} href="#icons"><SideNavLabel token="section.modules">Icons</SideNavLabel></a>
              <a className={designSystemHash === '#guidelines' ? 'active' : ''} href="#guidelines"><SideNavLabel token="section.settings">Implementation Map</SideNavLabel></a>
            </>
          ) : inAdmin ? (
            <>
              <div className="prod-side-title">Admin Center</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/admin"><SideNavLabel token="section.overview">Overview</SideNavLabel></NavLink>
              {(canAdminOrganization || canAdminLocations || canAdminPositions || canAdminUsers) ? <div className="prod-side-section">Organization</div> : null}
              {canAdminOrganization ? <NavLink to="/admin/organization"><SideNavLabel token="section.organization">Structure</SideNavLabel></NavLink> : null}
              {canAdminLocations ? <NavLink to="/admin/locations"><SideNavLabel token="section.locations">Locations</SideNavLabel></NavLink> : null}
              {canAdminPositions ? <NavLink to="/admin/positions"><SideNavLabel token="section.positions">Positions</SideNavLabel></NavLink> : null}
              {canAdminUsers ? <NavLink to="/admin/users"><SideNavLabel token="section.users">Users</SideNavLabel></NavLink> : null}
              {(canAdminRoles || canAdminScopes) ? <div className="prod-side-section">Access</div> : null}
              {canAdminRoles ? <NavLink to="/admin/roles"><SideNavLabel token="section.roles">Roles & Permissions</SideNavLabel></NavLink> : null}
              {canAdminScopes ? <NavLink to="/admin/access-scopes"><SideNavLabel token="section.accessScopes">Access Scopes</SideNavLabel></NavLink> : null}
              {(canAdminIntegrations || canAdminSecurity || canAdminAudit || canAdminBranding || canAdminSettings || canAdminApps) ? <div className="prod-side-section">Platform</div> : null}
              {canAdminIntegrations ? <NavLink to="/admin/integrations"><SideNavLabel token="section.integrations">Integrations</SideNavLabel></NavLink> : null}
              {canAdminSecurity ? <NavLink to="/admin/security"><SideNavLabel token="section.security">Security</SideNavLabel></NavLink> : null}
              {canAdminAudit ? <NavLink to="/admin/audit"><SideNavLabel token="section.audit">Audit Log</SideNavLabel></NavLink> : null}
              {canAdminBranding ? <NavLink to="/admin/branding"><SideNavLabel token="section.branding">Branding</SideNavLabel></NavLink> : null}
              {canAdminSettings ? <NavLink to="/admin/settings"><SideNavLabel token="section.settings">Platform Settings</SideNavLabel></NavLink> : null}
              {canAdminApps ? <NavLink to="/admin/apps"><SideNavLabel token="section.modules">Apps & Modules</SideNavLabel></NavLink> : null}
            </>
          ) : inApps ? (
            <>
              <div className="prod-side-title">Apps</div>
              <div className="prod-side-section">Launcher</div>
              <NavLink end to="/apps"><SideNavLabel token="nav.apps">All Apps</SideNavLabel></NavLink>
              {canAdminApps ? <NavLink to="/admin/apps"><SideNavLabel token="section.modules">Apps & Modules</SideNavLabel></NavLink> : null}
            </>
          ) : inAssets ? (
            <>
              <div className="prod-side-title">Assets</div>
              <div className="prod-side-section">Inventory</div>
              <NavLink end to="/assets"><SideNavLabel token="section.overview">Overview</SideNavLabel></NavLink>
              <NavLink to="/assets/inventory" className={({ isActive }) => isActive || inAssetDetail ? 'active' : ''}><SideNavLabel token="section.inventory">Asset Inventory</SideNavLabel></NavLink>
              <div className="prod-side-section">Management</div>
              <NavLink to="/assets/software-baselines"><SideNavLabel token="section.policies">Software Baselines</SideNavLabel></NavLink>
              {canManageAssetLicenses ? <NavLink to="/assets/software-licenses"><SideNavLabel token="section.licenses">Software Licenses</SideNavLabel></NavLink> : null}
              <NavLink to="/assets/contracts"><SideNavLabel token="section.contracts">Contracts & Warranty</SideNavLabel></NavLink>
              <NavLink to="/assets/custom-fields"><SideNavLabel token="section.customFields">Custom Fields</SideNavLabel></NavLink>
              {canPrintAssetQr ? <NavLink to="/assets/qr-labels"><SideNavLabel token="section.qr">QR Labels</SideNavLabel></NavLink> : null}
              <div className="prod-side-section">Ownership</div>
              <NavLink end to="/assets/ownership"><SideNavLabel token="section.ownership">Ownership & Users</SideNavLabel></NavLink>
              <NavLink to="/assets/owners"><SideNavLabel token="section.userProfiles">User Profiles</SideNavLabel></NavLink>
              <NavLink to="/assets/ownership/submissions"><SideNavLabel token="section.submissions">Agent Submissions</SideNavLabel></NavLink>
            </>
          ) : inHelpdesk ? (
            <>
              <div className="prod-side-title">Helpdesk</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/helpdesk"><SideNavLabel token="section.overview">Overview</SideNavLabel></NavLink>
              <NavLink end to="/helpdesk/tickets" className={({ isActive }) => isActive || inTicketWorkspace ? 'active' : ''}><SideNavLabel token="section.tickets">Tickets</SideNavLabel></NavLink>
              <NavLink to="/helpdesk/assigned"><SideNavLabel token="section.assigned">Assigned to Me</SideNavLabel></NavLink>
              <NavLink to="/helpdesk/team"><SideNavLabel token="section.team">Team Queue</SideNavLabel></NavLink>
              <div className="prod-side-section">Manage</div>
              <NavLink to="/helpdesk/sla"><SideNavLabel token="section.sla">SLA & Escalation</SideNavLabel></NavLink>
              {canManageSla ? <NavLink to="/helpdesk/calendar"><SideNavLabel token="section.calendar">Business Calendar</SideNavLabel></NavLink> : null}
              {canViewAutomation ? <NavLink to="/helpdesk/automation"><SideNavLabel token="section.automation">Automation</SideNavLabel></NavLink> : null}
            </>
          ) : inDevices ? (
            <>
              <div className="prod-side-title">Devices</div>
              <div className="prod-side-section">Workspace</div>
              <NavLink end to="/devices" className={({ isActive }) => isActive || inDeviceDetail ? 'active' : ''}><SideNavLabel token="nav.devices">Devices</SideNavLabel></NavLink>
              <NavLink to="/devices/discovery"><SideNavLabel token="section.discovery">Discovery</SideNavLabel></NavLink>
              <NavLink to="/devices/groups"><SideNavLabel token="section.groups">Device Groups</SideNavLabel></NavLink>
              {canDeployDevices ? <NavLink to="/devices/add"><SideNavLabel token="section.deployment">Agent Deployment</SideNavLabel></NavLink> : null}
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
          <button
            className="prod-context-reveal"
            type="button"
            onClick={openContextNavigation}
            aria-expanded={sideOpen || !sideCollapsed}
            aria-label={'Open ' + contextLabel + ' navigation'}
          >
            <NavIcon token={sideCollapsed ? 'action.expand' : 'action.menu'} />
            <span>{contextLabel}</span>
          </button>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
