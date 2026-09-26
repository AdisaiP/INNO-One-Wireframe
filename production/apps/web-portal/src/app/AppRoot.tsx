import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getCurrentProfile } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { DevicesPage } from '../pages/DevicesPage';
import { DeferredPage } from '../pages/DeferredPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AppShell } from './AppShell';
import { ProfileProvider } from './ProfileContext';

export function AppRoot() {
  const profileQuery = useQuery({
    queryKey: ['platform', 'me'],
    queryFn: getCurrentProfile,
    staleTime: 5 * 60 * 1000,
  });

  if (profileQuery.isPending) {
    return (
      <div className="boot-screen">
        <LoadingState label="Loading your INNO.One profile…" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="boot-screen boot-error">
        <ErrorState error={profileQuery.error} retry={() => void profileQuery.refetch()} />
      </div>
    );
  }

  const profile = profileQuery.data;
  const canViewDevices = profile.permissions.includes('devices.view');

  return (
    <ProfileProvider profile={profile}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to={canViewDevices ? '/devices' : '/profile'} replace />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="devices"
            element={canViewDevices ? <DevicesPage /> : <DeferredPage name="Devices" />}
          />
          <Route
            path="devices/:deviceId"
            element={canViewDevices ? <DeviceDetailPage /> : <DeferredPage name="Device" />}
          />
          <Route path="apps/*" element={<DeferredPage name="Apps" />} />
          <Route path="assets/*" element={<DeferredPage name="Assets" />} />
          <Route path="helpdesk/*" element={<DeferredPage name="Helpdesk" />} />
          <Route path="meeting/*" element={<DeferredPage name="Meeting" />} />
          <Route path="reports/*" element={<DeferredPage name="Reports" />} />
          <Route path="admin/*" element={<DeferredPage name="Admin Center" />} />
          <Route path="*" element={<DeferredPage name="Not Found" />} />
        </Route>
      </Routes>
    </ProfileProvider>
  );
}
