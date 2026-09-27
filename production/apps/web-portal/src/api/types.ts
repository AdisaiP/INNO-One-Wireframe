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

export interface AutomationRuleSummary {
  id: string;
  name: string;
  ruleType: string;
  trigger: string;
  primaryAction: string;
  status: string;
  executionCount: number;
  lastExecutedAt?: string | null;
  eTag: string;
}

export interface AutomationExecution {
  id: string;
  ticketId: string;
  trigger: string;
  result: string;
  executedAt: string;
}

export interface AutomationRuleDetail {
  id: string;
  code: string;
  name: string;
  ruleType: string;
  trigger: string;
  scopeType: string;
  scopeValue?: string | null;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
  status: string;
  sortOrder: number;
  recentExecutions: AutomationExecution[];
  eTag: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
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
  evaluationStatus: 'awaiting_inventory';
  updatedAt: string;
  eTag: string;
}
export type SoftwareBaselineRequest = Pick<SoftwareBaselineItem,
  'code' | 'name' | 'targetCategory' | 'requiredPackages' | 'status'>;
export interface SoftwareBaselineListResponse {
  items: SoftwareBaselineItem[];
  totalItems: number;
}
