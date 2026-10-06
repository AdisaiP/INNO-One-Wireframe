import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { type Locale, useI18n } from '@inno/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { INNOIcon, type INNOIconToken } from '@inno/ui';
import { updateCurrentProfile } from '../api/client';
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
  const { t } = useI18n();
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
  const canRemoteDevices = usePermission('devices.remote');
  const canDeployDevices = usePermission('devices.deploy');
  const canViewAssets = usePermission('assets.view');
  const canPrintAssetQr = usePermission('assets.qr.print');
  const canManageAssetLicenses = usePermission('assets.license.manage');
  const canViewAssetsAutomation = usePermission('assets.automation.view');
  const canViewHelpdesk = usePermission('helpdesk.ticket.view');
  const canViewReports = usePermission('reports.view');
  const canViewAutomation = usePermission('helpdesk.automation.view');
  const canManageSla = usePermission('helpdesk.sla.manage');
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(() => window.localStorage.getItem('inno.ui.sidebar.collapsed') === '1');
  const [shellSearch, setShellSearch] = useState('');
  const inApps = location.pathname === '/apps';
  const inDesignSystem = location.pathname.startsWith('/internal/design-system');
  const inAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/') || inDesignSystem;
  const inAdminApps = location.pathname.startsWith('/admin/apps');
  const inDevices = location.pathname.startsWith('/devices');
  const inDeviceDetail = /^\/devices\/[^/]+$/.test(location.pathname)
    && !['/devices/discovery', '/devices/query', '/devices/groups', '/devices/remote-operations', '/devices/remote-consent', '/devices/deployments', '/devices/maintenance', '/devices/add'].includes(location.pathname);
  const inAssets = location.pathname.startsWith('/assets');
  const inAssetDetail = /^\/assets\/[^/]+$/.test(location.pathname)
    && !['/assets/inventory', '/assets/ownership', '/assets/owners', '/assets/custom-fields', '/assets/qr-labels', '/assets/software-baselines', '/assets/software-licenses', '/assets/contracts', '/assets/automation'].includes(location.pathname);
  const inHelpdesk = location.pathname.startsWith('/helpdesk');
  const inReports = location.pathname.startsWith('/reports');
  const inTicketWorkspace = /^\/helpdesk\/tickets(?:\/new|\/[^/]+)?$/.test(location.pathname);
  const inProfile = location.pathname.startsWith('/profile');
  const inNotifications = location.pathname.startsWith('/notifications');
  const inSearch = location.pathname.startsWith('/search');
  const inWorkspace = location.pathname === '/' || location.pathname.startsWith('/workspace/');
  const inAccount = inProfile || inNotifications;
  const homePath = canWorkspace ? '/' : canViewDevices ? '/devices' : canViewHelpdesk ? '/helpdesk' : canViewAssets ? '/assets' : canViewReports ? '/reports' : '/profile';
  const designSystemHash = location.hash || '#foundations';
  const contextLabel = inWorkspace || inSearch ? t('navigation.workspace')
    : inAccount ? t('navigation.account')
      : inDesignSystem ? t('navigation.designSystem')
        : inAdmin ? t('navigation.admin')
          : inApps ? t('navigation.apps')
          : inAssets ? t('navigation.assets')
            : inHelpdesk ? t('navigation.helpdesk')
              : inReports ? t('reports.title')
                : inDevices ? t('navigation.devices')
                  : 'INNO.One';

  const localeMutation = useMutation({
    mutationFn: (locale: Locale) => updateCurrentProfile({ preferredLocale: locale }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['platform', 'me'], updatedProfile);
    },
  });

  useEffect(() => {
    setSideOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('inno.ui.sidebar.collapsed', sideCollapsed ? '1' : '0');
  }, [sideCollapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSideOpen(false);
        setUserMenuOpen(false);
      }
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
                placeholder={t('navigation.searchPlaceholder')}
                aria-label={t('navigation.searchAria')}
              />
              <span className="prod-search-hint" aria-hidden="true">Enter</span>
            </form>
          ) : null}
        </div>
        <div className="prod-header-actions">
          <div className="prod-language-switch" role="group" aria-label={t('profile.language')}>
            <button
              type="button"
              className={profile.locale === 'en-US' ? 'active' : ''}
              aria-pressed={profile.locale === 'en-US'}
              disabled={localeMutation.isPending}
              onClick={() => profile.locale !== 'en-US' && localeMutation.mutate('en-US')}
            >
              EN
            </button>
            <button
              type="button"
              className={profile.locale === 'th-TH' ? 'active' : ''}
              aria-pressed={profile.locale === 'th-TH'}
              disabled={localeMutation.isPending}
              onClick={() => profile.locale !== 'th-TH' && localeMutation.mutate('th-TH')}
            >
              ไทย
            </button>
          </div>
          {canViewNotifications ? (
            <NavLink
              className={({ isActive }) => 'prod-icon-button prod-notification-link' + (isActive ? ' active' : '')}
              to="/notifications"
              aria-label={t('navigation.openNotifications')}
              title={t('navigation.notifications')}
            >
              <NavIcon token="section.notifications" />
            </NavLink>
          ) : null}
          <div className="prod-user-menu" ref={userMenuRef}>
            <button
              className="prod-user prod-user-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label={t('navigation.openProfile')}
              onClick={() => setUserMenuOpen((open) => !open)}
            >
              <span className="prod-avatar">{initials(profile.fullName)}</span>
              <span className="prod-user-copy">
                <b>{profile.fullName}</b>
                <small>{profile.roles[0] ?? t('common.user')}</small>
              </span>
              <span className="prod-user-caret" aria-hidden="true">⌄</span>
            </button>
            {userMenuOpen ? (
              <div className="prod-user-popover" role="menu">
                <div className="prod-user-popover-head">
                  <b>{profile.fullName}</b>
                  <span>{profile.email}</span>
                </div>
                <NavLink role="menuitem" to="/profile">{t('navigation.profileSettings')}</NavLink>
                <button role="menuitem" type="button" onClick={() => void logout()}>
                  {t('common.actions.signOut')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="prod-shell-body">
        <aside className="prod-rail" aria-label={t('navigation.appNavigation')}>
          {canWorkspace ? (
            <NavLink className={inWorkspace ? 'active' : ''} to="/" aria-label={t('navigation.workspace')} title={t('navigation.workspace')}><NavIcon token="nav.workspace" /></NavLink>
          ) : null}
          {canViewApps ? (
            <NavLink className={inApps ? 'active' : ''} to="/apps" aria-label={t('navigation.apps')} title={t('navigation.apps')}><NavIcon token="nav.apps" /></NavLink>
          ) : null}
          {canViewDevices ? (
            <NavLink className={inDevices ? 'active' : ''} to="/devices" aria-label={t('navigation.devices')} title={t('navigation.devices')}><NavIcon token="nav.devices" /></NavLink>
          ) : null}
          {canViewAssets ? (
            <NavLink className={inAssets ? 'active' : ''} to="/assets" aria-label={t('navigation.assets')} title={t('navigation.assets')}><NavIcon token="nav.assets" /></NavLink>
          ) : null}
          {canViewHelpdesk ? (
            <NavLink className={inHelpdesk ? 'active' : ''} to="/helpdesk" aria-label={t('navigation.helpdesk')} title={t('navigation.helpdesk')}><NavIcon token="nav.helpdesk" /></NavLink>
          ) : null}
          {canViewReports ? (
            <NavLink className={inReports ? 'active' : ''} to="/reports" aria-label={t('reports.title')} title={t('reports.title')}><NavIcon token="section.audit" /></NavLink>
          ) : null}
          <span className="grow" />
          {canAdmin ? (
            <NavLink className={inAdmin ? 'active' : ''} to="/admin" aria-label={t('navigation.admin')} title={t('navigation.admin')}><NavIcon token="nav.admin" /></NavLink>
          ) : null}
          <NavLink className={inAccount ? 'active' : ''} to="/profile" aria-label={t('navigation.profileSettings')} title={t('navigation.profileSettings')}><NavIcon token="section.profile" /></NavLink>
        </aside>

        {sideOpen ? <button className="prod-side-backdrop" type="button" aria-label={t('navigation.closeContext')} onClick={() => setSideOpen(false)} /> : null}

        <aside
          className={`prod-side${sideOpen ? ' open' : ''}`}
          aria-label={t('navigation.openContext', { context: contextLabel })}
        >
          <button
            className="prod-side-collapse"
            type="button"
            onClick={closeContextNavigation}
            aria-label={sideOpen ? t('navigation.closeContext') : t('navigation.collapseContext')}
            title={sideOpen ? t('navigation.closeContext') : t('navigation.collapseContext')}
          >
            <NavIcon token={sideOpen ? 'action.close' : 'action.collapse'} />
          </button>
          {inWorkspace ? (
            <>
              <div className="prod-side-title">{t('navigation.workspace')}</div>
              <div className="prod-side-section">{t('navigation.home')}</div>
              <NavLink end to="/"><SideNavLabel token="nav.workspace">{t('navigation.home')}</SideNavLabel></NavLink>
              {canViewApps ? <NavLink to="/apps"><SideNavLabel token="nav.apps">{t('navigation.apps')}</SideNavLabel></NavLink> : null}
              {canUseSearch ? <NavLink to="/search"><SideNavLabel token="action.search">{t('navigation.search')}</SideNavLabel></NavLink> : null}
              <div className="prod-side-section">{t('navigation.workspace')}</div>
              <NavLink to="/workspace/continue"><SideNavLabel token="section.continue">{t('navigation.continueWorking')}</SideNavLabel></NavLink>
              <NavLink to="/workspace/attention"><SideNavLabel token="section.attention">{t('navigation.needsAttention')}</SideNavLabel></NavLink>
              <NavLink to="/workspace/recent"><SideNavLabel token="section.recent">{t('navigation.recent')}</SideNavLabel></NavLink>
              <div className="prod-side-section">{t('navigation.account')}</div>
              {canViewNotifications ? <NavLink to="/notifications"><SideNavLabel token="section.notifications">{t('navigation.notifications')}</SideNavLabel></NavLink> : null}
              <NavLink to="/profile"><SideNavLabel token="section.profile">{t('navigation.profileSettings')}</SideNavLabel></NavLink>
            </>
          ) : inSearch ? (
            <>
              <div className="prod-side-title">{t('navigation.workspace')}</div>
              <div className="prod-side-section">{t('navigation.search')}</div>
              <NavLink end to="/search"><SideNavLabel token="action.search">{t('navigation.search')}</SideNavLabel></NavLink>
              {canViewApps ? <NavLink to="/apps"><SideNavLabel token="nav.apps">{t('navigation.apps')}</SideNavLabel></NavLink> : null}
            </>
          ) : inAccount ? (
            <>
              <div className="prod-side-title">{t('navigation.account')}</div>
              <div className="prod-side-section">{t('navigation.workspace')}</div>
              {canViewNotifications ? <NavLink to="/notifications"><SideNavLabel token="section.notifications">{t('navigation.notifications')}</SideNavLabel></NavLink> : null}
              <NavLink to="/profile"><SideNavLabel token="section.profile">{t('navigation.profileSettings')}</SideNavLabel></NavLink>
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
              <a className={designSystemHash === '#workflow' ? 'active' : ''} href="#workflow"><SideNavLabel token="section.automation">Workflow Canvas</SideNavLabel></a>
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
              <div className="prod-side-title">{t('navigation.admin')}</div>
              <div className="prod-side-section">{t('navigation.workspace')}</div>
              <NavLink end to="/admin"><SideNavLabel token="section.overview">{t('navigation.overview')}</SideNavLabel></NavLink>
              {(canAdminOrganization || canAdminLocations || canAdminPositions || canAdminUsers) ? <div className="prod-side-section">{t('navigation.organization')}</div> : null}
              {canAdminOrganization ? <NavLink to="/admin/organization"><SideNavLabel token="section.organization">{t('navigation.structure')}</SideNavLabel></NavLink> : null}
              {canAdminLocations ? <NavLink to="/admin/locations"><SideNavLabel token="section.locations">{t('navigation.locations')}</SideNavLabel></NavLink> : null}
              {canAdminPositions ? <NavLink to="/admin/positions"><SideNavLabel token="section.positions">{t('navigation.positions')}</SideNavLabel></NavLink> : null}
              {canAdminUsers ? <NavLink to="/admin/users"><SideNavLabel token="section.users">{t('navigation.users')}</SideNavLabel></NavLink> : null}
              {(canAdminRoles || canAdminScopes) ? <div className="prod-side-section">{t('navigation.access')}</div> : null}
              {canAdminRoles ? <NavLink to="/admin/roles"><SideNavLabel token="section.roles">{t('navigation.rolesPermissions')}</SideNavLabel></NavLink> : null}
              {canAdminScopes ? <NavLink to="/admin/access-scopes"><SideNavLabel token="section.accessScopes">{t('navigation.accessScopes')}</SideNavLabel></NavLink> : null}
              {(canAdminIntegrations || canAdminSecurity || canAdminAudit || canAdminBranding || canAdminSettings || canAdminApps) ? <div className="prod-side-section">{t('navigation.platform')}</div> : null}
              {canAdminIntegrations ? <NavLink to="/admin/integrations"><SideNavLabel token="section.integrations">{t('navigation.integrations')}</SideNavLabel></NavLink> : null}
              {canAdminSecurity ? <NavLink to="/admin/security"><SideNavLabel token="section.security">{t('navigation.security')}</SideNavLabel></NavLink> : null}
              {canAdminAudit ? <NavLink to="/admin/audit"><SideNavLabel token="section.audit">{t('navigation.auditLog')}</SideNavLabel></NavLink> : null}
              {canAdminBranding ? <NavLink to="/admin/branding"><SideNavLabel token="section.branding">{t('navigation.branding')}</SideNavLabel></NavLink> : null}
              {canAdminSettings ? <NavLink to="/admin/settings"><SideNavLabel token="section.settings">{t('navigation.platformSettings')}</SideNavLabel></NavLink> : null}
              {canAdminApps ? <NavLink to="/admin/apps"><SideNavLabel token="section.modules">{t('navigation.appsModules')}</SideNavLabel></NavLink> : null}
            </>
          ) : inApps ? (
            <>
              <div className="prod-side-title">{t('navigation.apps')}</div>
              <div className="prod-side-section">{t('navigation.launcher')}</div>
              <NavLink end to="/apps"><SideNavLabel token="nav.apps">{t('navigation.allApps')}</SideNavLabel></NavLink>
              {canAdminApps ? <NavLink to="/admin/apps"><SideNavLabel token="section.modules">{t('navigation.appsModules')}</SideNavLabel></NavLink> : null}
            </>
          ) : inAssets ? (
            <>
              <div className="prod-side-title">{t('navigation.assets')}</div>
              <div className="prod-side-section">{t('navigation.inventory')}</div>
              <NavLink end to="/assets"><SideNavLabel token="section.overview">{t('navigation.overview')}</SideNavLabel></NavLink>
              <NavLink to="/assets/inventory" className={({ isActive }) => isActive || inAssetDetail ? 'active' : ''}><SideNavLabel token="section.inventory">{t('navigation.assetInventory')}</SideNavLabel></NavLink>
              <div className="prod-side-section">{t('navigation.management')}</div>
              <NavLink to="/assets/software-baselines"><SideNavLabel token="section.policies">{t('navigation.softwareBaselines')}</SideNavLabel></NavLink>
              {canViewAssetsAutomation ? <NavLink to="/assets/automation"><SideNavLabel token="section.automation">{t('navigation.automation')}</SideNavLabel></NavLink> : null}
              {canManageAssetLicenses ? <NavLink to="/assets/software-licenses"><SideNavLabel token="section.licenses">{t('navigation.softwareLicenses')}</SideNavLabel></NavLink> : null}
              <NavLink to="/assets/contracts"><SideNavLabel token="section.contracts">{t('navigation.contractsWarranty')}</SideNavLabel></NavLink>
              <NavLink to="/assets/custom-fields"><SideNavLabel token="section.customFields">{t('navigation.customFields')}</SideNavLabel></NavLink>
              {canPrintAssetQr ? <NavLink to="/assets/qr-labels"><SideNavLabel token="section.qr">{t('navigation.qrLabels')}</SideNavLabel></NavLink> : null}
              <div className="prod-side-section">{t('navigation.ownership')}</div>
              <NavLink end to="/assets/ownership"><SideNavLabel token="section.ownership">{t('navigation.ownershipOverview')}</SideNavLabel></NavLink>
              <NavLink to="/assets/owners"><SideNavLabel token="section.userProfiles">{t('navigation.assetOwners')}</SideNavLabel></NavLink>
              <NavLink to="/assets/ownership/submissions"><SideNavLabel token="section.submissions">{t('navigation.agentSubmissions')}</SideNavLabel></NavLink>
            </>
          ) : inHelpdesk ? (
            <>
              <div className="prod-side-title">{t('navigation.helpdesk')}</div>
              <div className="prod-side-section">{t('navigation.workspace')}</div>
              <NavLink end to="/helpdesk"><SideNavLabel token="section.overview">{t('navigation.overview')}</SideNavLabel></NavLink>
              <NavLink end to="/helpdesk/tickets" className={({ isActive }) => isActive || inTicketWorkspace ? 'active' : ''}><SideNavLabel token="section.tickets">{t('navigation.tickets')}</SideNavLabel></NavLink>
              <NavLink to="/helpdesk/assigned"><SideNavLabel token="section.assigned">{t('navigation.assignedToMe')}</SideNavLabel></NavLink>
              <NavLink to="/helpdesk/team"><SideNavLabel token="section.team">{t('navigation.teamQueue')}</SideNavLabel></NavLink>
              <div className="prod-side-section">{t('navigation.manage')}</div>
              <NavLink to="/helpdesk/sla"><SideNavLabel token="section.sla">{t('navigation.slaEscalation')}</SideNavLabel></NavLink>
              {canManageSla ? <NavLink to="/helpdesk/calendar"><SideNavLabel token="section.calendar">{t('navigation.businessCalendar')}</SideNavLabel></NavLink> : null}
              {canViewAutomation ? <NavLink to="/helpdesk/automation"><SideNavLabel token="section.automation">{t('navigation.automation')}</SideNavLabel></NavLink> : null}
            </>
          ) : inReports ? (
            <>
              <div className="prod-side-title">{t('reports.title')}</div>
              <div className="prod-side-section">{t('reports.title')}</div>
              <NavLink end to="/reports"><SideNavLabel token="section.audit">{t('reports.title')}</SideNavLabel></NavLink>
              <NavLink to="/reports/schedules"><SideNavLabel token="section.calendar">{t('reports.schedules.title')}</SideNavLabel></NavLink>
            </>
          ) : inDevices ? (
            <>
              <div className="prod-side-title">{t('navigation.devices')}</div>
              <div className="prod-side-section">{t('navigation.workspace')}</div>
              <NavLink end to="/devices" className={({ isActive }) => isActive || inDeviceDetail ? 'active' : ''}><SideNavLabel token="nav.devices">{t('navigation.devices')}</SideNavLabel></NavLink>
              <NavLink to="/devices/discovery"><SideNavLabel token="section.discovery">{t('navigation.discovery')}</SideNavLabel></NavLink>
              <NavLink to="/devices/groups"><SideNavLabel token="section.groups">{t('navigation.deviceGroups')}</SideNavLabel></NavLink>
              {canRemoteDevices ? <NavLink to="/devices/remote-operations"><SideNavLabel token="section.remote">Remote Operations</SideNavLabel></NavLink> : null}
              <NavLink to="/devices/remote-consent"><SideNavLabel token="section.security">Remote Consent</SideNavLabel></NavLink>
              <NavLink to="/devices/query"><SideNavLabel token="section.query">{t('navigation.inventoryQuery')}</SideNavLabel></NavLink>
              <NavLink to="/devices/deployments"><SideNavLabel token="section.deployment">Deployment Jobs</SideNavLabel></NavLink>
              <NavLink to="/devices/maintenance"><SideNavLabel token="section.settings">Agent Maintenance</SideNavLabel></NavLink>
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
            aria-label={t('navigation.openContext', { context: contextLabel })}
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
