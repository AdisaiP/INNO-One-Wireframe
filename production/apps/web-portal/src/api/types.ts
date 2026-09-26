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

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}
