import * as SecureStore from 'expo-secure-store';
import type { RecentScan, ResolvedAsset } from './types';

const HISTORY_KEY = 'inno-one-assets.recent-scans.v1';
const MAX_ITEMS = 20;

export async function readRecentScans(): Promise<RecentScan[]> {
  const raw = await SecureStore.getItemAsync(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RecentScan[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export async function saveRecentScan(asset: ResolvedAsset): Promise<RecentScan[]> {
  const current = await readRecentScans();
  const next: RecentScan = {
    assetId: asset.id,
    assetTag: asset.assetTag,
    name: asset.name,
    brandModel: [asset.brand, asset.model].filter(Boolean).join(' '),
    owner: asset.owner?.name ?? null,
    scannedAt: asset.scannedAt,
  };

  const updated = [
    next,
    ...current.filter((item) => item.assetId !== asset.id),
  ].slice(0, MAX_ITEMS);

  await SecureStore.setItemAsync(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}
