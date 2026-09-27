import { config } from './config';
import type { ResolvedAsset } from './types';

interface ResourceResponse<T> {
  data: T;
}

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function resolveAssetQr(
  token: string,
  accessToken: string,
): Promise<ResolvedAsset> {
  const response = await fetch(config.apiBaseUrl + '/assets/qr/resolve', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const problem = (await response.json()) as { detail?: string; title?: string };
      detail = problem.detail ?? problem.title ?? '';
    } catch {
      detail = '';
    }

    if (response.status === 404) {
      throw new MobileApiError(404, 'QR Code ไม่ถูกต้อง หมดอายุ หรือถูกยกเลิกแล้ว');
    }
    if (response.status === 403) {
      throw new MobileApiError(403, 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงทรัพย์สินจาก QR Code นี้');
    }
    if (response.status === 401) {
      throw new MobileApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }
    throw new MobileApiError(response.status, detail || 'ไม่สามารถโหลดข้อมูลทรัพย์สินได้');
  }

  const payload = (await response.json()) as ResourceResponse<ResolvedAsset>;
  return payload.data;
}
