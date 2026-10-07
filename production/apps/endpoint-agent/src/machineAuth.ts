import { invoke } from '@tauri-apps/api/core';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export type MachineCredential = {
  deviceId: string;
  deviceSecret: string;
};

export type EnrollmentIdentity = {
  hostname: string;
  deviceType: string;
  operatingSystem?: string | null;
  windowsIdentity?: string | null;
  windowsUpn?: string | null;
  agentVersion: string;
};

export type OwnershipUser = {
  id: string;
  fullName: string;
  email: string;
};

export type OwnershipSuggestion = {
  status: string;
  matchReason: string;
  detectedIdentity?: string | null;
  detectedUpn?: string | null;
  candidate?: OwnershipUser | null;
};

export type MachineContext = {
  id: string;
  hostname: string;
  type: string;
  connectivityState: string;
  operatingSystem?: string | null;
  ipAddress?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  agentVersion?: string | null;
  lastSeenAt?: string | null;
  owner?: OwnershipUser | null;
  ownershipSuggestion?: OwnershipSuggestion | null;
};

type Envelope<T> = { data: T };

let credentialPromise: Promise<MachineCredential> | undefined;

export class MachineAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function loadMachineCredential() {
  return invoke<MachineCredential | null>('load_machine_credential');
}

export async function clearMachineCredential() {
  await invoke('clear_machine_credential');
  credentialPromise = undefined;
}

async function enrollMachine(): Promise<MachineCredential> {
  const enrollmentToken = await invoke<string | null>('load_enrollment_token');
  if (!enrollmentToken) {
    throw new MachineAuthError(409, 'AGENT_ENROLLMENT_REQUIRED');
  }

  const identity = await invoke<EnrollmentIdentity>('collect_enrollment_identity');
  const response = await fetch(API_BASE + '/agent/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: enrollmentToken,
      hostname: identity.hostname,
      deviceType: identity.deviceType,
      operatingSystem: identity.operatingSystem ?? null,
      windowsIdentity: identity.windowsIdentity ?? null,
      windowsUpn: identity.windowsUpn ?? null,
      agentVersion: identity.agentVersion,
    }),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.detail ?? payload?.title ?? payload?.code ?? 'AGENT_ENROLL_FAILED';
    throw new MachineAuthError(response.status, message);
  }

  const data = (payload as Envelope<{
    deviceId: string;
    deviceSecret: string;
  }>).data;

  const credential: MachineCredential = {
    deviceId: data.deviceId,
    deviceSecret: data.deviceSecret,
  };

  await invoke('save_machine_credential', { credential });
  await invoke('clear_enrollment_token');
  return credential;
}

export async function ensureMachineCredential() {
  credentialPromise ??= (async () => {
    const stored = await loadMachineCredential();
    if (stored?.deviceId && stored?.deviceSecret) return stored;
    return enrollMachine();
  })();

  return credentialPromise;
}

export async function machineRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const credential = await ensureMachineCredential();

  const response = await fetch(API_BASE + path, {
    ...init,
    headers: {
      'X-INNO-Device-Id': credential.deviceId,
      'X-INNO-Device-Secret': credential.deviceSecret,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401) {
      await clearMachineCredential();
    }
    const message = payload?.detail ?? payload?.title ?? 'MACHINE_REQUEST_FAILED';
    throw new MachineAuthError(response.status, message);
  }

  return payload;
}

export async function getMachineContext() {
  return (await machineRequest<Envelope<MachineContext>>('/agent/machine/context')).data;
}
