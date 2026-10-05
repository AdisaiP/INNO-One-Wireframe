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
  locale: 'en-US' | 'th-TH';
  preferredLocale?: 'en-US' | 'th-TH' | null;
  organizationDefaultLocale: 'en-US' | 'th-TH';
  supportedLocales: Array<'en-US' | 'th-TH'>;
}

export interface AppNavigationItem {
  id: string;
  label: string;
  route: string;
}

export interface AppLauncherItem {
  id: string;
  name: string;
  icon: string;
  route: string;
  navigation: AppNavigationItem[];
}

export interface AppLauncherResponse {
  items: AppLauncherItem[];
}

export interface AdminAppModule {
  id: string;
  name: string;
  icon: string;
  route: string;
  entryPermission: string;
  status: 'enabled' | 'disabled' | 'not-installed';
  installed: boolean;
  enabled: boolean;
  dependenciesAvailable: boolean;
  dependencies: string[];
  permissions: string[];
  events: string[];
  capabilities: string[];
  updatedAt?: string | null;
  eTag?: string | null;
}

export interface AdminAppModulesResponse {
  schemaVersion: number;
  items: AdminAppModule[];
}

export interface AdminIntegrationStatus {
  id: string;
  name: string;
  category: string;
  provider: string;
  ownerModule: string;
  endpoint: string;
  status: 'connected' | 'degraded' | 'disabled' | 'not-configured';
  enabled: boolean;
  configured: boolean;
  canTest: boolean;
  checkedAt: string;
  durationMs: number;
  message: string;
  capabilities: string[];
}

export interface AdminIntegrationsResponse {
  items: AdminIntegrationStatus[];
}

export interface AdminAuditListItem {
  auditId: string;
  occurredAt: string;
  action: string;
  module: string;
  targetType: string;
  targetId: string;
  actorType: string;
  actorId: string;
  actorName?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  classification: string;
}

export interface AdminAuditDetail extends AdminAuditListItem {
  metadata: unknown;
}

export interface AdminAuditFacets {
  modules: string[];
  actions: string[];
  targetTypes: string[];
  classifications: string[];
}

export type AdminSecurityStatus =
  | 'healthy'
  | 'attention'
  | 'unavailable'
  | 'informational';

export interface AdminSecurityControl {
  id: string;
  name: string;
  status: AdminSecurityStatus;
  value: string;
  detail: string;
}

export interface AdminSecurityPostureItem {
  id: string;
  name: string;
  category: string;
  ownerModule: string;
  status: AdminSecurityStatus;
  checkedAt: string;
  durationMs: number;
  message: string;
  controls: AdminSecurityControl[];
}

export interface AdminSecurityResponse {
  configurationMode: string;
  mutablePolicies: boolean;
  checkedAt: string;
  summary: {
    providers: number;
    healthy: number;
    attention: number;
    unavailable: number;
    informational: number;
  };
  items: AdminSecurityPostureItem[];
}

export interface AdminPlatformSetting {
  id: string;
  group: string;
  name: string;
  value: string;
  source: string;
  status: 'frozen' | 'effective';
  detail: string;
}

export interface AdminPlatformLocalization {
  defaultLocale: 'en-US' | 'th-TH';
  supportedLocales: Array<'en-US' | 'th-TH'>;
  eTag: string;
  updatedAt: string;
}

export interface AdminPlatformSettingsResponse {
  configurationMode: string;
  mutableSettings: boolean;
  environment: string;
  checkedAt: string;
  groups: string[];
  localization: AdminPlatformLocalization;
  items: AdminPlatformSetting[];
}

export interface AdminOverview {
  organizations: number;
  locations: number;
  positions: number;
  users: number;
  roles: number;
  accessAssignments: number;
}

export interface AdminHierarchyItem {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  status: string;
  eTag: string;
}

export interface AdminPosition {
  id: string;
  code: string;
  name: string;
  status: string;
  eTag: string;
}

export interface AdminUserListItem {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  organization?: ReferenceValue | null;
  position?: ReferenceValue | null;
  location?: ReferenceValue | null;
  status: string;
  eTag: string;
}

export interface AdminUserAssignmentSummary {
  id: string;
  roleId: string;
  roleName: string;
  scopeType: string;
  status: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  keycloakSubject: string;
  phone?: string | null;
  office?: string | null;
  assignments: AdminUserAssignmentSummary[];
}

export interface AdminRole {
  id: string;
  code: string;
  name: string;
  status: string;
  permissions: string[];
  eTag: string;
}

export interface AdminPermission {
  id: string;
  module: string;
  name: string;
}

export interface AdminScopeResource {
  type: string;
  id: string;
}

export interface AdminAccessAssignment {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectName: string;
  roleId: string;
  roleName: string;
  scopeType: string;
  resources: AdminScopeResource[];
  includeChildren: boolean;
  actionOverrides: string[];
  status: string;
  eTag: string;
}

export interface AdminAccessEvaluation {
  userId: string;
  permission: string;
  allowed: boolean;
  reason: string;
  allResources: boolean;
  organizationIds: string[];
  locationIds: string[];
  deviceGroupIds: string[];
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


export interface DeviceHardwareInventory {
  deviceId: string;
  inventoryStatus: 'not_reported' | 'complete' | 'partial';
  snapshotId?: string | null;
  observedAt?: string | null;
  receivedAt?: string | null;
  source?: string | null;
  sourceInstance?: string | null;
  isStale: boolean;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  processor?: string | null;
  biosVersion?: string | null;
  operatingSystem?: string | null;
  memoryTotalGb?: number | null;
  memorySlotsUsed?: number | null;
  memorySlotsTotal?: number | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  lastSeenAt?: string | null;
  connectivityState?: string | null;
}

export interface DevicePerformancePoint {
  observedAt: string;
  cpuPercent?: number | null;
  memoryUsedGb?: number | null;
  memoryTotalGb?: number | null;
  diskUsedGb?: number | null;
  diskTotalGb?: number | null;
  source: string;
}

export interface DevicePerformance {
  deviceId: string;
  status: 'no_data' | 'live' | 'stale';
  isLive: boolean;
  isStale: boolean;
  latestObservedAt?: string | null;
  latestReceivedAt?: string | null;
  source?: string | null;
  windowSeconds: number;
  intervalSeconds: number;
  cpuPercent?: number | null;
  memoryUsedGb?: number | null;
  memoryTotalGb?: number | null;
  diskUsedGb?: number | null;
  diskTotalGb?: number | null;
  points: DevicePerformancePoint[];
}

export interface DeviceNetworkInventory {
  deviceId: string;
  inventoryStatus: 'not_reported' | 'reported';
  snapshotId?: string | null;
  observedAt?: string | null;
  receivedAt?: string | null;
  source?: string | null;
  sourceInstance?: string | null;
  isStale: boolean;
  connectivityState: string;
  ipAddress?: string | null;
  macAddress?: string | null;
  subnetMask?: string | null;
  gateway?: string | null;
  dnsServers: string[];
  adapterName?: string | null;
  agentLatencyMs?: number | null;
  packetLossPercent?: number | null;
}

export interface DeviceSoftwarePackage {
  productKey: string;
  displayName: string;
  version?: string | null;
  publisher?: string | null;
  architecture?: string | null;
}

export interface DeviceSoftwareInventory {
  deviceId: string;
  inventoryStatus: 'not_reported' | 'complete' | 'partial';
  snapshotId?: string | null;
  observedAt?: string | null;
  receivedAt?: string | null;
  source?: string | null;
  sourceInstance?: string | null;
  packageCount: number;
  packages: DeviceSoftwarePackage[];
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

export type OperationState = 'queued' | 'running' | 'succeeded' | 'failed' | 'partial';

export interface OperationAccepted {
  operationId: string;
  status: OperationState;
  statusUrl: string;
  progress: number;
  resource: {
    scanId: string;
    addressCount: number;
  };
}

export interface OperationStatus {
  operationId: string;
  operationType: string;
  originModule: string;
  status: OperationState;
  progress: number;
  errorCode?: string | null;
  statusUrl: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
}

export interface InventoryQueryDefinition {
  factType: 'software';
  field: 'name' | 'version' | 'publisher';
  operator: 'contains' | 'equals' | 'version_less_than';
  value: string;
  scopeType: 'all' | 'group';
  scopeId?: string | null;
}

export interface InventoryQueryItem {
  id: string;
  name: string;
  definition: InventoryQueryDefinition;
  lastMatchCount?: number | null;
  lastRunAt?: string | null;
  updatedAt: string;
}

export interface InventoryQueryListResponse {
  items: InventoryQueryItem[];
  totalItems: number;
}

export interface InventoryQueryOperationAccepted {
  operationId: string;
  status: OperationState;
  statusUrl: string;
  progress: number;
  resource: {
    runId: string;
    savedQueryId?: string | null;
  };
}

export interface InventoryQueryResultItem {
  id: string;
  deviceId: string;
  deviceName: string;
  user?: string | null;
  ipAddress?: string | null;
  factType: string;
  factName: string;
  factVersion?: string | null;
  factPublisher?: string | null;
  matchedValue: string;
  observedAt: string;
  lastSeenAt?: string | null;
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


export interface HelpdeskOverview {
  openTickets: number;
  assignedToMe: number;
  unassigned: number;
  dueToday: number;
  slaAtRisk: number;
  slaBreached: number;
  priorityTickets: TicketSummary[];
  myTickets: TicketSummary[];
}

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  statusName: string;
  priority: string;
  organization?: string | null;
  requester: string;
  assignee?: string | null;
  team?: string | null;
  category?: string | null;
  slaState?: string | null;
  resolutionDueAt?: string | null;
  slaElapsedPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  authorUserId: string;
  authorName: string;
  body: string;
  visibility: string;
  isRequester: boolean;
  createdAt: string;
}

export interface TicketActivity {
  id: string;
  type: string;
  title: string;
  detail?: string | null;
  occurredAt: string;
}

export interface TicketSla {
  policyId: string;
  policyName: string;
  responseMinutes: number;
  resolutionMinutes: number;
  responseDueAt: string;
  resolutionDueAt: string;
  responseMetAt?: string | null;
  state: string;
  elapsedPercent: number;
}

export interface TicketDeviceReference {
  id: string;
  name: string;
  status: string;
  operatingSystem?: string | null;
}

export interface TicketCategoryReference {
  id: string;
  code: string;
  name: string;
}

export interface TicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  statusName: string;
  priority: string;
  impact: string;
  urgency: string;
  requester: ReferenceValue;
  organization?: ReferenceValue | null;
  assignee?: ReferenceValue | null;
  team?: string | null;
  category?: TicketCategoryReference | null;
  relatedDevice?: TicketDeviceReference | null;
  relatedAssetId?: string | null;
  messages: TicketMessage[];
  activities: TicketActivity[];
  sla?: TicketSla | null;
  assigneeOptions: ReferenceValue[];
  resolvedAt?: string | null;
  resolutionCode?: string | null;
  createdAt: string;
  updatedAt: string;
  eTag: string;
}

export interface TicketCategoryNode {
  id: string;
  code: string;
  name: string;
  children: TicketCategoryNode[];
}

export interface TicketStatusOption {
  id: string;
  code: string;
  name: string;
  isClosed: boolean;
}

export interface CreatedTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  responseDueAt: string;
  resolutionDueAt: string;
  eTag: string;
}


export interface SlaEscalationLevel {
  level: number;
  percent: number;
  targetType: string;
  targetId: string;
  reassignTeam?: string | null;
}

export interface SlaPolicy {
  id: string;
  code: string;
  name: string;
  priority: string;
  responseMinutes: number;
  resolutionMinutes: number;
  businessCalendar?: {
    id: string;
    name: string;
    timeZoneId: string;
  } | null;
  appliesTo?: string | null;
  pauseOnRequesterWait: boolean;
  notifyRequesterOnStatusChange: boolean;
  reassignOnBreach: boolean;
  escalationLevels: SlaEscalationLevel[];
  isActive: boolean;
  eTag: string;
}

export interface SlaMonitorItem {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  status: string;
  state: string;
  elapsedPercent: number;
  escalationLevel: number;
  responseDueAt: string;
  resolutionDueAt: string;
  pausedAt?: string | null;
  policyId: string;
  policyName: string;
}

export interface BusinessWorkingDay {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  isWorking: boolean;
}

export interface BusinessHoliday {
  date: string;
  name: string;
  isWorking: boolean;
}

export interface BusinessCalendar {
  id: string;
  code: string;
  name: string;
  timeZoneId: string;
  workingDays: BusinessWorkingDay[];
  holidays: BusinessHoliday[];
  eTag: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code?: string;
  errors?: Record<string, string[]>;
  fieldErrors?: Record<string, string[]>;
}


export interface AssetOverviewRecent {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: string;
  updatedAt: string;
}

export interface AssetOverview {
  totalAssets: number;
  inUse: number;
  inStock: number;
  repair: number;
  unassigned: number;
  warrantyExpiring: number;
  recentAssets: AssetOverviewRecent[];
}

export interface AssetListItem {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  brandModel: string;
  serialNumber?: string | null;
  owner?: string | null;
  organization?: string | null;
  location?: string | null;
  status: string;
  registeredAt: string;
  updatedAt: string;
}

export interface AssetLinkedDevice {
  id: string;
  name: string;
  status: string;
  operatingSystem?: string | null;
}

export interface AssetOwnershipHistoryItem {
  id: string;
  previousOwner?: string | null;
  owner?: string | null;
  reasonCode: string;
  note?: string | null;
  effectiveAt: string;
}

export interface AssetCustomFieldValue {
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select';
  isRequired: boolean;
  showInAgent: boolean;
  options: string[];
  value: unknown;
}

export interface AssetCustomFieldDefinition {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select';
  isRequired: boolean;
  showInAgent: boolean;
  status: 'active' | 'draft';
  options: string[];
  displayOrder: number;
  updatedAt: string;
}

export interface AssetCustomFieldSchema {
  fields: AssetCustomFieldDefinition[];
  eTag: string;
}

export interface AssetDetail {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status: string;
  owner?: ReferenceValue | null;
  organization?: ReferenceValue | null;
  location?: ReferenceValue | null;
  linkedDevice?: AssetLinkedDevice | null;
  purchasePrice?: number | null;
  registeredAt: string;
  warrantyEndAt?: string | null;
  source: string;
  ownershipHistory: AssetOwnershipHistoryItem[];
  customFields: AssetCustomFieldValue[];
  updatedAt: string;
  eTag: string;
}

export interface AssetQrLabel {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  brandModel: string;
  serialNumber?: string | null;
  qrValue: string;
  generatedAt: string;
  expiresAt?: string | null;
  replacedPrevious: boolean;
}

export interface AssetQrResolvedCustomField {
  fieldKey: string;
  label: string;
  fieldType: string;
  value: unknown;
}

export interface AssetQrResolvedAsset {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status: string;
  owner?: ReferenceValue | null;
  organization?: ReferenceValue | null;
  location?: ReferenceValue | null;
  linkedDevice?: AssetLinkedDevice | null;
  warrantyEndAt?: string | null;
  customFields: AssetQrResolvedCustomField[];
  scannedAt: string;
  updatedAt: string;
}

export interface SoftwareLicenseAllocation {
  id: string;
  assetId?: string | null;
  endpointName: string;
  assignedTo?: string | null;
  seatCount: number;
  lastUsedAt?: string | null;
  status: string;
  source: string;
}

export interface SoftwareLicenseItem {
  id: string;
  productName: string;
  vendor: string;
  licenseModel: string;
  entitledSeats: number;
  usedSeats: number;
  compliance: 'compliant' | 'overused';
  seatBalance: number;
  unitPrice?: number | null;
  currency: string;
  estimatedGapCost: number;
  renewalAt?: string | null;
  contractReference?: string | null;
  allocations: SoftwareLicenseAllocation[];
  updatedAt: string;
  eTag: string;
}

export interface SoftwareLicenseSummary {
  products: number;
  purchasedSeats: number;
  installedSeats: number;
  overusedProducts: number;
  estimatedGapCost: number;
}

export interface SoftwareLicenseListResponse {
  items: SoftwareLicenseItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: SoftwareLicenseSummary;
  vendors: string[];
}

export interface CoveredAssetContractItem {
  id: string;
  assetTag: string;
  name: string;
  brandModel: string;
  owner?: string | null;
  coverageStatus: string;
}

export interface AssetContractItem {
  id: string;
  contractNumber: string;
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
  status: 'active' | 'expiring' | 'expired';
  daysRemaining: number;
  coveredAssets: CoveredAssetContractItem[];
  updatedAt: string;
  eTag: string;
}

export interface AssetContractSummary {
  activeContracts: number;
  expiringWithin90Days: number;
  coveredAssets: number;
  uncoveredAssets: number;
}

export interface AssetContractListResponse {
  items: AssetContractItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: AssetContractSummary;
  fiscalYears: string[];
}

export interface AssetOwnershipChange {
  assetId: string;
  assetTag: string;
  previousOwner?: string | null;
  owner?: string | null;
  reasonCode: string;
  effectiveAt: string;
}

export interface AssetOwnershipOverview {
  assignedAssets: number;
  confirmedOwnership: number;
  pendingSubmissions: number;
  unassignedAssets: number;
  recentChanges: AssetOwnershipChange[];
}

export interface AssetOwnerSummary {
  id: string;
  fullName: string;
  employeeId: string;
  email: string;
  organization?: string | null;
  assetCount: number;
  lastOwnershipAt?: string | null;
}

export interface AssetOwnerAsset {
  id: string;
  assetTag: string;
  name: string;
  brandModel: string;
  status: string;
  assignedAt: string;
}

export interface AssetOwnerDetail {
  id: string;
  fullName: string;
  employeeId: string;
  email: string;
  organization?: string | null;
  location?: string | null;
  assets: AssetOwnerAsset[];
}

export interface OwnershipSubmission {
  id: string;
  assetId: string;
  assetTag: string;
  userId: string;
  userName: string;
  deviceName: string;
  possession: string;
  submittedLocation?: string | null;
  changes: string[];
  status: string;
  submittedAt: string;
  eTag: string;
}

export interface OwnershipDecision {
  id: string;
  status: string;
  reviewedAt?: string | null;
  eTag: string;
}


export interface SoftwareBaselineItem {
  id: string;
  code: string;
  name: string;
  targetCategory: string | null;
  requiredPackages: string[];
  status: 'draft' | 'active' | 'inactive';
  evaluationStatus: 'not_evaluated' | 'current' | 'stale';
  updatedAt: string;
  eTag: string;
}
export type SoftwareBaselineRequest = Pick<SoftwareBaselineItem,
  'code' | 'name' | 'targetCategory' | 'requiredPackages' | 'status'>;
export interface SoftwareBaselineListResponse {
  items: SoftwareBaselineItem[];
  totalItems: number;
}


export interface SoftwareBaselineResultItem {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  category: string;
  status: 'compliant' | 'missing' | 'unknown';
  reasonCode: string;
  missingPackages: string[];
  inventorySnapshotId?: string | null;
  inventoryObservedAt?: string | null;
  evaluatedAt: string;
}
export interface SoftwareBaselineResults {
  baselineId: string;
  baselineName: string;
  baselineVersion: number;
  compliantCount: number;
  missingCount: number;
  unknownCount: number;
  evaluatedAt?: string | null;
  items: SoftwareBaselineResultItem[];
}

export interface PlatformNotificationItem {
  id: string;
  sourceModule: string;
  notificationType: string;
  title: string;
  message: string;
  contentLocale: 'en-US' | 'th-TH';
  destinationPath: string;
  isImportant: boolean;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface PlatformNotificationsResponse {
  items: PlatformNotificationItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  unreadCount: number;
  importantCount: number;
  allCount: number;
}

export interface PlatformNotificationMarkAllResult {
  updatedCount: number;
  readAt: string;
}

export interface GlobalSearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export interface GlobalSearchResponse {
  query: string;
  items: GlobalSearchResult[];
  totalItems: number;
  providerCount: number;
}

export interface WorkspaceAppItem {
  id: string;
  name: string;
  icon: string;
  route: string;
}

export interface WorkspaceActivityItem {
  sourceModule: string;
  resourceType: string;
  resourceId: string;
  title: string;
  activity: string;
  destinationPath: string;
  occurredAt: string;
}

export interface WorkspaceAttentionItem {
  id: string;
  module: string;
  title: string;
  detail: string;
  count: number;
  severity: 'neutral' | 'info' | 'warning' | 'danger';
  route: string;
}

export interface WorkspaceHomeResponse {
  fullName: string;
  apps: WorkspaceAppItem[];
  continueItems: WorkspaceActivityItem[];
  attentionItems: WorkspaceAttentionItem[];
  recentItems: WorkspaceActivityItem[];
  attentionTotal: number;
  partialFailures: string[];
  generatedAt: string;
}

export interface WorkspaceContinueResponse {
  items: WorkspaceActivityItem[];
}

export interface WorkspaceAttentionResponse {
  items: WorkspaceAttentionItem[];
  totalCount: number;
  partialFailures: string[];
}

export interface WorkspaceActivityResponse {
  items: WorkspaceActivityItem[];
}


export interface WorkflowDefinitionItem {
  id: string;
  ownerModule: string;
  name: string;
  status: 'draft';
  version: number;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
  eTag: string;
}

export interface WorkflowDefinitionDetail {
  id: string;
  ownerModule: string;
  name: string;
  nodes: import('@inno/ui/workflow').INNOWorkflowNode[];
  edges: import('@inno/ui/workflow').INNOWorkflowEdge[];
  orientation: 'horizontal' | 'vertical';
  status: 'draft';
  version: number;
  createdAt: string;
  updatedAt: string;
  eTag: string;
}

export interface WorkflowDefinitionRequest {
  name: string;
  nodes: import('@inno/ui/workflow').INNOWorkflowNode[];
  edges: import('@inno/ui/workflow').INNOWorkflowEdge[];
  orientation: 'horizontal' | 'vertical';
}

export interface WorkflowDefinitionListResponse {
  items: WorkflowDefinitionItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AutomationRunSummary {
  id: string;
  workflowId: string;
  workflowVersion: number;
  workflowName: string;
  status: AutomationRunStatus;
  ticketId?: string | null;
  attemptCount: number;
  maxAttempts: number;
  errorCode?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AutomationRunStep {
  id: string;
  nodeId: string;
  nodeKind: import('@inno/ui/workflow').INNOWorkflowNodeKind;
  catalogKey: string;
  status: string;
  attempt: number;
  output?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AutomationRunDetail extends AutomationRunSummary {
  ownerModule: string;
  input: Record<string, unknown>;
  definitionSnapshot: {
    schemaVersion: number;
    workflowId: string;
    workflowVersion: number;
    ownerModule: string;
    name: string;
    nodes: import('@inno/ui/workflow').INNOWorkflowNode[];
    edges: import('@inno/ui/workflow').INNOWorkflowEdge[];
    orientation: 'horizontal' | 'vertical';
    status: string;
  };
  activeNodeIds: string[];
  completedNodeIds: string[];
  failedNodeId?: string | null;
  errorDetail?: string | null;
  steps: AutomationRunStep[];
}

export interface AutomationRunListResponse {
  items: AutomationRunSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AssetsAutomationRunSummary {
  id: string;
  workflowId: string;
  workflowVersion: number;
  workflowName: string;
  status: AutomationRunStatus;
  resourceType?: 'asset' | 'license' | null;
  resourceId?: string | null;
  attemptCount: number;
  maxAttempts: number;
  errorCode?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AssetsAutomationRunDetail extends AssetsAutomationRunSummary {
  ownerModule: string;
  input: Record<string, unknown>;
  definitionSnapshot: {
    schemaVersion: number;
    workflowId: string;
    workflowVersion: number;
    ownerModule: string;
    name: string;
    nodes: import('@inno/ui/workflow').INNOWorkflowNode[];
    edges: import('@inno/ui/workflow').INNOWorkflowEdge[];
    orientation: 'horizontal' | 'vertical';
    status: string;
  };
  activeNodeIds: string[];
  completedNodeIds: string[];
  failedNodeId?: string | null;
  errorDetail?: string | null;
  steps: AutomationRunStep[];
}

export interface AssetsAutomationRunListResponse {
  items: AssetsAutomationRunSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ReportSourceColumn {
  key: string;
  label: string;
  dataType: string;
}

export interface ReportSourceDescriptor {
  key: string;
  name: string;
  requiredPermission: string;
  columns: ReportSourceColumn[];
  filterFields: string[];
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
}

export interface ReportListItem {
  id: string;
  name: string;
  description?: string | null;
  sourceKey: string;
  outputFormat: string;
  status: string;
  version: number;
  updatedAt: string;
}

export interface ReportDetail extends ReportListItem {
  sourceName: string;
  columns: string[];
  filters: ReportFilter[];
  createdAt: string;
  eTag: string;
}

export interface ReportRunListItem {
  id: string;
  reportVersion: number;
  trigger: 'manual' | 'schedule' | 'automation';
  status: 'running' | 'completed' | 'failed';
  rowCount: number;
  outputFileName?: string | null;
  errorCode?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface ReportRunDetail extends ReportRunListItem {
  reportId: string;
  reportName: string;
  outputMimeType?: string | null;
  errorDetail?: string | null;
  startedAt?: string | null;
}

export interface ReportRunStart {
  id: string;
  status: 'completed' | 'failed';
  errorCode?: string | null;
  errorDetail?: string | null;
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  reportName: string;
  name: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  timeZoneId: string;
  hour: number;
  minute: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  isEnabled: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastRunId?: string | null;
  version: number;
  eTag: string;
}

export interface ReportMutationInput {
  name: string;
  description?: string | null;
  sourceKey: string;
  columns: string[];
  filters: ReportFilter[];
}

export interface ReportScheduleMutationInput {
  name: string;
  reportId: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  timeZoneId: string;
  hour: number;
  minute: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  isEnabled: boolean;
}
