import { getAccessToken } from './auth';
import {
  ensureMachineCredential,
  getMachineContext,
  machineRequest,
  type MachineContext,
} from './machineAuth';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

type Envelope<T> = { data: T };

export class AgentApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function userRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(API_BASE + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.detail ?? payload?.title ?? 'REQUEST_FAILED';
    throw new AgentApiError(response.status, message);
  }
  return payload;
}

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  locale: 'en-US' | 'th-TH';
  preferredLocale?: 'en-US' | 'th-TH' | null;
  organizationDefaultLocale: 'en-US' | 'th-TH';
};

export type DeviceContext = {
  id: string;
  hostname: string;
  type: string;
  connectivityState: string;
  operatingSystem?: string | null;
  ipAddress?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  assetReference?: string | null;
  agentVersion?: string | null;
  lastSeenAt?: string | null;
};

export type AgentField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  value?: string | null;
};

export type OwnershipContext = {
  assetId: string;
  assetTag: string;
  assetName: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  lifecycleStatus: string;
  deviceId: string;
  deviceName: string;
  currentUserIsAssetOwner: boolean;
  fields: AgentField[];
};

export type ConsentRequest = {
  id: string;
  deviceId: string;
  operatorName: string;
  operatorRole?: string | null;
  mode: string;
  messageTh: string;
  messageEn: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
  decidedAt?: string | null;
  version: number;
};

export type PerformanceTelemetry = {
  cpuPercent?: number | null;
  memoryUsedGb?: number | null;
  memoryTotalGb?: number | null;
  diskUsedGb?: number | null;
  diskTotalGb?: number | null;
};

export type NetworkTelemetry = {
  ipAddress?: string | null;
  macAddress?: string | null;
  subnetMask?: string | null;
  gateway?: string | null;
  dnsServers?: string[];
  adapterName?: string | null;
  agentLatencyMs?: number | null;
  packetLossPercent?: number | null;
};

export type HardwareTelemetry = {
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  processor?: string | null;
  biosVersion?: string | null;
  operatingSystem?: string | null;
  memoryTotalGb?: number | null;
  memorySlotsUsed?: number | null;
  memorySlotsTotal?: number | null;
};

export type SoftwarePackageTelemetry = {
  productKey?: string | null;
  displayName: string;
  version?: string | null;
  publisher?: string | null;
  architecture?: string | null;
};

export type SoftwareTelemetry = {
  completeness: 'complete' | 'partial';
  packages: SoftwarePackageTelemetry[];
};

export type AgentPrompt = {
  id: string;
  deviceId: string;
  sourceModule: string;
  sourceReference?: string | null;
  promptType: 'notice' | 'confirm';
  titleTh: string;
  titleEn: string;
  messageTh: string;
  messageEn: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string | null;
  responseKey?: string | null;
  version: number;
};

export async function getProfile() {
  return (await userRequest<Envelope<Profile>>('/platform/me')).data;
}

export async function setPreferredLocale(locale: 'en-US' | 'th-TH') {
  return userRequest('/platform/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ preferredLocale: locale }),
  });
}

function toDeviceContext(machine: MachineContext): DeviceContext {
  return {
    id: machine.id,
    hostname: machine.hostname,
    type: machine.type,
    connectivityState: machine.connectivityState,
    operatingSystem: machine.operatingSystem,
    ipAddress: machine.ipAddress,
    manufacturer: machine.manufacturer,
    model: machine.model,
    assetReference: null,
    agentVersion: machine.agentVersion,
    lastSeenAt: machine.lastSeenAt,
  };
}

export async function getDeviceContext() {
  return toDeviceContext(await getMachineContext());
}

export async function getMachineAgentContext() {
  return getMachineContext();
}

export async function getOwnershipContext() {
  const credential = await ensureMachineCredential();
  return (await userRequest<Envelope<OwnershipContext>>(
    '/agent/ownership/context?deviceId=' + encodeURIComponent(credential.deviceId),
  )).data;
}

export async function submitOwnership(input: {
  assetId: string;
  possession: string;
  location?: string;
  changes: Record<string, string | null>;
}) {
  const credential = await ensureMachineCredential();
  return userRequest('/agent/ownership-submissions', {
    method: 'POST',
    body: JSON.stringify({ deviceId: credential.deviceId, ...input }),
  });
}

export async function createHelpRequest(input: {
  subject: string;
  description: string;
  urgency: string;
}) {
  const credential = await ensureMachineCredential();
  return userRequest<Envelope<{
    id: string;
    ticketNumber: string;
    subject: string;
    status: string;
  }>>('/agent/help-requests', {
    method: 'POST',
    body: JSON.stringify({
      subject: input.subject,
      description: input.description,
      categoryId: null,
      priority: null,
      impact: 'medium',
      urgency: input.urgency,
      relatedDeviceId: credential.deviceId,
    }),
  });
}

export async function getPendingConsent() {
  const credential = await ensureMachineCredential();
  return (await machineRequest<Envelope<ConsentRequest | null>>(
    '/agent/remote-consent/pending?deviceId=' + encodeURIComponent(credential.deviceId),
  )).data;
}

export async function decideConsent(requestId: string, decision: 'approved' | 'declined') {
  return machineRequest<Envelope<ConsentRequest>>(
    '/agent/remote-consent/requests/' + encodeURIComponent(requestId) + '/decision',
    { method: 'POST', body: JSON.stringify({ decision }) },
  );
}

export async function submitTelemetry(input: {
  observedAt: string;
  sourceInstance?: string | null;
  performance?: PerformanceTelemetry | null;
  network?: NetworkTelemetry | null;
  hardware?: HardwareTelemetry | null;
  software?: SoftwareTelemetry | null;
}) {
  const credential = await ensureMachineCredential();
  return machineRequest<Envelope<{
    deviceId: string;
    observedAt: string;
    receivedAt: string;
    performanceStored: boolean;
    networkStored: boolean;
    hardwareStored: boolean;
    softwareStored: boolean;
  }>>('/agent/devices/' + encodeURIComponent(credential.deviceId) + '/telemetry', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getPendingPrompt() {
  const credential = await ensureMachineCredential();
  return (await machineRequest<Envelope<AgentPrompt | null>>(
    '/agent/prompts/pending?deviceId=' + encodeURIComponent(credential.deviceId),
  )).data;
}

export async function respondToPrompt(
  promptId: string,
  responseKey: 'acknowledged' | 'accepted' | 'declined',
) {
  return machineRequest<Envelope<AgentPrompt>>(
    '/agent/prompts/' + encodeURIComponent(promptId) + '/response',
    { method: 'POST', body: JSON.stringify({ responseKey }) },
  );
}
