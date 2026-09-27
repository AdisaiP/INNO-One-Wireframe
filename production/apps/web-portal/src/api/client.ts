import { getAccessToken } from '../auth/keycloak';
import type {
  AgentInstaller,
  AssetCustomFieldDefinition,
  AssetCustomFieldSchema,
  AssetDetail,
  AssetListItem,
  AssetOwnerDetail,
  AssetOwnerSummary,
  AssetOwnershipOverview,
  AssetOverview,
  AssetQrLabel,
  AssetQrResolvedAsset,
  OwnershipDecision,
  OwnershipSubmission,
  AutomationRuleDetail,
  AutomationRuleSummary,
  BusinessCalendar,
  CreatedTicket,
  DeviceDetail,
  DeviceGroupDetail,
  DeviceGroupListItem,
  DeviceGroupMember,
  DeviceListItem,
  DiscoveryResult,
  DiscoveryScan,
  HelpdeskOverview,
  OperationAccepted,
  PagedResponse,
  ProblemDetails,
  Profile,
  ResourceEnvelope,
  SlaEscalationLevel,
  SlaMonitorItem,
  SlaPolicy,
  TicketCategoryNode,
  TicketDetail,
  TicketStatusOption,
  TicketSummary,
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

export interface AssetQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: string;
}

export async function getAssetOverview(): Promise<AssetOverview> {
  const response = await request<ResourceEnvelope<AssetOverview>>('/assets/overview');
  return response.data;
}

export async function getAssets(query: AssetQuery = {}): Promise<PagedResponse<AssetListItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.category && query.category !== 'all') params.set('category', query.category);
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<PagedResponse<AssetListItem>>('/assets?' + params.toString());
}

export async function getAsset(assetId: string): Promise<AssetDetail> {
  const response = await request<ResourceEnvelope<AssetDetail>>(
    '/assets/' + encodeURIComponent(assetId),
  );
  return response.data;
}

export async function updateAsset(
  assetId: string,
  eTag: string,
  input: {
    name?: string;
    category?: string;
    lifecycleStatus?: string;
    linkedDeviceId?: string;
    purchasePrice?: number;
    warrantyEndAt?: string;
    customFields?: Record<string, unknown>;
  },
): Promise<AssetDetail> {
  const response = await request<ResourceEnvelope<AssetDetail>>(
    '/assets/' + encodeURIComponent(assetId),
    {
      method: 'PATCH',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
  return response.data;
}



export async function getAssetCustomFields(): Promise<AssetCustomFieldSchema> {
  const response = await request<ResourceEnvelope<AssetCustomFieldSchema>>(
    '/assets/custom-fields',
  );
  return response.data;
}

export async function updateAssetCustomFields(
  eTag: string,
  fields: Array<Pick<
    AssetCustomFieldDefinition,
    'fieldKey' | 'label' | 'fieldType' | 'isRequired' | 'showInAgent' | 'status' | 'options'
  >>,
): Promise<AssetCustomFieldSchema> {
  const response = await request<ResourceEnvelope<AssetCustomFieldSchema>>(
    '/assets/custom-fields',
    {
      method: 'PUT',
      ...jsonRequest({ fields }, { 'If-Match': eTag }),
    },
  );
  return response.data;
}



export async function createAssetQrLabel(assetId: string): Promise<AssetQrLabel> {
  const response = await request<ResourceEnvelope<AssetQrLabel>>(
    '/assets/' + encodeURIComponent(assetId) + '/qr-label',
    { method: 'POST' },
  );
  return response.data;
}

export async function resolveAssetQr(token: string): Promise<AssetQrResolvedAsset> {
  const response = await request<ResourceEnvelope<AssetQrResolvedAsset>>(
    '/assets/qr/resolve',
    {
      method: 'POST',
      ...jsonRequest({ token }),
    },
  );
  return response.data;
}

export async function getAssetOwnership(): Promise<AssetOwnershipOverview> {
  const response = await request<ResourceEnvelope<AssetOwnershipOverview>>('/assets/ownership');
  return response.data;
}

export async function changeAssetOwnership(
  assetId: string,
  eTag: string,
  input: { ownerUserId?: string; reasonCode?: string; note?: string },
): Promise<{ assetId: string; ownerUserId?: string | null; effectiveAt: string; eTag: string }> {
  const response = await request<ResourceEnvelope<{
    assetId: string;
    ownerUserId?: string | null;
    effectiveAt: string;
    eTag: string;
  }>>('/assets/' + encodeURIComponent(assetId) + '/ownership', {
    method: 'POST',
    ...jsonRequest(input, { 'If-Match': eTag }),
  });
  return response.data;
}

export async function getAssetOwners(
  query: { page?: number; pageSize?: number; search?: string } = {},
): Promise<PagedResponse<AssetOwnerSummary>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  return request<PagedResponse<AssetOwnerSummary>>('/assets/owners?' + params.toString());
}

export async function getAssetOwner(userId: string): Promise<AssetOwnerDetail> {
  const response = await request<ResourceEnvelope<AssetOwnerDetail>>(
    '/assets/owners/' + encodeURIComponent(userId),
  );
  return response.data;
}

export async function getOwnershipSubmissions(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<PagedResponse<OwnershipSubmission>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<PagedResponse<OwnershipSubmission>>(
    '/assets/ownership-submissions?' + params.toString(),
  );
}

export async function decideOwnershipSubmission(
  submissionId: string,
  eTag: string,
  input: { decision: 'confirmed' | 'rejected'; note?: string },
): Promise<OwnershipDecision> {
  const response = await request<ResourceEnvelope<OwnershipDecision>>(
    '/assets/ownership-submissions/' + encodeURIComponent(submissionId) + '/decision',
    {
      method: 'POST',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
  return response.data;
}

export interface TicketQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  assignedToMe?: boolean;
  unassigned?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export async function getHelpdeskOverview(): Promise<HelpdeskOverview> {
  const response = await request<ResourceEnvelope<HelpdeskOverview>>('/helpdesk/overview');
  return response.data;
}

export async function getTickets(
  query: TicketQuery = {},
): Promise<PagedResponse<TicketSummary>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
    sort: query.sort ?? 'updatedAt',
    order: query.order ?? 'desc',
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.priority && query.priority !== 'all') params.set('priority', query.priority);
  if (query.assignedToMe) params.set('assignedToMe', 'true');
  if (query.unassigned) params.set('unassigned', 'true');
  return request<PagedResponse<TicketSummary>>('/helpdesk/tickets?' + params.toString());
}

export async function getTicket(ticketId: string): Promise<TicketDetail> {
  const response = await request<ResourceEnvelope<TicketDetail>>(
    '/helpdesk/tickets/' + encodeURIComponent(ticketId),
  );
  return response.data;
}

export async function createTicket(input: {
  subject: string;
  description: string;
  categoryId?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  relatedDeviceId?: string;
}): Promise<CreatedTicket> {
  const response = await request<ResourceEnvelope<CreatedTicket>>('/helpdesk/tickets', {
    method: 'POST',
    ...jsonRequest(input),
  });
  return response.data;
}

export async function replyToTicket(
  ticketId: string,
  input: { body: string; visibility?: 'public' | 'internal' },
): Promise<void> {
  await request<ResourceEnvelope<unknown>>(
    '/helpdesk/tickets/' + encodeURIComponent(ticketId) + '/replies',
    {
      method: 'POST',
      ...jsonRequest(input),
    },
  );
}

export async function reassignTicket(
  ticketId: string,
  eTag: string,
  input: { assigneeUserId?: string; team?: string; note?: string },
): Promise<void> {
  await request<ResourceEnvelope<unknown>>(
    '/helpdesk/tickets/' + encodeURIComponent(ticketId) + '/assignment',
    {
      method: 'POST',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
}

export async function resolveTicket(
  ticketId: string,
  eTag: string,
  input: { resolutionCode?: string; note?: string },
): Promise<void> {
  await request<ResourceEnvelope<unknown>>(
    '/helpdesk/tickets/' + encodeURIComponent(ticketId) + '/resolve',
    {
      method: 'POST',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
}

export async function getTicketCategories(): Promise<TicketCategoryNode[]> {
  const response = await request<{ items: TicketCategoryNode[] }>('/helpdesk/categories/tree');
  return response.items;
}

export async function getTicketStatuses(): Promise<TicketStatusOption[]> {
  const response = await request<{ items: TicketStatusOption[] }>('/helpdesk/statuses');
  return response.items;
}

export async function getSlaPolicies(): Promise<SlaPolicy[]> {
  const response = await request<{ items: SlaPolicy[] }>('/helpdesk/sla-policies');
  return response.items;
}

export async function updateSlaPolicy(
  policyId: string,
  eTag: string,
  input: {
    responseMinutes: number;
    resolutionMinutes: number;
    businessCalendarId?: string;
    appliesTo?: string;
    pauseOnRequesterWait: boolean;
    notifyRequesterOnStatusChange: boolean;
    reassignOnBreach: boolean;
    escalationLevels: SlaEscalationLevel[];
    isActive: boolean;
  },
): Promise<SlaPolicy> {
  const response = await request<ResourceEnvelope<SlaPolicy>>(
    '/helpdesk/sla-policies/' + encodeURIComponent(policyId),
    {
      method: 'PUT',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
  return response.data;
}

export async function getSlaMonitor(
  query: { page?: number; pageSize?: number; state?: string } = {},
): Promise<PagedResponse<SlaMonitorItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.state && query.state !== 'all') params.set('state', query.state);
  return request<PagedResponse<SlaMonitorItem>>('/helpdesk/sla-monitor?' + params.toString());
}

export async function getBusinessCalendar(): Promise<BusinessCalendar> {
  const response = await request<ResourceEnvelope<BusinessCalendar>>('/helpdesk/business-calendar');
  return response.data;
}

export async function updateBusinessCalendar(
  eTag: string,
  input: {
    name?: string;
    timeZoneId: string;
    workingDays: Array<{
      dayOfWeek: number;
      startMinute: number;
      endMinute: number;
      isWorking: boolean;
    }>;
  },
): Promise<BusinessCalendar> {
  const response = await request<ResourceEnvelope<BusinessCalendar>>(
    '/helpdesk/business-calendar',
    {
      method: 'PUT',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
  return response.data;
}

export interface AutomationRuleQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  type?: string;
}

export interface AutomationRuleInput {
  name: string;
  ruleType: string;
  trigger: string;
  scopeType: string;
  scopeValue?: string;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
  status: string;
  sortOrder?: number;
}

export async function getAutomationRules(
  query: AutomationRuleQuery = {},
): Promise<PagedResponse<AutomationRuleSummary>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.type && query.type !== 'all') params.set('type', query.type);
  return request<PagedResponse<AutomationRuleSummary>>(
    '/helpdesk/automation-rules?' + params.toString(),
  );
}

export async function getAutomationRule(ruleId: string): Promise<AutomationRuleDetail> {
  const response = await request<ResourceEnvelope<AutomationRuleDetail>>(
    '/helpdesk/automation-rules/' + encodeURIComponent(ruleId),
  );
  return response.data;
}

export async function createAutomationRule(
  input: AutomationRuleInput,
): Promise<AutomationRuleDetail> {
  const response = await request<ResourceEnvelope<AutomationRuleDetail>>(
    '/helpdesk/automation-rules',
    {
      method: 'POST',
      ...jsonRequest(input),
    },
  );
  return response.data;
}

export async function updateAutomationRule(
  ruleId: string,
  eTag: string,
  input: AutomationRuleInput,
): Promise<AutomationRuleDetail> {
  const response = await request<ResourceEnvelope<AutomationRuleDetail>>(
    '/helpdesk/automation-rules/' + encodeURIComponent(ruleId),
    {
      method: 'PUT',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
  return response.data;
}
