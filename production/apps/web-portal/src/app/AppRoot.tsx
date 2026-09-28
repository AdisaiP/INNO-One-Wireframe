import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getCurrentProfile } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { AdminAppsPage } from '../pages/AdminAppsPage';
import { AgentDeploymentPage } from '../pages/AgentDeploymentPage';
import { AppsPage } from '../pages/AppsPage';
import { AssetCustomFieldsPage } from '../pages/AssetCustomFieldsPage';
import { AssetDetailPage } from '../pages/AssetDetailPage';
import { AssetInventoryPage } from '../pages/AssetInventoryPage';
import { AssetOwnerDetailPage } from '../pages/AssetOwnerDetailPage';
import { AssetOwnersPage } from '../pages/AssetOwnersPage';
import { AssetOwnershipPage } from '../pages/AssetOwnershipPage';
import { AssetOwnershipSubmissionsPage } from '../pages/AssetOwnershipSubmissionsPage';
import { AssetQrLabelsPage } from '../pages/AssetQrLabelsPage';
import { AssetsOverviewPage } from '../pages/AssetsOverviewPage';
import { SoftwareBaselinesPage } from '../pages/SoftwareBaselinesPage';
import { SoftwareLicensesPage } from '../pages/SoftwareLicensesPage';
import { AutomationRulePage } from '../pages/AutomationRulePage';
import { AutomationRulesPage } from '../pages/AutomationRulesPage';
import { BusinessCalendarPage } from '../pages/BusinessCalendarPage';
import { ContractsWarrantyPage } from '../pages/ContractsWarrantyPage';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { DeviceGroupDetailPage } from '../pages/DeviceGroupDetailPage';
import { DeviceGroupsPage } from '../pages/DeviceGroupsPage';
import { DevicesPage } from '../pages/DevicesPage';
import { DiscoveryPage } from '../pages/DiscoveryPage';
import { DeferredPage } from '../pages/DeferredPage';
import { HelpdeskOverviewPage } from '../pages/HelpdeskOverviewPage';
import { HelpdeskSlaPage } from '../pages/HelpdeskSlaPage';
import { ProfilePage } from '../pages/ProfilePage';
import { TicketCreatePage } from '../pages/TicketCreatePage';
import { TicketDetailPage } from '../pages/TicketDetailPage';
import { TicketsPage } from '../pages/TicketsPage';
import { AppShell } from './AppShell';
import { ProfileProvider } from './ProfileContext';

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
  const canViewApps = profile.permissions.includes('platform.apps.view');
  const canAdminApps = profile.permissions.includes('admin.apps.view');
  const canViewDevices = profile.permissions.includes('devices.view');
  const canDeployDevices = profile.permissions.includes('devices.deploy');
  const canViewAssets = profile.permissions.includes('assets.view');
  const canManageAssets = profile.permissions.includes('assets.manage');
  const canPrintAssetQr = profile.permissions.includes('assets.qr.print');
  const canManageAssetLicenses = profile.permissions.includes('assets.license.manage');
  const canViewHelpdesk = profile.permissions.includes('helpdesk.ticket.view');
  const canCreateTicket = profile.permissions.includes('helpdesk.ticket.create');
  const canViewAutomation = profile.permissions.includes('helpdesk.automation.view');
  const canManageSla = profile.permissions.includes('helpdesk.sla.manage');
  const landingPath = canViewDevices ? '/devices' : canViewHelpdesk ? '/helpdesk' : canViewAssets ? '/assets' : '/profile';

  return (
    <ProfileProvider profile={profile}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={landingPath} replace />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="apps" element={canViewApps ? <AppsPage /> : <DeferredPage name="Apps" kind="permission" />} />
          <Route path="admin/apps" element={canAdminApps ? <AdminAppsPage /> : <DeferredPage name="Apps & Modules" kind="permission" />} />

          <Route path="devices" element={canViewDevices ? <DevicesPage /> : <DeferredPage name="Devices" kind="permission" />} />
          <Route path="devices/discovery" element={canViewDevices ? <DiscoveryPage /> : <DeferredPage name="Discovery" kind="permission" />} />
          <Route path="devices/groups" element={canViewDevices ? <DeviceGroupsPage /> : <DeferredPage name="Device Groups" kind="permission" />} />
          <Route path="devices/groups/:groupId" element={canViewDevices ? <DeviceGroupDetailPage /> : <DeferredPage name="Device Group" kind="permission" />} />
          <Route path="devices/add" element={canDeployDevices ? <AgentDeploymentPage /> : <DeferredPage name="Agent Deployment" kind="permission" />} />
          <Route path="devices/:deviceId" element={canViewDevices ? <DeviceDetailPage /> : <DeferredPage name="Device" kind="permission" />} />

          <Route path="assets" element={canViewAssets ? <AssetsOverviewPage /> : <DeferredPage name="Assets" kind="permission" />} />
          <Route path="assets/inventory" element={canViewAssets ? <AssetInventoryPage /> : <DeferredPage name="Asset Inventory" kind="permission" />} />
          <Route path="assets/ownership" element={canViewAssets ? <AssetOwnershipPage /> : <DeferredPage name="Ownership & Users" kind="permission" />} />
          <Route path="assets/owners" element={canViewAssets ? <AssetOwnersPage /> : <DeferredPage name="Asset Owners" kind="permission" />} />
          <Route path="assets/owners/:userId" element={canViewAssets ? <AssetOwnerDetailPage /> : <DeferredPage name="Asset Owner" kind="permission" />} />
          <Route path="assets/ownership/submissions" element={canViewAssets ? <AssetOwnershipSubmissionsPage /> : <DeferredPage name="Agent Submissions" kind="permission" />} />
          <Route path="assets/custom-fields" element={canViewAssets ? <AssetCustomFieldsPage /> : <DeferredPage name="Custom Fields" kind="permission" />} />
          <Route path="assets/qr-labels" element={canViewAssets && canPrintAssetQr ? <AssetQrLabelsPage /> : <DeferredPage name="QR Labels" kind="permission" />} />
          <Route path="assets/software-baselines" element={canViewAssets ? <SoftwareBaselinesPage /> : <DeferredPage name="Software Baselines" kind="permission" />} />
          <Route path="assets/software-licenses" element={canViewAssets && canManageAssetLicenses ? <SoftwareLicensesPage /> : <DeferredPage name="Software Licenses" kind="permission" />} />
          <Route path="assets/contracts" element={canViewAssets ? <ContractsWarrantyPage /> : <DeferredPage name="Contracts & Warranty" kind="permission" />} />
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
          <Route path="helpdesk/automation/new" element={canViewAutomation ? <AutomationRulePage /> : <DeferredPage name="New Automation Rule" kind="permission" />} />
          <Route path="helpdesk/automation/:ruleId" element={canViewAutomation ? <AutomationRulePage /> : <DeferredPage name="Automation Rule" kind="permission" />} />

          <Route path="apps/*" element={<DeferredPage name="Apps" kind="no-results" />} />
          <Route path="assets/manage/*" element={canManageAssets ? <DeferredPage name="Assets Management" /> : <DeferredPage name="Assets" />} />
          <Route path="meeting/*" element={<DeferredPage name="Meeting" />} />
          <Route path="reports/*" element={<DeferredPage name="Reports" />} />
          <Route path="admin/*" element={<DeferredPage name="Admin Center" />} />
          <Route path="*" element={<DeferredPage name="Not Found" kind="no-results" />} />
        </Route>
      </Routes>
    </ProfileProvider>
  );
}
