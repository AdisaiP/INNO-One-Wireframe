import { invoke } from '@tauri-apps/api/core';

export type NativePerformanceTelemetry = {
  cpuPercent?: number | null;
  memoryUsedGb?: number | null;
  memoryTotalGb?: number | null;
  diskUsedGb?: number | null;
  diskTotalGb?: number | null;
};

export type NativeNetworkTelemetry = {
  ipAddress?: string | null;
  macAddress?: string | null;
  subnetMask?: string | null;
  gateway?: string | null;
  dnsServers?: string[];
  adapterName?: string | null;
};

export function isNativeAgentRuntime() {
  return '__TAURI_INTERNALS__' in window;
}

export async function collectPerformanceTelemetry() {
  return invoke<NativePerformanceTelemetry>('collect_performance_telemetry');
}

export async function collectNetworkTelemetry() {
  return invoke<NativeNetworkTelemetry>('collect_network_telemetry');
}
