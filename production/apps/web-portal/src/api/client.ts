import { getAccessToken } from '../auth/keycloak';
import type {
  AdminAccessAssignment,
  AdminAccessEvaluation,
  AutomationRunDetail,
  AutomationRunListResponse,
  AdminAuditDetail,
  AdminAuditFacets,
  AdminAuditListItem,
  AdminSecurityResponse,
  AdminPlatformLocalization,
  AdminPlatformSettingsResponse,
  AdminAppModule,
  AdminAppModulesResponse,
  AdminIntegrationStatus,
  AdminIntegrationsResponse,
  AdminHierarchyItem,
  AdminOverview,
  AdminPermission,
  AdminPosition,
  AdminRole,
  AdminUserDetail,
  AdminUserListItem,
  AgentInstaller,
  AppLauncherResponse,
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
  AssetsAutomationRunDetail,
  AssetsAutomationRunListResponse,
  SoftwareLicenseItem,
  SoftwareBaselineItem,
  SoftwareBaselineRequest,
  SoftwareBaselineListResponse,
  SoftwareBaselineResults,
  SoftwareLicenseListResponse,
  AssetContractItem,
  AssetContractListResponse,
  OwnershipDecision,
  OwnershipSubmission,
  BusinessCalendar,
  CreatedTicket,
  DeviceDetail,
  DeviceHardwareInventory,
  DeviceNetworkInventory,
  DevicePerformance,
  DeviceProcessSnapshot,
  DeviceServiceSnapshot,
  DeviceLiveSnapshotAccepted,
  DeviceLiveActionAccepted,
  DeviceSoftwareInventory,
  DeviceGroupDetail,
  DeviceGroupListItem,
  DeviceGroupMember,
  DeviceListItem,
  DiscoveryResult,
  DiscoveryScan,
  GlobalSearchResponse,
  WorkspaceActivityResponse,
  WorkspaceAttentionResponse,
  WorkspaceContinueResponse,
  WorkspaceHomeResponse,
  HelpdeskOverview,
  InventoryQueryDefinition,
  InventoryQueryItem,
  InventoryQueryListResponse,
  InventoryQueryOperationAccepted,
  InventoryQueryResultItem,
  OperationAccepted,
  OperationStatus,
  PlatformNotificationItem,
  PlatformNotificationMarkAllResult,
  PlatformNotificationsResponse,
  PagedResponse,
  ProblemDetails,
  Profile,
  ReportDetail,
  ReportListItem,
  ReportMutationInput,
  ReportRunDetail,
  ReportRunListItem,
  ReportRunStart,
  ReportSchedule,
  ReportScheduleMutationInput,
  ReportSourceDescriptor,
  ResourceEnvelope,
  SlaEscalationLevel,
  SlaMonitorItem,
  SlaPolicy,
  TicketCategoryNode,
  TicketDetail,
  TicketStatusOption,
  TicketSummary,
  WorkflowDefinitionDetail,
  WorkflowDefinitionListResponse,
  WorkflowDefinitionRequest,
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

  if (response.status === 204) return undefined as T;
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

export async function updateCurrentProfile(input: {
  phone?: string;
  office?: string;
  preferredLocale?: 'en-US' | 'th-TH';
  useOrganizationDefault?: boolean;
}): Promise<Profile> {
  const response = await request<ResourceEnvelope<Profile>>('/platform/me/profile', {
    method: 'PATCH',
    ...jsonRequest(input),
  });
  return response.data;
}

export async function getWorkspaceHome(): Promise<WorkspaceHomeResponse> {
  return request<WorkspaceHomeResponse>('/platform/workspace');
}

export async function getWorkspaceContinue(): Promise<WorkspaceContinueResponse> {
  return request<WorkspaceContinueResponse>('/platform/workspace/continue');
}

export async function getWorkspaceAttention(): Promise<WorkspaceAttentionResponse> {
  return request<WorkspaceAttentionResponse>('/platform/workspace/attention');
}

export async function getWorkspaceActivity(limit = 50): Promise<WorkspaceActivityResponse> {
  return request<WorkspaceActivityResponse>('/platform/activity?limit=' + String(limit));
}

export async function getPlatformApps(): Promise<AppLauncherResponse> {
  return request<AppLauncherResponse>('/platform/apps');
}

export async function getGlobalSearch(query: string, limit = 30): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return request<GlobalSearchResponse>('/search?' + params.toString());
}

export async function getPlatformNotifications(query: {
  page?: number;
  pageSize?: number;
  state?: 'all' | 'unread';
} = {}): Promise<PlatformNotificationsResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.state && query.state !== 'all') params.set('state', query.state);
  return request<PlatformNotificationsResponse>('/platform/notifications?' + params.toString());
}

export async function updatePlatformNotification(
  notificationId: string,
  isRead: boolean,
): Promise<PlatformNotificationItem> {
  return request<PlatformNotificationItem>(
    '/platform/notifications/' + encodeURIComponent(notificationId),
    { method: 'PATCH', ...jsonRequest({ isRead }) },
  );
}

export async function markAllPlatformNotificationsRead(): Promise<PlatformNotificationMarkAllResult> {
  return request<PlatformNotificationMarkAllResult>(
    '/platform/notifications/mark-all-read',
    { method: 'POST' },
  );
}

export async function getAdminApps(): Promise<AdminAppModulesResponse> {
  return request<AdminAppModulesResponse>('/admin/apps');
}

export async function getAdminIntegrations(): Promise<AdminIntegrationsResponse> {
  return request<AdminIntegrationsResponse>('/admin/integrations');
}

export async function getAdminAudit(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  action?: string;
  actor?: string;
  targetType?: string;
  classification?: string;
  from?: string;
  to?: string;
} = {}): Promise<PagedResponse<AdminAuditListItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 50),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.module && query.module !== 'all') params.set('module', query.module);
  if (query.action && query.action !== 'all') params.set('action', query.action);
  if (query.actor?.trim()) params.set('actor', query.actor.trim());
  if (query.targetType && query.targetType !== 'all') params.set('targetType', query.targetType);
  if (query.classification && query.classification !== 'all') params.set('classification', query.classification);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  return request<PagedResponse<AdminAuditListItem>>('/admin/audit?' + params.toString());
}

export async function getAdminAuditFacets(): Promise<AdminAuditFacets> {
  return request<AdminAuditFacets>('/admin/audit/facets');
}

export async function getAdminSecurity(): Promise<AdminSecurityResponse> {
  return request<AdminSecurityResponse>('/admin/security');
}

export async function getAdminPlatformSettings(): Promise<AdminPlatformSettingsResponse> {
  return request<AdminPlatformSettingsResponse>('/admin/settings');
}

export async function updateAdminPlatformLocalization(
  defaultLocale: 'en-US' | 'th-TH',
  eTag: string,
): Promise<AdminPlatformLocalization> {
  return request<AdminPlatformLocalization>('/admin/settings/localization', {
    method: 'PATCH',
    ...jsonRequest(
      { defaultLocale },
      { 'If-Match': eTag },
    ),
  });
}

export async function getAdminAuditDetail(auditId: string): Promise<AdminAuditDetail> {
  const response = await request<ResourceEnvelope<AdminAuditDetail>>(
    '/admin/audit/' + encodeURIComponent(auditId),
  );
  return response.data;
}

export async function testAdminIntegration(
  integrationId: string,
): Promise<AdminIntegrationStatus> {
  const response = await request<ResourceEnvelope<AdminIntegrationStatus>>(
    '/admin/integrations/' + encodeURIComponent(integrationId) + '/test',
    { method: 'POST' },
  );
  return response.data;
}

export async function updateAdminApp(
  appId: string,
  eTag: string | null | undefined,
  enabled: boolean,
): Promise<AdminAppModule> {
  const response = await request<ResourceEnvelope<AdminAppModule>>(
    '/admin/apps/' + encodeURIComponent(appId),
    {
      method: 'PATCH',
      ...jsonRequest(
        { enabled },
        eTag ? { 'If-Match': eTag } : undefined,
      ),
    },
  );
  return response.data;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await request<ResourceEnvelope<AdminOverview>>('/admin/overview');
  return response.data;
}

export async function getAdminOrganizationTree(): Promise<AdminHierarchyItem[]> {
  const response = await request<{ items: AdminHierarchyItem[] }>('/admin/organization/tree');
  return response.items;
}

export async function createAdminOrganizationUnit(input: {
  code: string;
  name: string;
  parentId?: string | null;
  status?: string;
}): Promise<AdminHierarchyItem> {
  const response = await request<ResourceEnvelope<AdminHierarchyItem>>(
    '/admin/organization/units',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateAdminOrganizationUnit(
  unitId: string,
  eTag: string,
  input: { code: string; name: string; parentId?: string | null; status?: string },
): Promise<AdminHierarchyItem> {
  const response = await request<ResourceEnvelope<AdminHierarchyItem>>(
    '/admin/organization/units/' + encodeURIComponent(unitId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function getAdminLocations(): Promise<AdminHierarchyItem[]> {
  const response = await request<{ items: AdminHierarchyItem[] }>('/admin/locations/tree');
  return response.items;
}

export async function createAdminLocation(input: {
  code: string;
  name: string;
  parentId?: string | null;
  status?: string;
}): Promise<AdminHierarchyItem> {
  const response = await request<ResourceEnvelope<AdminHierarchyItem>>(
    '/admin/locations',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateAdminLocation(
  locationId: string,
  eTag: string,
  input: { code: string; name: string; parentId?: string | null; status?: string },
): Promise<AdminHierarchyItem> {
  const response = await request<ResourceEnvelope<AdminHierarchyItem>>(
    '/admin/locations/' + encodeURIComponent(locationId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function getAdminPositions(): Promise<AdminPosition[]> {
  const response = await request<{ items: AdminPosition[] }>('/admin/positions');
  return response.items;
}

export async function createAdminPosition(input: {
  code: string;
  name: string;
  status?: string;
}): Promise<AdminPosition> {
  const response = await request<ResourceEnvelope<AdminPosition>>(
    '/admin/positions',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateAdminPosition(
  positionId: string,
  eTag: string,
  input: { code: string; name: string; status?: string },
): Promise<AdminPosition> {
  const response = await request<ResourceEnvelope<AdminPosition>>(
    '/admin/positions/' + encodeURIComponent(positionId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function getAdminUsers(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  organizationId?: string;
} = {}): Promise<PagedResponse<AdminUserListItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.organizationId && query.organizationId !== 'all') {
    params.set('organizationId', query.organizationId);
  }
  return request<PagedResponse<AdminUserListItem>>('/admin/users?' + params.toString());
}

export async function getAdminUser(userId: string): Promise<AdminUserDetail> {
  const response = await request<ResourceEnvelope<AdminUserDetail>>(
    '/admin/users/' + encodeURIComponent(userId),
  );
  return response.data;
}

export async function createAdminUser(input: {
  keycloakSubject: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  office?: string | null;
  organizationId?: string | null;
  positionId?: string | null;
  locationId?: string | null;
  status?: string;
}): Promise<AdminUserDetail> {
  const response = await request<ResourceEnvelope<AdminUserDetail>>(
    '/admin/users',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateAdminUser(
  userId: string,
  eTag: string,
  input: {
    employeeId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    office?: string | null;
    organizationId?: string | null;
    positionId?: string | null;
    locationId?: string | null;
    status?: string;
  },
): Promise<AdminUserDetail> {
  const response = await request<ResourceEnvelope<AdminUserDetail>>(
    '/admin/users/' + encodeURIComponent(userId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const response = await request<{ items: AdminRole[] }>('/admin/roles');
  return response.items;
}

export async function createAdminRole(input: {
  code: string;
  name: string;
  permissions: string[];
  status?: string;
}): Promise<AdminRole> {
  const response = await request<ResourceEnvelope<AdminRole>>(
    '/admin/roles',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateAdminRole(
  roleId: string,
  eTag: string,
  input: {
    name: string;
    permissions: string[];
    status?: string;
  },
): Promise<AdminRole> {
  const response = await request<ResourceEnvelope<AdminRole>>(
    '/admin/roles/' + encodeURIComponent(roleId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function getAdminPermissions(): Promise<AdminPermission[]> {
  const response = await request<{ items: AdminPermission[] }>('/admin/permissions');
  return response.items;
}

export async function getAdminAccessAssignments(): Promise<AdminAccessAssignment[]> {
  const response = await request<{ items: AdminAccessAssignment[] }>('/admin/access-assignments');
  return response.items;
}

export async function getAdminAccessAssignment(assignmentId: string): Promise<AdminAccessAssignment> {
  const response = await request<ResourceEnvelope<AdminAccessAssignment>>(
    '/admin/access-assignments/' + encodeURIComponent(assignmentId),
  );
  return response.data;
}

export async function updateAdminAccessAssignment(
  assignmentId: string,
  eTag: string,
  input: {
    roleId: string;
    scopeType: string;
    resourceIds: string[];
    includeChildren: boolean;
    actionOverrides: string[];
    status?: string;
  },
): Promise<AdminAccessAssignment> {
  const response = await request<ResourceEnvelope<AdminAccessAssignment>>(
    '/admin/access-assignments/' + encodeURIComponent(assignmentId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function evaluateAdminAccess(input: {
  userId: string;
  permission: string;
}): Promise<AdminAccessEvaluation> {
  const response = await request<ResourceEnvelope<AdminAccessEvaluation>>(
    '/admin/access-scopes/evaluate',
    { method: 'POST', ...jsonRequest(input) },
  );
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


export async function getDeviceHardwareInventory(deviceId: string): Promise<DeviceHardwareInventory> {
  const response = await request<ResourceEnvelope<DeviceHardwareInventory>>(
    '/devices/' + encodeURIComponent(deviceId) + '/hardware-inventory',
  );
  return response.data;
}

export async function getDevicePerformance(
  deviceId: string,
  window: '5m' | '15m' | '1h' = '5m',
  interval = 5,
): Promise<DevicePerformance> {
  const response = await request<ResourceEnvelope<DevicePerformance>>(
    '/devices/' + encodeURIComponent(deviceId) + '/performance?window=' + encodeURIComponent(window) + '&interval=' + interval,
  );
  return response.data;
}

export async function getDeviceNetworkInventory(deviceId: string): Promise<DeviceNetworkInventory> {
  const response = await request<ResourceEnvelope<DeviceNetworkInventory>>(
    '/devices/' + encodeURIComponent(deviceId) + '/network-inventory',
  );
  return response.data;
}

export async function createDeviceProcessSnapshot(deviceId: string): Promise<DeviceLiveSnapshotAccepted> {
  return request<DeviceLiveSnapshotAccepted>(
    '/devices/' + encodeURIComponent(deviceId) + '/processes/snapshots',
    { method: 'POST' },
  );
}

export async function getDeviceProcessSnapshot(
  deviceId: string,
  snapshotId: string,
): Promise<DeviceProcessSnapshot> {
  const response = await request<ResourceEnvelope<DeviceProcessSnapshot>>(
    '/devices/' + encodeURIComponent(deviceId)
      + '/processes/snapshots/' + encodeURIComponent(snapshotId),
  );
  return response.data;
}

export async function getLiveDeviceProcesses(deviceId: string): Promise<DeviceProcessSnapshot> {
  const accepted = await createDeviceProcessSnapshot(deviceId);
  return getDeviceProcessSnapshot(deviceId, accepted.snapshotId);
}

export async function terminateDeviceProcess(
  deviceId: string,
  processKey: string,
): Promise<DeviceLiveActionAccepted> {
  return request<DeviceLiveActionAccepted>(
    '/devices/' + encodeURIComponent(deviceId)
      + '/processes/' + encodeURIComponent(processKey) + '/terminate',
    { method: 'POST' },
  );
}

export async function createDeviceServiceSnapshot(deviceId: string): Promise<DeviceLiveSnapshotAccepted> {
  return request<DeviceLiveSnapshotAccepted>(
    '/devices/' + encodeURIComponent(deviceId) + '/services/snapshots',
    { method: 'POST' },
  );
}

export async function getDeviceServiceSnapshot(
  deviceId: string,
  snapshotId: string,
): Promise<DeviceServiceSnapshot> {
  const response = await request<ResourceEnvelope<DeviceServiceSnapshot>>(
    '/devices/' + encodeURIComponent(deviceId)
      + '/services/snapshots/' + encodeURIComponent(snapshotId),
  );
  return response.data;
}

export async function getLiveDeviceServices(deviceId: string): Promise<DeviceServiceSnapshot> {
  const accepted = await createDeviceServiceSnapshot(deviceId);
  return getDeviceServiceSnapshot(deviceId, accepted.snapshotId);
}

export async function executeDeviceServiceAction(
  deviceId: string,
  serviceName: string,
  action: 'start' | 'stop' | 'restart',
): Promise<DeviceLiveActionAccepted> {
  return request<DeviceLiveActionAccepted>(
    '/devices/' + encodeURIComponent(deviceId)
      + '/services/' + encodeURIComponent(serviceName) + '/actions',
    {
      method: 'POST',
      ...jsonRequest({ action }),
    },
  );
}

export async function getDeviceSoftwareInventory(deviceId: string): Promise<DeviceSoftwareInventory> {
  const response = await request<ResourceEnvelope<DeviceSoftwareInventory>>(
    '/devices/' + encodeURIComponent(deviceId) + '/software-inventory',
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

export async function getOperation(operationId: string): Promise<OperationStatus> {
  const response = await request<ResourceEnvelope<OperationStatus>>(
    '/operations/' + encodeURIComponent(operationId),
  );
  return response.data;
}

export async function getInventoryQueries(search = ''): Promise<InventoryQueryListResponse> {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  const suffix = params.size ? '?' + params.toString() : '';
  return request<InventoryQueryListResponse>('/devices/inventory-queries' + suffix);
}

export async function saveInventoryQuery(
  name: string,
  definition: InventoryQueryDefinition,
): Promise<InventoryQueryItem> {
  const response = await request<ResourceEnvelope<InventoryQueryItem>>(
    '/devices/inventory-queries',
    { method: 'POST', ...jsonRequest({ name, ...definition }) },
  );
  return response.data;
}

export async function runInventoryQuery(input: {
  savedQueryId?: string;
  definition?: InventoryQueryDefinition;
}): Promise<InventoryQueryOperationAccepted> {
  const body = input.savedQueryId
    ? { savedQueryId: input.savedQueryId }
    : input.definition ?? {};
  return request<InventoryQueryOperationAccepted>(
    '/devices/inventory-queries/runs',
    { method: 'POST', ...jsonRequest(body) },
  );
}

export async function getInventoryQueryResults(
  runId: string,
  query: { page?: number; pageSize?: number; search?: string } = {},
): Promise<PagedResponse<InventoryQueryResultItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 50),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  return request<PagedResponse<InventoryQueryResultItem>>(
    '/devices/inventory-queries/runs/' + encodeURIComponent(runId)
      + '/results?' + params.toString(),
  );
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



export interface SoftwareLicenseQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  compliance?: string;
  vendor?: string;
}

export async function getSoftwareLicenses(
  query: SoftwareLicenseQuery = {},
): Promise<SoftwareLicenseListResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.compliance && query.compliance !== 'all') params.set('compliance', query.compliance);
  if (query.vendor && query.vendor !== 'all') params.set('vendor', query.vendor);
  return request<SoftwareLicenseListResponse>(
    '/assets/software-licenses?' + params.toString(),
  );
}

export async function getSoftwareLicense(licenseId: string): Promise<SoftwareLicenseItem> {
  const response = await request<ResourceEnvelope<SoftwareLicenseItem>>(
    '/assets/software-licenses/' + encodeURIComponent(licenseId),
  );
  return response.data;
}

export async function updateSoftwareLicense(
  licenseId: string,
  eTag: string,
  input: {
    entitledSeats: number;
    unitPrice?: number | null;
    renewalAt?: string | null;
    contractReference?: string | null;
    licenseModel: string;
  },
): Promise<SoftwareLicenseItem> {
  const response = await request<ResourceEnvelope<SoftwareLicenseItem>>(
    '/assets/software-licenses/' + encodeURIComponent(licenseId),
    {
      method: 'PATCH',
      ...jsonRequest(input, { 'If-Match': eTag }),
    },
  );
  return response.data;
}



export interface AssetContractQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  fiscalYear?: string;
}

export async function getAssetContracts(
  query: AssetContractQuery = {},
): Promise<AssetContractListResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.fiscalYear && query.fiscalYear !== 'all') params.set('fiscalYear', query.fiscalYear);
  return request<AssetContractListResponse>(
    '/assets/contracts?' + params.toString(),
  );
}

export async function getAssetContract(contractId: string): Promise<AssetContractItem> {
  let page = 1;
  while (true) {
    const response = await getAssetContracts({ page, pageSize: 100 });
    const match = response.items.find((item) => item.id === contractId);
    if (match) return match;
    if (page >= response.totalPages) break;
    page += 1;
  }
  throw new ApiError(404, { title: 'Contract not found.' });
}

export async function updateAssetContract(
  contractId: string,
  eTag: string,
  input: {
    fiscalYear: string;
    vendor: string;
    startAt: string;
    endAt: string;
    serviceType: string;
    serviceCondition?: string | null;
    warrantyTerms?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
  },
): Promise<AssetContractItem> {
  const response = await request<ResourceEnvelope<AssetContractItem>>(
    '/assets/contracts/' + encodeURIComponent(contractId),
    {
      method: 'PATCH',
      ...jsonRequest(input, { 'If-Match': eTag }),
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

export async function getSoftwareBaselines(query: { search?: string; status?: string }): Promise<SoftwareBaselineListResponse> {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<SoftwareBaselineListResponse>('/assets/software-baselines?' + params.toString());
}
export async function getSoftwareBaseline(id: string): Promise<SoftwareBaselineItem> {
  const result = await request<ResourceEnvelope<SoftwareBaselineItem>>(
    '/assets/software-baselines/' + encodeURIComponent(id),
  );
  return result.data;
}
export async function createSoftwareBaseline(body: SoftwareBaselineRequest): Promise<SoftwareBaselineItem> {
  const result = await request<ResourceEnvelope<SoftwareBaselineItem>>(
    '/assets/software-baselines', { method: 'POST', ...jsonRequest(body) },
  );
  return result.data;
}
export async function updateSoftwareBaseline(id: string, eTag: string, body: SoftwareBaselineRequest): Promise<SoftwareBaselineItem> {
  const result = await request<ResourceEnvelope<SoftwareBaselineItem>>(
    '/assets/software-baselines/' + encodeURIComponent(id),
    { method: 'PATCH', ...jsonRequest(body, { 'If-Match': eTag }) },
  );
  return result.data;
}


export async function getSoftwareBaselineResults(id: string): Promise<SoftwareBaselineResults> {
  return request<SoftwareBaselineResults>(
    '/assets/software-baselines/' + encodeURIComponent(id) + '/results',
  );
}
export async function evaluateSoftwareBaseline(id: string): Promise<SoftwareBaselineResults> {
  return request<SoftwareBaselineResults>(
    '/assets/software-baselines/' + encodeURIComponent(id) + '/evaluate',
    { method: 'POST' },
  );
}


export async function getAssetsAutomationDefinitions(query: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}): Promise<WorkflowDefinitionListResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  return request<WorkflowDefinitionListResponse>(
    '/assets/automations?' + params.toString(),
  );
}

export async function getAssetsAutomationDefinition(
  automationId: string,
): Promise<WorkflowDefinitionDetail> {
  const response = await request<ResourceEnvelope<WorkflowDefinitionDetail>>(
    '/assets/automations/' + encodeURIComponent(automationId),
  );
  return response.data;
}

export async function createAssetsAutomationDefinition(
  input: WorkflowDefinitionRequest,
): Promise<WorkflowDefinitionDetail> {
  const response = await request<ResourceEnvelope<WorkflowDefinitionDetail>>(
    '/assets/automations',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateAssetsAutomationDefinition(
  automationId: string,
  eTag: string,
  input: WorkflowDefinitionRequest,
): Promise<WorkflowDefinitionDetail> {
  const response = await request<ResourceEnvelope<WorkflowDefinitionDetail>>(
    '/assets/automations/' + encodeURIComponent(automationId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function deleteAssetsAutomationDefinition(
  automationId: string,
  eTag: string,
): Promise<void> {
  await request<void>(
    '/assets/automations/' + encodeURIComponent(automationId),
    { method: 'DELETE', headers: { 'If-Match': eTag } },
  );
}

export async function getAssetsAutomationVersions(
  automationId: string,
): Promise<{ items: Array<{
  version: number;
  ownerModule: string;
  name: string;
  status: string;
  changedByUserId: string;
  createdAt: string;
}> }> {
  return request(
    '/assets/automations/' + encodeURIComponent(automationId) + '/versions',
  );
}

export async function getAssetsAutomationRuns(
  automationId: string,
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<AssetsAutomationRunListResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<AssetsAutomationRunListResponse>(
    '/assets/automations/' + encodeURIComponent(automationId) + '/runs?' + params.toString(),
  );
}

export async function getAssetsAutomationRun(
  automationId: string,
  runId: string,
): Promise<AssetsAutomationRunDetail> {
  const response = await request<ResourceEnvelope<AssetsAutomationRunDetail>>(
    '/assets/automations/' + encodeURIComponent(automationId)
      + '/runs/' + encodeURIComponent(runId),
  );
  return response.data;
}

export async function startAssetsAutomationRun(
  automationId: string,
  input: { assetId?: string; licenseId?: string },
): Promise<AssetsAutomationRunDetail> {
  const response = await request<ResourceEnvelope<AssetsAutomationRunDetail>>(
    '/assets/automations/' + encodeURIComponent(automationId) + '/runs',
    { method: 'POST', ...jsonRequest({ input }) },
  );
  return response.data;
}

export async function getHelpdeskAutomationDefinitions(query: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}): Promise<WorkflowDefinitionListResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  return request<WorkflowDefinitionListResponse>(
    '/helpdesk/automations?' + params.toString(),
  );
}

export async function getHelpdeskAutomationRuns(
  automationId: string,
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<AutomationRunListResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.status && query.status !== 'all') params.set('status', query.status);
  return request<AutomationRunListResponse>(
    '/helpdesk/automations/' + encodeURIComponent(automationId) + '/runs?' + params.toString(),
  );
}

export async function getHelpdeskAutomationRun(
  automationId: string,
  runId: string,
): Promise<AutomationRunDetail> {
  const response = await request<ResourceEnvelope<AutomationRunDetail>>(
    '/helpdesk/automations/' + encodeURIComponent(automationId)
      + '/runs/' + encodeURIComponent(runId),
  );
  return response.data;
}

export async function startHelpdeskAutomationRun(
  automationId: string,
  input: { ticketId: string },
): Promise<AutomationRunDetail> {
  const response = await request<ResourceEnvelope<AutomationRunDetail>>(
    '/helpdesk/automations/' + encodeURIComponent(automationId) + '/runs',
    { method: 'POST', ...jsonRequest({ input }) },
  );
  return response.data;
}

export async function getHelpdeskAutomationDefinition(
  automationId: string,
): Promise<WorkflowDefinitionDetail> {
  const response = await request<ResourceEnvelope<WorkflowDefinitionDetail>>(
    '/helpdesk/automations/' + encodeURIComponent(automationId),
  );
  return response.data;
}

export async function createHelpdeskAutomationDefinition(
  input: WorkflowDefinitionRequest,
): Promise<WorkflowDefinitionDetail> {
  const response = await request<ResourceEnvelope<WorkflowDefinitionDetail>>(
    '/helpdesk/automations',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateHelpdeskAutomationDefinition(
  automationId: string,
  eTag: string,
  input: WorkflowDefinitionRequest,
): Promise<WorkflowDefinitionDetail> {
  const response = await request<ResourceEnvelope<WorkflowDefinitionDetail>>(
    '/helpdesk/automations/' + encodeURIComponent(automationId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function deleteHelpdeskAutomationDefinition(
  automationId: string,
  eTag: string,
): Promise<void> {
  await request<void>(
    '/helpdesk/automations/' + encodeURIComponent(automationId),
    { method: 'DELETE', headers: { 'If-Match': eTag } },
  );
}

export async function getHelpdeskAutomationVersions(
  automationId: string,
): Promise<{ items: Array<{
  version: number;
  ownerModule: string;
  name: string;
  status: string;
  changedByUserId: string;
  createdAt: string;
}> }> {
  return request(
    '/helpdesk/automations/' + encodeURIComponent(automationId) + '/versions',
  );
}

export async function getReportSources(): Promise<ReportSourceDescriptor[]> {
  const response = await request<{ items: ReportSourceDescriptor[] }>('/reports/sources');
  return response.items;
}

export async function getReports(query: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}): Promise<PagedResponse<ReportListItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  if (query.search?.trim()) params.set('search', query.search.trim());
  return request<PagedResponse<ReportListItem>>('/reports?' + params.toString());
}

export async function getReport(reportId: string): Promise<ReportDetail> {
  const response = await request<ResourceEnvelope<ReportDetail>>(
    '/reports/' + encodeURIComponent(reportId),
  );
  return response.data;
}

export async function createReport(input: ReportMutationInput): Promise<ReportDetail> {
  const response = await request<ResourceEnvelope<ReportDetail>>(
    '/reports',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateReport(
  reportId: string,
  eTag: string,
  input: ReportMutationInput,
): Promise<ReportDetail> {
  const response = await request<ResourceEnvelope<ReportDetail>>(
    '/reports/' + encodeURIComponent(reportId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function deleteReport(reportId: string, eTag: string): Promise<void> {
  await request<void>(
    '/reports/' + encodeURIComponent(reportId),
    { method: 'DELETE', headers: { 'If-Match': eTag } },
  );
}

export async function startReportRun(reportId: string): Promise<ReportRunStart> {
  const response = await request<ResourceEnvelope<ReportRunStart>>(
    '/reports/' + encodeURIComponent(reportId) + '/runs',
    { method: 'POST' },
  );
  return response.data;
}

export async function getReportRuns(
  reportId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<PagedResponse<ReportRunListItem>> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  });
  return request<PagedResponse<ReportRunListItem>>(
    '/reports/' + encodeURIComponent(reportId) + '/runs?' + params.toString(),
  );
}

export async function getReportRun(
  reportId: string,
  runId: string,
): Promise<ReportRunDetail> {
  const response = await request<ResourceEnvelope<ReportRunDetail>>(
    '/reports/' + encodeURIComponent(reportId)
      + '/runs/' + encodeURIComponent(runId),
  );
  return response.data;
}

export async function downloadReportRun(
  reportId: string,
  runId: string,
  fallbackName = 'report.csv',
): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(
    apiBaseUrl + '/reports/' + encodeURIComponent(reportId)
      + '/runs/' + encodeURIComponent(runId) + '/download',
    {
      headers: {
        Authorization: 'Bearer ' + token,
      },
    },
  );
  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = undefined;
    }
    throw new ApiError(response.status, problem);
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const fileName = match?.[1] ? decodeURIComponent(match[1].replace(/"/g, '')) : fallbackName;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function getReportSchedules(): Promise<ReportSchedule[]> {
  const response = await request<{ items: ReportSchedule[] }>('/reports/schedules');
  return response.items;
}

export async function createReportSchedule(
  input: ReportScheduleMutationInput,
): Promise<ReportSchedule> {
  const response = await request<ResourceEnvelope<ReportSchedule>>(
    '/reports/schedules',
    { method: 'POST', ...jsonRequest(input) },
  );
  return response.data;
}

export async function updateReportSchedule(
  scheduleId: string,
  eTag: string,
  input: ReportScheduleMutationInput,
): Promise<ReportSchedule> {
  const response = await request<ResourceEnvelope<ReportSchedule>>(
    '/reports/schedules/' + encodeURIComponent(scheduleId),
    { method: 'PUT', ...jsonRequest(input, { 'If-Match': eTag }) },
  );
  return response.data;
}

export async function deleteReportSchedule(
  scheduleId: string,
  eTag: string,
): Promise<void> {
  await request<void>(
    '/reports/schedules/' + encodeURIComponent(scheduleId),
    { method: 'DELETE', headers: { 'If-Match': eTag } },
  );
}
