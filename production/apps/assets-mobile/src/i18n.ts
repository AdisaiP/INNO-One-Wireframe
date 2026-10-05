export type Locale = 'th-TH' | 'en-US';

const catalog = {
  'th-TH': {
    boot: 'กำลังเตรียม INNO.One Assets…',
    signInTitle: 'สแกนทรัพย์สินอย่างปลอดภัย',
    signInBody: 'เข้าสู่ระบบด้วยบัญชีองค์กรก่อนใช้งานกล้องและตรวจสอบ QR Code ของทรัพย์สิน',
    signIn: 'เข้าสู่ระบบองค์กร',
    securityNote: 'ใช้ Authorization Code + PKCE · ไม่เก็บ QR Token หลังสแกน',
    signOut: 'ออกจากระบบ',
    language: 'ภาษา',
    headerSub: 'คลังทรัพย์สินบนมือถือ',
    qrTokenOnly: 'เฉพาะ QR token',
    scannerEyebrow: 'QR SCANNER',
    scannerTitle: 'สแกน Asset Label',
    scannerBody: 'เล็งกล้องไปที่ QR Code ของทรัพย์สิน ระบบจะตรวจสอบ Token กับ INNO.One โดยอัตโนมัติ',
    cameraPermissionTitle: 'ต้องการสิทธิ์ใช้กล้อง',
    cameraPermissionBody: 'INNO.One Assets ใช้กล้องเฉพาะสำหรับสแกน QR Code ของทรัพย์สิน',
    cameraPermissionAllow: 'อนุญาตใช้กล้อง',
    cameraPermissionSettings: 'เปิดสิทธิ์ Camera จาก Settings ของ Android แล้วกลับมาที่แอป',
    checkingToken: 'กำลังตรวจสอบ Asset Token…',
    secureNote: 'QR Code เก็บเฉพาะ opaque token และจะไม่ถูกบันทึกในประวัติ',
    recentScans: 'การสแกนล่าสุด',
    onThisDevice: 'บนอุปกรณ์นี้',
    viewAll: 'ดูทั้งหมด',
    noRecent: 'ยังไม่มีประวัติการสแกน',
    noRecentBody: 'รายการล่าสุดจะแสดงหลังสแกนสำเร็จ',
    scanNav: 'สแกน',
    historyNav: 'ประวัติ',
    historyEyebrow: 'SCAN HISTORY',
    historyTitle: 'ประวัติการสแกน',
    scanAgain: 'สแกนอีกครั้ง',
    historyBody: 'ประวัตินี้เก็บบนอุปกรณ์เท่านั้น และไม่มี QR Token',
    noHistory: 'ยังไม่มีประวัติ',
    noHistoryBody: 'เริ่มจากการสแกน Asset Label',
    assetFound: 'ASSET FOUND',
    assetOverview: 'ข้อมูลทรัพย์สิน',
    category: 'หมวดหมู่',
    serial: 'Serial',
    owner: 'ผู้ใช้งาน',
    organization: 'องค์กร',
    location: 'สถานที่',
    warranty: 'ประกัน',
    warrantyUntil: 'ถึง',
    noData: 'ไม่มีข้อมูล',
    unassigned: 'ยังไม่ได้กำหนด',
    managedEndpoint: 'Managed endpoint',
    device: 'อุปกรณ์',
    status: 'สถานะ',
    operatingSystem: 'ระบบปฏิบัติการ',
    noManagedEndpoint: 'Asset นี้ยังไม่ได้เชื่อมกับ Managed Endpoint',
    additionalInformation: 'ข้อมูลเพิ่มเติม',
    latestData: 'ข้อมูลล่าสุดจาก INNO.One',
    scanned: 'สแกน',
    assetUpdated: 'อัปเดต Asset',
    errorTitle: 'ตรวจสอบ QR Code ไม่สำเร็จ',
    genericQrError: 'ไม่สามารถตรวจสอบ QR Code ได้',
    invalidQr: 'QR Code ไม่ถูกต้อง หมดอายุ หรือถูกยกเลิกแล้ว',
    forbiddenQr: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงทรัพย์สินจาก QR Code นี้',
    sessionExpired: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง',
    signInRequired: 'กรุณาเข้าสู่ระบบ',
    loadAssetError: 'ไม่สามารถโหลดข้อมูลทรัพย์สินได้',
    signInError: 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง',
    offlineError: 'ไม่สามารถเชื่อมต่อ INNO.One ได้ ตรวจสอบอินเทอร์เน็ตหรือ VPN แล้วลองอีกครั้ง',
    profileOffline: 'กำลังใช้ภาษาจากอุปกรณ์ เนื่องจากยังโหลดการตั้งค่าภาษาไม่ได้',
    profileSaveError: 'ไม่สามารถบันทึกภาษาได้ กรุณาลองอีกครั้ง',
    justNow: 'เมื่อสักครู่',
    minutesAgo: '{count} นาที',
    hoursAgo: '{count} ชม.',
    daysAgo: '{count} วัน',
  },
  'en-US': {
    boot: 'Preparing INNO.One Assets…',
    signInTitle: 'Scan Assets securely',
    signInBody: 'Sign in with your organization account before using the camera and resolving Asset QR codes.',
    signIn: 'Sign in with organization account',
    securityNote: 'Authorization Code + PKCE · QR tokens are not stored after scanning',
    signOut: 'Sign out',
    language: 'Language',
    headerSub: 'Mobile Inventory',
    qrTokenOnly: 'QR token only',
    scannerEyebrow: 'QR SCANNER',
    scannerTitle: 'Scan Asset Label',
    scannerBody: 'Point the camera at an Asset QR code. INNO.One validates the token automatically.',
    cameraPermissionTitle: 'Camera permission required',
    cameraPermissionBody: 'INNO.One Assets uses the camera only to scan Asset QR codes.',
    cameraPermissionAllow: 'Allow camera',
    cameraPermissionSettings: 'Enable Camera permission in Android Settings, then return to the app.',
    checkingToken: 'Checking Asset Token…',
    secureNote: 'The QR code contains only an opaque token and is never stored in scan history.',
    recentScans: 'Recent scans',
    onThisDevice: 'On this device',
    viewAll: 'View all',
    noRecent: 'No scans yet',
    noRecentBody: 'Recent Assets appear here after a successful scan.',
    scanNav: 'Scan',
    historyNav: 'History',
    historyEyebrow: 'SCAN HISTORY',
    historyTitle: 'Scan history',
    scanAgain: 'Scan again',
    historyBody: 'This history stays on this device and never contains QR tokens.',
    noHistory: 'No scan history',
    noHistoryBody: 'Start by scanning an Asset Label.',
    assetFound: 'ASSET FOUND',
    assetOverview: 'Asset overview',
    category: 'Category',
    serial: 'Serial',
    owner: 'Owner',
    organization: 'Organization',
    location: 'Location',
    warranty: 'Warranty',
    warrantyUntil: 'Until',
    noData: 'No data',
    unassigned: 'Unassigned',
    managedEndpoint: 'Managed endpoint',
    device: 'Device',
    status: 'Status',
    operatingSystem: 'Operating system',
    noManagedEndpoint: 'This Asset is not linked to a Managed Endpoint.',
    additionalInformation: 'Additional information',
    latestData: 'Latest data from INNO.One',
    scanned: 'Scanned',
    assetUpdated: 'Asset updated',
    errorTitle: 'Unable to verify QR Code',
    genericQrError: 'Unable to verify the QR Code.',
    invalidQr: 'This QR Code is invalid, expired, or revoked.',
    forbiddenQr: 'This account cannot access the Asset represented by this QR Code.',
    sessionExpired: 'Your session expired. Sign in again.',
    signInRequired: 'Sign in to continue.',
    loadAssetError: 'Unable to load Asset data.',
    signInError: 'Unable to sign in. Try again.',
    offlineError: 'Unable to reach INNO.One. Check your internet or VPN connection and try again.',
    profileOffline: 'Using the device language because your language preference could not be loaded.',
    profileSaveError: 'Unable to save the language preference. Try again.',
    justNow: 'Just now',
    minutesAgo: '{count} min',
    hoursAgo: '{count} hr',
    daysAgo: '{count} d',
  },
} as const;

export type MessageKey = keyof typeof catalog['en-US'];

export function resolveSupportedLocale(value?: string | null): Locale {
  const normalized = (value ?? '').toLowerCase();
  return normalized.startsWith('th') ? 'th-TH' : 'en-US';
}

export function deviceLocale(): Locale {
  try {
    return resolveSupportedLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en-US';
  }
}

export function translate(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, string | number>,
) {
  let message: string = catalog[locale][key] ?? catalog['en-US'][key] ?? key;
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll('{' + name + '}', String(value));
    }
  }
  return message;
}

export function formatDate(locale: Locale, value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatRelativeTime(locale: Locale, value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return translate(locale, 'justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return translate(locale, 'minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate(locale, 'hoursAgo', { count: hours });
  return translate(locale, 'daysAgo', { count: Math.floor(hours / 24) });
}
