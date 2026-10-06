import { lazy, Suspense } from 'react';
import { I18nProvider } from '@inno/i18n';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getCurrentProfile } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { AdminAccessScopesPage } from '../pages/AdminAccessScopesPage';
import { AdminAccessScopeEditPage } from '../pages/AdminAccessScopeEditPage';
import { AdminAuditPage } from '../pages/AdminAuditPage';
import { AdminBrandingPage } from '../pages/AdminBrandingPage';
import { AdminPlatformSettingsPage } from '../pages/AdminPlatformSettingsPage';
import { AdminSecurityPage } from '../pages/AdminSecurityPage';
import { AdminAppsPage } from '../pages/AdminAppsPage';
import { AdminIntegrationsPage } from '../pages/AdminIntegrationsPage';
import { AdminLocationsPage, AdminOrganizationPage } from '../pages/AdminHierarchyPage';
import { AdminOverviewPage } from '../pages/AdminOverviewPage';
import { AdminPositionsPage } from '../pages/AdminPositionsPage';
import { AdminRolesPage } from '../pages/AdminRolesPage';
import { AdminUserDetailPage } from '../pages/AdminUserDetailPage';
import { AdminUserEditorPage } from '../pages/AdminUserEditorPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { AgentDeploymentPage } from '../pages/AgentDeploymentPage';
import { AppsPage } from '../pages/AppsPage';
import { AssetCustomFieldsPage } from '../pages/AssetCustomFieldsPage';
import { AssetDetailPage } from '../pages/AssetDetailPage';
import { AssetEditPage } from '../pages/AssetEditPage';
import { AssetInventoryPage } from '../pages/AssetInventoryPage';
import { AssetOwnerDetailPage } from '../pages/AssetOwnerDetailPage';
import { AssetOwnersPage } from '../pages/AssetOwnersPage';
import { AssetOwnershipPage } from '../pages/AssetOwnershipPage';
import { AssetOwnershipSubmissionsPage } from '../pages/AssetOwnershipSubmissionsPage';
import { AssetQrLabelsPage } from '../pages/AssetQrLabelsPage';
import { AssetsAutomationRulesPage } from '../pages/AssetsAutomationRulesPage';
import { AssetsOverviewPage } from '../pages/AssetsOverviewPage';
import { SoftwareBaselineDetailPage } from '../pages/SoftwareBaselineDetailPage';
import { SoftwareBaselineEditorPage } from '../pages/SoftwareBaselineEditorPage';
import { SoftwareBaselinesPage } from '../pages/SoftwareBaselinesPage';
import { SoftwareLicenseDetailPage } from '../pages/SoftwareLicenseDetailPage';
import { SoftwareLicensesPage } from '../pages/SoftwareLicensesPage';
import { AutomationRulesPage } from '../pages/AutomationRulesPage';
import { BusinessCalendarPage } from '../pages/BusinessCalendarPage';
import { ContractDetailPage } from '../pages/ContractDetailPage';
import { ContractEditPage } from '../pages/ContractEditPage';
import { ContractsWarrantyPage } from '../pages/ContractsWarrantyPage';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { DeviceGroupDetailPage } from '../pages/DeviceGroupDetailPage';
import { DeviceGroupsPage } from '../pages/DeviceGroupsPage';
import {
  AgentMaintenancePage,
  AgentRolloutCreatePage,
  AgentUpdatesPage,
  DeploymentCreatePage,
  DeploymentJobDetailPage,
  DeploymentJobsPage,
  MaintenanceHistoryPage,
  RestartOperationsPage,
  RestartSchedulePage,
  SoftwareMaintenanceCreatePage,
  SoftwareMaintenancePage,
} from '../pages/DeviceMaintenancePages';
import { DevicesPage } from '../pages/DevicesPage';
import { DevicesOverviewPage } from '../pages/DevicesOverviewPage';
import {
  EndpointPoliciesPage,
  EndpointPolicyCompliancePage,
  EndpointPolicyDetailPage,
} from '../pages/EndpointPoliciesPage';
import {
  DeviceAlertChannelsPage,
  DeviceAlertHistoryPage,
  DeviceAlertRuleEditorPage,
  DeviceAlertRulesPage,
  DeviceAlertsPage,
} from '../pages/DeviceAlertsPages';
import { DiscoveryPage } from '../pages/DiscoveryPage';
import { InventoryQueryPage } from '../pages/InventoryQueryPage';
import { DeferredPage } from '../pages/DeferredPage';
import { HelpdeskOverviewPage } from '../pages/HelpdeskOverviewPage';
import { HelpdeskSlaPage } from '../pages/HelpdeskSlaPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { ReportEditorPage } from '../pages/ReportEditorPage';
import { ReportRunsPage } from '../pages/ReportRunsPage';
import { ReportSchedulesPage } from '../pages/ReportSchedulesPage';
import { ReportsPage } from '../pages/ReportsPage';
import { RemoteOperationsPage } from '../pages/RemoteOperationsPage';
import { RemoteConsentPage } from '../pages/RemoteConsentPage';
import { SearchPage } from '../pages/SearchPage';
import {
  WorkspaceAttentionPage,
  WorkspaceContinuePage,
  WorkspaceHomePage,
  WorkspaceRecentPage,
} from '../pages/WorkspacePages';
import { TicketCreatePage } from '../pages/TicketCreatePage';
import { TicketDetailPage } from '../pages/TicketDetailPage';
import { TicketsPage } from '../pages/TicketsPage';
import { AppShell } from './AppShell';
import { ProfileProvider } from './ProfileContext';

const InternalDesignSystemPage = lazy(async () => {
  const module = await import('../pages/InternalDesignSystemPage');
  return { default: module.InternalDesignSystemPage };
});

const AutomationRulePage = lazy(async () => {
  const module = await import('../pages/AutomationRulePage');
  return { default: module.AutomationRulePage };
});

const AutomationRunsPage = lazy(async () => {
  const module = await import('../pages/AutomationRunsPage');
  return { default: module.AutomationRunsPage };
});

const AssetsAutomationRulePage = lazy(async () => {
  const module = await import('../pages/AssetsAutomationRulePage');
  return { default: module.AssetsAutomationRulePage };
});

const AssetsAutomationRunsPage = lazy(async () => {
  const module = await import('../pages/AssetsAutomationRunsPage');
  return { default: module.AssetsAutomationRunsPage };
});

export function AppRoot() {
  const profileQuery = useQuery({
    queryKey: ['platform', 'me'],
    queryFn: getCurrentProfile,
    staleTime: 5 * 60 * 1000,
  });

  if (profileQuery.isPending) {
    return <div className="boot-screen"><LoadingState label="Loading your INNO.One profile…" /></div>;
  }

  if (profileQuery.isError) {
    return <div className="boot-screen boot-error"><ErrorState error={profileQuery.error} retry={() => void profileQuery.refetch()} /></div>;
  }

  const profile = profileQuery.data;
  const canWorkspace = profile.permissions.includes('platform.workspace.access');
  const canViewApps = profile.permissions.includes('platform.apps.view');
  const canViewNotifications = profile.permissions.includes('platform.notifications.view');
  const canUseSearch = profile.permissions.includes('platform.search.use');
  const canAdmin = profile.permissions.includes('admin.access');
  const canAdminOrganization = profile.permissions.includes('admin.organization.view');
  const canAdminLocations = profile.permissions.includes('admin.locations.view');
  const canAdminPositions = profile.permissions.includes('admin.positions.view');
  const canAdminUsers = profile.permissions.includes('admin.users.view');
  const canAdminRoles = profile.permissions.includes('admin.roles.view');
  const canAdminScopes = profile.permissions.includes('admin.access_scopes.view');
  const canAdminIntegrations = profile.permissions.includes('admin.integrations.view');
  const canAdminSecurity = profile.permissions.includes('admin.security.view');
  const canAdminAudit = profile.permissions.includes('admin.audit.view');
  const canAdminBranding = profile.permissions.includes('admin.branding.manage');
  const canAdminSettings = profile.permissions.includes('admin.settings.manage');
  const canAdminApps = profile.permissions.includes('admin.apps.view');
  const canViewDevices = profile.permissions.includes('devices.view');
  const canManageDevices = profile.permissions.includes('devices.manage');
  const canRemoteDevices = profile.permissions.includes('devices.remote');
  const canDeployDevices = profile.permissions.includes('devices.deploy');
  const canViewDeviceAlerts = profile.permissions.includes('devices.alert.view');
  const canManageDeviceAlerts = profile.permissions.includes('devices.alert.manage');
  const canViewAssets = profile.permissions.includes('assets.view');
  const canManageAssets = profile.permissions.includes('assets.manage');
  const canManageAssetBaselines = profile.permissions.includes('assets.baseline.manage');
  const canPrintAssetQr = profile.permissions.includes('assets.qr.print');
  const canManageAssetLicenses = profile.permissions.includes('assets.license.manage');
  const canViewAssetsAutomation = profile.permissions.includes('assets.automation.view');
  const canManageAssetsAutomation = profile.permissions.includes('assets.automation.manage');
  const canViewAssetsAutomationRuns = profile.permissions.includes('assets.automation.run.view');
  const canViewHelpdesk = profile.permissions.includes('helpdesk.ticket.view');
  const canCreateTicket = profile.permissions.includes('helpdesk.ticket.create');
  const canViewAutomation = profile.permissions.includes('helpdesk.automation.view');
  const canManageAutomation = profile.permissions.includes('helpdesk.automation.manage');
  const canViewAutomationRuns = profile.permissions.includes('helpdesk.automation.run.view');
  const canManageSla = profile.permissions.includes('helpdesk.sla.manage');
  const canViewReports = profile.permissions.includes('reports.view');
  const canCreateReports = profile.permissions.includes('reports.create');
  const canManageReports = profile.permissions.includes('reports.manage');

  return (
    <I18nProvider locale={profile.locale}>
      <ProfileProvider profile={profile}>
        <Routes>
        <Route element={<AppShell />}>
          <Route index element={canWorkspace ? <WorkspaceHomePage /> : <Navigate to="/profile" replace />} />
          <Route path="workspace/continue" element={canWorkspace ? <WorkspaceContinuePage /> : <DeferredPage name="Continue Working" kind="permission" />} />
          <Route path="workspace/attention" element={canWorkspace ? <WorkspaceAttentionPage /> : <DeferredPage name="Needs Attention" kind="permission" />} />
          <Route path="workspace/recent" element={canWorkspace ? <WorkspaceRecentPage /> : <DeferredPage name="Recent Activity" kind="permission" />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={canViewNotifications ? <NotificationsPage /> : <DeferredPage name="Notifications" kind="permission" />} />
          <Route path="search" element={canUseSearch ? <SearchPage /> : <DeferredPage name="Search" kind="permission" />} />
          <Route path="apps" element={canViewApps ? <AppsPage /> : <DeferredPage name="Apps" kind="permission" />} />

          {/* Step 45F: standalone Dynamic Workflows Product surface is retired. */}
          <Route path="workflows/*" element={<Navigate to="/helpdesk/automation" replace />} />

          <Route path="admin" element={canAdmin ? <AdminOverviewPage /> : <DeferredPage name="Admin Center" kind="permission" />} />
          <Route path="admin/organization" element={canAdminOrganization ? <AdminOrganizationPage /> : <DeferredPage name="Organization Structure" kind="permission" />} />
          <Route path="admin/locations" element={canAdminLocations ? <AdminLocationsPage /> : <DeferredPage name="Locations" kind="permission" />} />
          <Route path="admin/positions" element={canAdminPositions ? <AdminPositionsPage /> : <DeferredPage name="Positions" kind="permission" />} />
          <Route path="admin/users" element={canAdminUsers ? <AdminUsersPage /> : <DeferredPage name="Users" kind="permission" />} />
          <Route path="admin/users/new" element={canAdminUsers ? <AdminUserEditorPage /> : <DeferredPage name="New User" kind="permission" />} />
          <Route path="admin/users/:userId/edit" element={canAdminUsers ? <AdminUserEditorPage /> : <DeferredPage name="Edit User" kind="permission" />} />
          <Route path="admin/users/:userId" element={canAdminUsers ? <AdminUserDetailPage /> : <DeferredPage name="User Detail" kind="permission" />} />
          <Route path="admin/roles" element={canAdminRoles ? <AdminRolesPage /> : <DeferredPage name="Roles & Permissions" kind="permission" />} />
          <Route path="admin/access-scopes" element={canAdminScopes ? <AdminAccessScopesPage /> : <DeferredPage name="Access Scopes" kind="permission" />} />
          <Route path="admin/access-scopes/:assignmentId/edit" element={canAdminScopes ? <AdminAccessScopeEditPage /> : <DeferredPage name="Edit Access Scope" kind="permission" />} />
          <Route path="admin/integrations" element={canAdminIntegrations ? <AdminIntegrationsPage /> : <DeferredPage name="Integrations" kind="permission" />} />
          <Route path="admin/security" element={canAdminSecurity ? <AdminSecurityPage /> : <DeferredPage name="Security" kind="permission" />} />
          <Route path="admin/audit" element={canAdminAudit ? <AdminAuditPage /> : <DeferredPage name="Audit Log" kind="permission" />} />
          <Route path="admin/branding" element={canAdminBranding ? <AdminBrandingPage /> : <DeferredPage name="Branding" kind="permission" />} />
          <Route path="admin/settings" element={canAdminSettings ? <AdminPlatformSettingsPage /> : <DeferredPage name="Platform Settings" kind="permission" />} />
          <Route path="admin/apps" element={canAdminApps ? <AdminAppsPage /> : <DeferredPage name="Apps & Modules" kind="permission" />} />

          {/* Internal reference route: intentionally absent from normal product navigation. */}
          <Route
            path="internal/design-system"
            element={canAdmin ? (
              <Suspense fallback={<LoadingState label="Loading design system…" />}>
                <InternalDesignSystemPage />
              </Suspense>
            ) : <DeferredPage name="Design System" kind="permission" />}
          />

          <Route path="devices" element={canViewDevices ? <DevicesPage /> : <DeferredPage name="Devices" kind="permission" />} />
          <Route path="devices/overview" element={canViewDevices ? <DevicesOverviewPage /> : <DeferredPage name="Devices Overview" kind="permission" />} />
          <Route path="devices/discovery" element={canViewDevices ? <DiscoveryPage /> : <DeferredPage name="Discovery" kind="permission" />} />
          <Route path="devices/query" element={canViewDevices ? <InventoryQueryPage /> : <DeferredPage name="Inventory Query" kind="permission" />} />
          <Route path="devices/groups" element={canViewDevices ? <DeviceGroupsPage /> : <DeferredPage name="Device Groups" kind="permission" />} />
          <Route path="devices/groups/:groupId" element={canViewDevices ? <DeviceGroupDetailPage /> : <DeferredPage name="Device Group" kind="permission" />} />
          <Route path="devices/remote-operations" element={canRemoteDevices ? <RemoteOperationsPage /> : <DeferredPage name="Remote Operations" kind="permission" />} />
          <Route path="devices/remote-consent" element={canViewDevices ? <RemoteConsentPage /> : <DeferredPage name="Remote Consent" kind="permission" />} />
          <Route path="devices/deployments" element={canViewDevices ? <DeploymentJobsPage /> : <DeferredPage name="Deployment Jobs" kind="permission" />} />
          <Route path="devices/deployments/new" element={canDeployDevices ? <DeploymentCreatePage /> : <DeferredPage name="New Deployment" kind="permission" />} />
          <Route path="devices/deployments/:deploymentId" element={canViewDevices ? <DeploymentJobDetailPage /> : <DeferredPage name="Deployment Job" kind="permission" />} />
          <Route path="devices/maintenance" element={canViewDevices ? <AgentMaintenancePage /> : <DeferredPage name="Agent Maintenance" kind="permission" />} />
          <Route path="devices/maintenance/agent-updates" element={canViewDevices ? <AgentUpdatesPage /> : <DeferredPage name="Agent Updates" kind="permission" />} />
          <Route path="devices/maintenance/agent-rollouts/new" element={canDeployDevices ? <AgentRolloutCreatePage /> : <DeferredPage name="New Agent Rollout" kind="permission" />} />
          <Route path="devices/maintenance/software" element={canViewDevices ? <SoftwareMaintenancePage /> : <DeferredPage name="Software Maintenance" kind="permission" />} />
          <Route path="devices/maintenance/software/new" element={canDeployDevices ? <SoftwareMaintenanceCreatePage /> : <DeferredPage name="New Software Maintenance Job" kind="permission" />} />
          <Route path="devices/maintenance/restarts" element={canViewDevices ? <RestartOperationsPage /> : <DeferredPage name="Restart Operations" kind="permission" />} />
          <Route path="devices/maintenance/restarts/new" element={canManageDevices ? <RestartSchedulePage /> : <DeferredPage name="Schedule Restart" kind="permission" />} />
          <Route path="devices/maintenance/history" element={canViewDevices ? <MaintenanceHistoryPage /> : <DeferredPage name="Maintenance History" kind="permission" />} />
          <Route path="devices/policies" element={canViewDevices ? <EndpointPoliciesPage /> : <DeferredPage name="Endpoint Policies" kind="permission" />} />
          <Route path="devices/policies/:policyId/compliance" element={canViewDevices ? <EndpointPolicyCompliancePage /> : <DeferredPage name="Policy Compliance" kind="permission" />} />
          <Route path="devices/policies/:policyId" element={canViewDevices ? <EndpointPolicyDetailPage /> : <DeferredPage name="Endpoint Policy" kind="permission" />} />
          <Route path="devices/alerts" element={canViewDeviceAlerts ? <DeviceAlertsPage /> : <DeferredPage name="Active Alerts" kind="permission" />} />
          <Route path="devices/alerts/rules" element={canViewDeviceAlerts ? <DeviceAlertRulesPage /> : <DeferredPage name="Alert Rules" kind="permission" />} />
          <Route path="devices/alerts/rules/new" element={canManageDeviceAlerts ? <DeviceAlertRuleEditorPage /> : <DeferredPage name="New Alert Rule" kind="permission" />} />
          <Route path="devices/alerts/rules/:ruleId" element={canViewDeviceAlerts ? <DeviceAlertRuleEditorPage /> : <DeferredPage name="Alert Rule" kind="permission" />} />
          <Route path="devices/alerts/channels" element={canViewDeviceAlerts ? <DeviceAlertChannelsPage /> : <DeferredPage name="Alert Channels" kind="permission" />} />
          <Route path="devices/alerts/history" element={canViewDeviceAlerts ? <DeviceAlertHistoryPage /> : <DeferredPage name="Alert History" kind="permission" />} />
          {/* Step45P: Devices Automation is retired; old bookmarks return to the Devices workspace. */}
          <Route path="devices/automation/*" element={<Navigate to="/devices" replace />} />
          <Route path="devices/add" element={canDeployDevices ? <AgentDeploymentPage /> : <DeferredPage name="Agent Deployment" kind="permission" />} />
          <Route path="devices/:deviceId" element={canViewDevices ? <DeviceDetailPage /> : <DeferredPage name="Device" kind="permission" />} />

          <Route path="assets" element={canViewAssets ? <AssetsOverviewPage /> : <DeferredPage name="Assets" kind="permission" />} />
          <Route path="assets/inventory" element={canViewAssets ? <AssetInventoryPage /> : <DeferredPage name="Asset Inventory" kind="permission" />} />
          <Route path="assets/ownership" element={canViewAssets ? <AssetOwnershipPage /> : <DeferredPage name="Asset Ownership" kind="permission" />} />
          <Route path="assets/owners" element={canViewAssets ? <AssetOwnersPage /> : <DeferredPage name="Asset Owners" kind="permission" />} />
          <Route path="assets/owners/:userId" element={canViewAssets ? <AssetOwnerDetailPage /> : <DeferredPage name="Asset Owner" kind="permission" />} />
          <Route path="assets/ownership/submissions" element={canViewAssets ? <AssetOwnershipSubmissionsPage /> : <DeferredPage name="Agent Submissions" kind="permission" />} />
          <Route path="assets/custom-fields" element={canViewAssets ? <AssetCustomFieldsPage /> : <DeferredPage name="Custom Fields" kind="permission" />} />
          <Route path="assets/qr-labels" element={canViewAssets && canPrintAssetQr ? <AssetQrLabelsPage /> : <DeferredPage name="QR Labels" kind="permission" />} />
          <Route path="assets/software-baselines" element={canViewAssets ? <SoftwareBaselinesPage /> : <DeferredPage name="Software Baselines" kind="permission" />} />
          <Route path="assets/software-baselines/new" element={canViewAssets && canManageAssetBaselines ? <SoftwareBaselineEditorPage /> : <DeferredPage name="New Software Baseline" kind="permission" />} />
          <Route path="assets/software-baselines/:baselineId/edit" element={canViewAssets && canManageAssetBaselines ? <SoftwareBaselineEditorPage /> : <DeferredPage name="Edit Software Baseline" kind="permission" />} />
          <Route path="assets/software-baselines/:baselineId" element={canViewAssets ? <SoftwareBaselineDetailPage /> : <DeferredPage name="Software Baseline" kind="permission" />} />
          <Route path="assets/software-licenses" element={canViewAssets && canManageAssetLicenses ? <SoftwareLicensesPage /> : <DeferredPage name="Software Licenses" kind="permission" />} />
          <Route path="assets/software-licenses/:licenseId" element={canViewAssets && canManageAssetLicenses ? <SoftwareLicenseDetailPage /> : <DeferredPage name="Software License" kind="permission" />} />
          <Route path="assets/contracts" element={canViewAssets ? <ContractsWarrantyPage /> : <DeferredPage name="Contracts & Warranty" kind="permission" />} />
          <Route path="assets/contracts/:contractId/edit" element={canViewAssets ? <ContractEditPage /> : <DeferredPage name="Edit Contract" kind="permission" />} />
          <Route path="assets/contracts/:contractId" element={canViewAssets ? <ContractDetailPage /> : <DeferredPage name="Contract" kind="permission" />} />
          <Route path="assets/automation" element={canViewAssetsAutomation ? <AssetsAutomationRulesPage /> : <DeferredPage name="Assets Automation" kind="permission" />} />
          <Route
            path="assets/automation/new"
            element={canManageAssetsAutomation ? (
              <Suspense fallback={<LoadingState />}>
                <AssetsAutomationRulePage />
              </Suspense>
            ) : <DeferredPage name="New Assets Automation" kind="permission" />}
          />
          <Route
            path="assets/automation/:automationId/runs"
            element={canViewAssetsAutomationRuns ? (
              <Suspense fallback={<LoadingState />}>
                <AssetsAutomationRunsPage />
              </Suspense>
            ) : <DeferredPage name="Assets Automation Run History" kind="permission" />}
          />
          <Route
            path="assets/automation/:automationId"
            element={canManageAssetsAutomation ? (
              <Suspense fallback={<LoadingState />}>
                <AssetsAutomationRulePage />
              </Suspense>
            ) : <DeferredPage name="Assets Automation" kind="permission" />}
          />
          <Route path="assets/:assetId/edit" element={canViewAssets && canManageAssets ? <AssetEditPage /> : <DeferredPage name="Edit Asset" kind="permission" />} />
          <Route path="assets/:assetId" element={canViewAssets ? <AssetDetailPage /> : <DeferredPage name="Asset" kind="permission" />} />

          <Route path="helpdesk" element={canViewHelpdesk ? <HelpdeskOverviewPage /> : <DeferredPage name="Helpdesk" kind="permission" />} />
          <Route path="helpdesk/tickets" element={canViewHelpdesk ? <TicketsPage /> : <DeferredPage name="Helpdesk Tickets" kind="permission" />} />
          <Route path="helpdesk/assigned" element={canViewHelpdesk ? <TicketsPage mode="mine" /> : <DeferredPage name="Assigned Tickets" kind="permission" />} />
          <Route path="helpdesk/team" element={canViewHelpdesk ? <TicketsPage mode="team" /> : <DeferredPage name="Team Queue" kind="permission" />} />
          <Route path="helpdesk/tickets/new" element={canCreateTicket ? <TicketCreatePage /> : <DeferredPage name="Create Ticket" kind="permission" />} />
          <Route path="helpdesk/tickets/:ticketId" element={canViewHelpdesk ? <TicketDetailPage /> : <DeferredPage name="Ticket" kind="permission" />} />
          <Route path="helpdesk/sla" element={canViewHelpdesk ? <HelpdeskSlaPage /> : <DeferredPage name="SLA & Escalation" kind="permission" />} />
          <Route path="helpdesk/calendar" element={canManageSla ? <BusinessCalendarPage /> : <DeferredPage name="Business Calendar" kind="permission" />} />
          <Route path="helpdesk/automation" element={canViewAutomation ? <AutomationRulesPage /> : <DeferredPage name="Automation" kind="permission" />} />
          <Route
            path="helpdesk/automation/new"
            element={canManageAutomation ? (
              <Suspense fallback={<LoadingState />}>
                <AutomationRulePage />
              </Suspense>
            ) : <DeferredPage name="New Automation" kind="permission" />}
          />
          <Route
            path="helpdesk/automation/:automationId/runs"
            element={canViewAutomationRuns ? (
              <Suspense fallback={<LoadingState />}>
                <AutomationRunsPage />
              </Suspense>
            ) : <DeferredPage name="Automation Run History" kind="permission" />}
          />
          <Route
            path="helpdesk/automation/:automationId"
            element={canManageAutomation ? (
              <Suspense fallback={<LoadingState />}>
                <AutomationRulePage />
              </Suspense>
            ) : <DeferredPage name="Automation" kind="permission" />}
          />

          <Route path="reports" element={canViewReports ? <ReportsPage /> : <DeferredPage name="Reports" kind="permission" />} />
          <Route path="reports/new" element={canCreateReports ? <ReportEditorPage /> : <DeferredPage name="New Report" kind="permission" />} />
          <Route path="reports/schedules" element={canViewReports ? <ReportSchedulesPage /> : <DeferredPage name="Report Schedules" kind="permission" />} />
          <Route path="reports/:reportId/runs" element={canViewReports ? <ReportRunsPage /> : <DeferredPage name="Report Run History" kind="permission" />} />
          <Route path="reports/:reportId" element={canManageReports ? <ReportEditorPage /> : <DeferredPage name="Report" kind="permission" />} />

          <Route path="apps/*" element={<DeferredPage name="Apps" kind="no-results" />} />
          <Route path="assets/manage/*" element={canManageAssets ? <DeferredPage name="Assets Management" /> : <DeferredPage name="Assets" />} />
          <Route path="meeting/*" element={<DeferredPage name="Meeting" />} />
          <Route path="reports/*" element={<DeferredPage name="Reports" kind="no-results" />} />
          <Route path="admin/*" element={<DeferredPage name="Admin Center" kind="no-results" />} />
          <Route path="*" element={<DeferredPage name="Not Found" kind="no-results" />} />
        </Route>
        </Routes>
      </ProfileProvider>
    </I18nProvider>
  );
}
