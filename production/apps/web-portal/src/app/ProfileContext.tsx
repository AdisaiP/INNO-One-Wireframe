import { createContext, useContext, type PropsWithChildren } from 'react';
import type { Profile } from '../api/types';

const ProfileContext = createContext<Profile | null>(null);

export function ProfileProvider({
  profile,
  children,
}: PropsWithChildren<{ profile: Profile }>) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) {
    throw new Error('ProfileProvider is missing');
  }
  return profile;
}

export function usePermission(permission: string): boolean {
  return useProfile().permissions.includes(permission);
}
