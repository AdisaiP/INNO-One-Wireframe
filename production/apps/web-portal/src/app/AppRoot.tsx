import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getCurrentProfile } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { AgentDeploymentPage } from '../pages/AgentDeploymentPage';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { DeviceGroupDetailPage } from '../pages/DeviceGroupDetailPage';
import { DeviceGroupsPage } from '../pages/DeviceGroupsPage';
import { DevicesPage } from '../pages/DevicesPage';
import { DiscoveryPage } from '../pages/DiscoveryPage';
import { DeferredPage } from '../pages/DeferredPage';
import { HelpdeskOverviewPage } from '../pages/HelpdeskOverviewPage';
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
  const canViewDevices = profile.permissions.includes('devices.view');
  const canDeployDevices = profile.permissions.includes('devices.deploy');
  const canViewHelpdesk = profile.permissions.includes('helpdesk.ticket.view');
  const canCreateTicket = profile.permissions.includes('helpdesk.ticket.create');
  const landingPath = canViewDevices ? '/devices' : canViewHelpdesk ? '/helpdesk' : '/profile';

  return (
    <ProfileProvider profile={profile}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={landingPath} replace />} />
          <Route path="profile" element={<ProfilePage />} />

          <Route path="devices" element={canViewDevices ? <DevicesPage /> : <DeferredPage name="Devices" />} />
          <Route path="devices/discovery" element={canViewDevices ? <DiscoveryPage /> : <DeferredPage name="Discovery" />} />
          <Route path="devices/groups" element={canViewDevices ? <DeviceGroupsPage /> : <DeferredPage name="Device Groups" />} />
          <Route path="devices/groups/:groupId" element={canViewDevices ? <DeviceGroupDetailPage /> : <DeferredPage name="Device Group" />} />
          <Route path="devices/add" element={canDeployDevices ? <AgentDeploymentPage /> : <DeferredPage name="Agent Deployment" />} />
          <Route path="devices/:deviceId" element={canViewDevices ? <DeviceDetailPage /> : <DeferredPage name="Device" />} />

          <Route path="helpdesk" element={canViewHelpdesk ? <HelpdeskOverviewPage /> : <DeferredPage name="Helpdesk" />} />
          <Route path="helpdesk/tickets" element={canViewHelpdesk ? <TicketsPage /> : <DeferredPage name="Helpdesk Tickets" />} />
          <Route path="helpdesk/assigned" element={canViewHelpdesk ? <TicketsPage mode="mine" /> : <DeferredPage name="Assigned Tickets" />} />
          <Route path="helpdesk/team" element={canViewHelpdesk ? <TicketsPage mode="team" /> : <DeferredPage name="Team Queue" />} />
          <Route path="helpdesk/tickets/new" element={canCreateTicket ? <TicketCreatePage /> : <DeferredPage name="Create Ticket" />} />
          <Route path="helpdesk/tickets/:ticketId" element={canViewHelpdesk ? <TicketDetailPage /> : <DeferredPage name="Ticket" />} />

          <Route path="apps/*" element={<DeferredPage name="Apps" />} />
          <Route path="assets/*" element={<DeferredPage name="Assets" />} />
          <Route path="meeting/*" element={<DeferredPage name="Meeting" />} />
          <Route path="reports/*" element={<DeferredPage name="Reports" />} />
          <Route path="admin/*" element={<DeferredPage name="Admin Center" />} />
          <Route path="*" element={<DeferredPage name="Not Found" />} />
        </Route>
      </Routes>
    </ProfileProvider>
  );
}
