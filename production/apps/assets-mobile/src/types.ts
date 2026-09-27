export interface ReferenceValue {
  id: string;
  name: string;
}

export interface LinkedDevice {
  id: string;
  name: string;
  status: string;
  operatingSystem?: string | null;
}

export interface CustomFieldValue {
  fieldKey: string;
  label: string;
  fieldType: string;
  value?: unknown;
}

export interface ResolvedAsset {
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
  linkedDevice?: LinkedDevice | null;
  warrantyEndAt?: string | null;
  customFields: CustomFieldValue[];
  scannedAt: string;
  updatedAt: string;
}

export interface RecentScan {
  assetId: string;
  assetTag: string;
  name: string;
  brandModel: string;
  owner?: string | null;
  scannedAt: string;
}

export interface TokenSession {
  accessToken: string;
  refreshToken?: string;
  issuedAt: number;
  expiresIn?: number;
}
