export interface ResourceEnvelope<T> {
  data: T;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ReferenceValue {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  office?: string | null;
  status: string;
  organization?: ReferenceValue | null;
  position?: ReferenceValue | null;
  location?: ReferenceValue | null;
  roles: string[];
  permissions: string[];
  timeZone: string;
  ssoStatus: string;
}

export interface DeviceListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  ipAddress?: string | null;
  serialNumber?: string | null;
  user?: string | null;
  operatingSystem?: string | null;
  group?: string | null;
  organization?: string | null;
  location?: string | null;
  lastSeenAt?: string | null;
}

export interface DeviceDetail {
  id: string;
  name: string;
  type: string;
  status: string;
  isOffline: boolean;
  assignedUser?: string | null;
  organization?: ReferenceValue | null;
  location?: ReferenceValue | null;
  groups: ReferenceValue[];
  serialNumber?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  operatingSystem?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  processor?: string | null;
  biosVersion?: string | null;
  loggedOnUser?: string | null;
  assetReference?: string | null;
  agentVersion?: string | null;
  lastSeenAt?: string | null;
  cpuPercent?: number | null;
  memoryUsedGb?: number | null;
  memoryTotalGb?: number | null;
  diskUsedGb?: number | null;
  diskTotalGb?: number | null;
  managementEngine?: string | null;
}

export interface DeviceGroupListItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  groupType: string;
  status: string;
  syncStatus: string;
  organization?: string | null;
  location?: string | null;
  members: number;
  online: number;
  lastSyncedAt?: string | null;
  eTag: string;
}

export interface DeviceGroupDetail {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  groupType: string;
  status: string;
  syncStatus: string;
  organization?: ReferenceValue | null;
  location?: ReferenceValue | null;
  members: number;
  online: number;
  lastSyncedAt?: string | null;
  eTag: string;
}

export interface DeviceGroupMember {
  id: string;
  name: string;
  type: string;
  status: string;
  user?: string | null;
  organization?: string | null;
  location?: string | null;
  ipAddress?: string | null;
  operatingSystem?: string | null;
  lastSeenAt?: string | null;
}

export interface DiscoveryScan {
  id: string;
  operationId: string;
  status: string;
  progress: number;
  ranges: string[];
  addressesScanned: number;
  devicesFound: number;
  unmanagedCount: number;
  errorCode?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface DiscoveryResult {
  id: string;
  ipAddress: string;
  hostname?: string | null;
  detectedOperatingSystem?: string | null;
  vendor?: string | null;
  discoveryMethod: string;
  managementStatus: string;
  matchedDeviceId?: string | null;
  discoveredAt: string;
}

export interface OperationAccepted {
  operationId: string;
  status: string;
  progress: number;
  resource: {
    scanId: string;
    addressCount: number;
  };
}

export interface AgentInstaller {
  id: string;
  groupId: string;
  groupName: string;
  operatingSystem: string;
  profile: string;
  enrollmentUrl: string;
  expiresAt?: string | null;
  status: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}
