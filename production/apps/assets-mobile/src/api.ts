import { config } from './config';
import { translate, type Locale } from './i18n';
import type { ResolvedAsset } from './types';

interface ResourceResponse<T> {
  data: T;
}

export interface MobileProfile {
  id: string;
  fullName: string;
  email: string;
  locale: Locale;
  preferredLocale?: Locale | null;
  organizationDefaultLocale: Locale;
}

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  locale: Locale,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(config.apiBaseUrl + path, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new MobileApiError(0, translate(locale, 'offlineError'));
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new MobileApiError(401, translate(locale, 'sessionExpired'));
    }
    throw new MobileApiError(response.status, translate(locale, 'loadAssetError'));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getMobileProfile(
  accessToken: string,
  locale: Locale,
): Promise<MobileProfile> {
  const payload = await request<ResourceResponse<MobileProfile>>(
    '/platform/me',
    accessToken,
    locale,
  );
  return payload.data;
}

export async function setMobilePreferredLocale(
  accessToken: string,
  locale: Locale,
): Promise<MobileProfile> {
  const payload = await request<ResourceResponse<MobileProfile>>(
    '/platform/me/profile',
    accessToken,
    locale,
    {
      method: 'PATCH',
      body: JSON.stringify({ preferredLocale: locale }),
    },
  );
  return payload.data;
}

export async function resolveAssetQr(
  token: string,
  accessToken: string,
  locale: Locale,
): Promise<ResolvedAsset> {
  let response: Response;
  try {
    response = await fetch(config.apiBaseUrl + '/assets/qr/resolve', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    throw new MobileApiError(0, translate(locale, 'offlineError'));
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new MobileApiError(404, translate(locale, 'invalidQr'));
    }
    if (response.status === 403) {
      throw new MobileApiError(403, translate(locale, 'forbiddenQr'));
    }
    if (response.status === 401) {
      throw new MobileApiError(401, translate(locale, 'sessionExpired'));
    }
    throw new MobileApiError(response.status, translate(locale, 'loadAssetError'));
  }

  const payload = (await response.json()) as ResourceResponse<ResolvedAsset>;
  return payload.data;
}
