import { getAccessToken } from '../auth/keycloak';
import type {
  DeviceDetail,
  DeviceListItem,
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
    super(problem?.detail || problem?.title || `Request failed with status ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(apiBaseUrl + path, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
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

  return request<PagedResponse<DeviceListItem>>(`/devices?${params.toString()}`);
}

export async function getDevice(deviceId: string): Promise<DeviceDetail> {
  const response = await request<ResourceEnvelope<DeviceDetail>>(
    `/devices/${encodeURIComponent(deviceId)}`,
  );
  return response.data;
}
