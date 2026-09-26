import { getAccessToken } from '../auth/keycloak';
import type {
  AgentInstaller,
  DeviceDetail,
  DeviceGroupDetail,
  DeviceGroupListItem,
  DeviceGroupMember,
  DeviceListItem,
  DiscoveryResult,
  DiscoveryScan,
  OperationAccepted,
  PagedResponse,
  ProblemDetails,
  Profile,
  ResourceEnvelope,
} from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(
      problem?.detail
      || problem?.title
      || Object.values(problem?.errors ?? {})[0]?.[0]
      || 'Request failed with status ' + status,
    );
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(apiBaseUrl + path, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + token,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = undefined;
    }
    throw new ApiError(response.status, problem);
  }

  return (await response.json()) as T;
}

function jsonRequest(body: unknown, headers?: HeadersInit): RequestInit {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export async function getCurrentProfile(): Promise<Profile> {
  const response = await request<ResourceEnvelope<Profile>>('/platform/me');
  return response.data;
}

export interface DeviceQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  os?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export async function getDevices(query: DeviceQuery): Promise<PagedResponse<DeviceListItem>> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort ?? 'lastSeenAt',
    order: query.order ?? 'desc',
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.os && query.os !== 'all') params.set('os', query.os);
  return request<PagedResponse<DeviceListItem>>('/devices?' + params.toString());
}

export async function getDevice(deviceId: string): Promise<DeviceDetail> {
  const response = await request<ResourceEnvelope<DeviceDetail>>(
    '/devices/' + encodeURIComponent(deviceId),
  );
  return response.data;
}

export interface DeviceGroupQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: string;
}

export async function getDeviceGroups(
  query: DeviceGroupQuery = {},
): Promise<PagedResponse<DeviceGroupListItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.type && query.type !== 'all') params.set('type', query.type);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<PagedResponse<DeviceGroupListItem>>('/devices/groups?' + params.toString());
}

export interface CreateDeviceGroupInput {
  name: string;
  code?: string;
  description?: string;
  organizationId?: string;
  locationId?: string;
}

export async function createDeviceGroup(input: CreateDeviceGroupInput): Promise<DeviceGroupDetail> {
  const response = await request<ResourceEnvelope<DeviceGroupDetail>>('/devices/groups', {
    method: 'POST',
    ...jsonRequest({ ...input, groupType: 'static' }),
  });
  return response.data;
}

export async function getDeviceGroup(groupId: string): Promise<DeviceGroupDetail> {
  const response = await request<ResourceEnvelope<DeviceGroupDetail>>(
    '/devices/groups/' + encodeURIComponent(groupId),
  );
  return response.data;
}

export async function updateDeviceGroup(
  groupId: string,
  eTag: string,
  input: { name?: string; description?: string; status?: string },
): Promise<DeviceGroupDetail> {
  const response = await request<ResourceEnvelope<DeviceGroupDetail>>(
    '/devices/groups/' + encodeURIComponent(groupId),
    {
      method: 'PATCH',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
  return response.data;
}

export async function getDeviceGroupMembers(
  groupId: string,
  query: { page?: number; pageSize?: number; search?: string; status?: string } = {},
): Promise<PagedResponse<DeviceGroupMember>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<PagedResponse<DeviceGroupMember>>(
    '/devices/groups/' + encodeURIComponent(groupId) + '/members?' + params.toString(),
  );
}

export async function createDiscoveryScan(ranges: string[]): Promise<OperationAccepted> {
  return request<OperationAccepted>('/devices/discovery-scans', {
    method: 'POST',
    ...jsonRequest({ ranges }),
  });
}

export async function getDiscoveryScan(scanId: string): Promise<DiscoveryScan> {
  const response = await request<ResourceEnvelope<DiscoveryScan>>(
    '/devices/discovery-scans/' + encodeURIComponent(scanId),
  );
  return response.data;
}

export async function getDiscoveryResults(
  scanId: string,
  query: { page?: number; pageSize?: number; search?: string; status?: string } = {},
): Promise<PagedResponse<DiscoveryResult>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<PagedResponse<DiscoveryResult>>(
    '/devices/discovery-scans/' + encodeURIComponent(scanId) + '/results?' + params.toString(),
  );
}

export async function createAgentInstaller(input: {
  groupId: string;
  operatingSystem: string;
  profile?: string;
  expiresHours?: number;
}): Promise<AgentInstaller> {
  const response = await request<ResourceEnvelope<AgentInstaller>>('/devices/agent-installers', {
    method: 'POST',
    ...jsonRequest(input),
  });
  return response.data;
}
