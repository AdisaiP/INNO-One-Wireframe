import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { MobileApiError, resolveAssetQr } from './src/api';
import { config, discovery } from './src/config';
import { readRecentScans, saveRecentScan } from './src/history';
import type { RecentScan, ResolvedAsset, TokenSession } from './src/types';

WebBrowser.maybeCompleteAuthSession();

const SESSION_KEY = 'inno-one-assets.oidc-session.v1';
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'innoone-assets',
  path: 'oauth',
});

type MainView = 'scanner' | 'history' | 'result' | 'error';

function friendlyDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'เมื่อสักครู่';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' นาที';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' ชม.';
  return Math.floor(hours / 24) + ' วัน';
}

function isSessionFresh(session: TokenSession) {
  if (!session.expiresIn) return true;
  const expiresAt = session.issuedAt + session.expiresIn * 1000;
  return Date.now() < expiresAt - 30_000;
}

async function persistSession(session: TokenSession | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

async function restoreSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenSession;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<TokenSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [view, setView] = useState<MainView>('scanner');
  const [resolvedAsset, setResolvedAsset] = useState<ResolvedAsset | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [scannerArmed, setScannerArmed] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: config.keycloakClientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    void Promise.all([restoreSession(), readRecentScans()])
      .then(([storedSession, history]) => {
        setSession(storedSession);
        setRecentScans(history);
      })
      .finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;
    const code = response.params.code;
    if (!code) return;

    void AuthSession.exchangeCodeAsync(
      {
        clientId: config.keycloakClientId,
        code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    )
      .then(async (tokenResponse) => {
        const nextSession: TokenSession = {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          issuedAt: Date.now(),
          expiresIn: tokenResponse.expiresIn,
        };
        await persistSession(nextSession);
        setSession(nextSession);
      })
      .catch(() => {
        setErrorMessage('ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง');
        setView('error');
      });
  }, [request?.codeVerifier, response]);

  const getAccessToken = useCallback(async () => {
    if (!session) throw new MobileApiError(401, 'กรุณาเข้าสู่ระบบ');
    if (isSessionFresh(session)) return session.accessToken;

    if (!session.refreshToken) {
      await persistSession(null);
      setSession(null);
      throw new MobileApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }

    try {
      const refreshed = await AuthSession.refreshAsync(
        {
          clientId: config.keycloakClientId,
          refreshToken: session.refreshToken,
        },
        discovery,
      );
      const next: TokenSession = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
        issuedAt: Date.now(),
        expiresIn: refreshed.expiresIn,
      };
      await persistSession(next);
      setSession(next);
      return next.accessToken;
    } catch {
      await persistSession(null);
      setSession(null);
      throw new MobileApiError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }
  }, [session]);

  const resolveToken = useCallback(async (token: string) => {
    if (scanBusy || !scannerArmed) return;
    setScanBusy(true);
    setScannerArmed(false);
    try {
      const accessToken = await getAccessToken();
      const asset = await resolveAssetQr(token, accessToken);
      const history = await saveRecentScan(asset);
      setRecentScans(history);
      setResolvedAsset(asset);
      setView('result');
      setErrorMessage('');
    } catch (error) {
      setResolvedAsset(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'ไม่สามารถตรวจสอบ QR Code ได้',
      );
      setView('error');
    } finally {
      setScanBusy(false);
    }
  }, [getAccessToken, scanBusy, scannerArmed]);

  const scanAgain = useCallback(() => {
    setView('scanner');
    setResolvedAsset(null);
    setErrorMessage('');
    setTimeout(() => setScannerArmed(true), 350);
  }, []);

  const signOut = useCallback(async () => {
    await persistSession(null);
    setSession(null);
    setResolvedAsset(null);
    setView('scanner');
    setScannerArmed(true);
  }, []);

  if (restoring) {
    return (
      <SafeAreaView style={styles.boot}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" />
        <Text style={styles.bootText}>กำลังเตรียม INNO.One Assets…</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.signInScreen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>I1</Text></View>
          <Text style={styles.brand}>INNO.<Text style={styles.brandAccent}>One</Text></Text>
        </View>
        <View style={styles.signInCard}>
          <Text style={styles.eyebrow}>ASSETS MOBILE</Text>
          <Text style={styles.signInTitle}>สแกนทรัพย์สินอย่างปลอดภัย</Text>
          <Text style={styles.signInBody}>
            เข้าสู่ระบบด้วยบัญชีองค์กรก่อนใช้งานกล้องและตรวจสอบ QR Code ของทรัพย์สิน
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!request}
            style={({ pressed }) => [
              styles.primaryButton,
              (!request || pressed) && styles.buttonPressed,
            ]}
            onPress={() => void promptAsync()}
          >
            <Text style={styles.primaryButtonText}>เข้าสู่ระบบองค์กร</Text>
          </Pressable>
          <Text style={styles.securityNote}>
            ใช้ Authorization Code + PKCE · ไม่เก็บ QR Token หลังสแกน
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.brandRowCompact}>
          <View style={styles.logoSmall}><Text style={styles.logoTextSmall}>I1</Text></View>
          <View>
            <Text style={styles.headerTitle}>INNO.One Assets</Text>
            <Text style={styles.headerSub}>Mobile Inventory</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void signOut()}>
          <Text style={styles.signOut}>ออกจากระบบ</Text>
        </Pressable>
      </View>

      {view === 'scanner' ? (
        <ScannerScreen
          permission={cameraPermission?.granted ?? false}
          canAskPermission={cameraPermission?.canAskAgain ?? true}
          requestPermission={() => void requestCameraPermission()}
          busy={scanBusy}
          armed={scannerArmed}
          onScan={(data) => void resolveToken(data)}
          history={recentScans.slice(0, 3)}
          onHistory={() => setView('history')}
        />
      ) : null}

      {view === 'history' ? (
        <HistoryScreen
          items={recentScans}
          onBack={() => setView('scanner')}
          onScan={scanAgain}
        />
      ) : null}

      {view === 'result' && resolvedAsset ? (
        <ResultScreen asset={resolvedAsset} onScanAgain={scanAgain} />
      ) : null}

      {view === 'error' ? (
        <ErrorScreen message={errorMessage} onScanAgain={scanAgain} />
      ) : null}

      {view === 'scanner' || view === 'history' ? (
        <View style={styles.bottomNav}>
          <Pressable
            accessibilityRole="button"
            style={[styles.navButton, view === 'scanner' && styles.navButtonActive]}
            onPress={() => setView('scanner')}
          >
            <Text style={[styles.navText, view === 'scanner' && styles.navTextActive]}>สแกน</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.navButton, view === 'history' && styles.navButtonActive]}
            onPress={() => setView('history')}
          >
            <Text style={[styles.navText, view === 'history' && styles.navTextActive]}>ประวัติ</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
function ScannerScreen(props: {
  permission: boolean;
  canAskPermission: boolean;
  requestPermission: () => void;
  busy: boolean;
  armed: boolean;
  onScan: (data: string) => void;
  history: RecentScan[];
  onHistory: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>QR SCANNER</Text>
      <Text style={styles.screenTitle}>สแกน Asset Label</Text>
      <Text style={styles.screenBody}>
        เล็งกล้องไปที่ QR Code ของทรัพย์สิน ระบบจะตรวจสอบ Token กับ INNO.One โดยอัตโนมัติ
      </Text>

      <View style={styles.cameraCard}>
        {props.permission ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={
              props.armed
                ? ({ data }) => props.onScan(data)
                : undefined
            }
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame} />
              <View style={styles.cameraBadge}><Text style={styles.cameraBadgeText}>QR token only</Text></View>
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>ต้องการสิทธิ์ใช้กล้อง</Text>
            <Text style={styles.permissionBody}>
              INNO.One Assets ใช้กล้องเฉพาะสำหรับสแกน QR Code ของทรัพย์สิน
            </Text>
            {props.canAskPermission ? (
              <Pressable style={styles.primaryButton} onPress={props.requestPermission}>
                <Text style={styles.primaryButtonText}>อนุญาตใช้กล้อง</Text>
              </Pressable>
            ) : (
              <Text style={styles.permissionBody}>เปิดสิทธิ์ Camera จาก Settings ของ Android แล้วกลับมาที่แอป</Text>
            )}
          </View>
        )}
        {props.busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.busyText}>กำลังตรวจสอบ Asset Token…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.secureLine}>
        <Text style={styles.secureDot}>●</Text>
        <Text style={styles.secureText}>QR Code เก็บเฉพาะ opaque token และจะไม่ถูกบันทึกในประวัติ</Text>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Recent scans</Text>
          <Text style={styles.sectionSub}>บนอุปกรณ์นี้</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={props.onHistory}>
          <Text style={styles.linkText}>ดูทั้งหมด</Text>
        </Pressable>
      </View>

      <View style={styles.listCard}>
        {props.history.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyTitle}>ยังไม่มีประวัติการสแกน</Text>
            <Text style={styles.emptyText}>รายการล่าสุดจะแสดงหลังสแกนสำเร็จ</Text>
          </View>
        ) : props.history.map((item, index) => (
          <View
            key={item.assetId}
            style={[styles.historyRow, index > 0 && styles.rowDivider]}
          >
            <View style={styles.historyMain}>
              <Text style={styles.assetTag}>{item.assetTag}</Text>
              <Text style={styles.historyMeta} numberOfLines={1}>
                {[item.brandModel || item.name, item.owner].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={styles.timeText}>{relativeTime(item.scannedAt)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function HistoryScreen(props: {
  items: RecentScan[];
  onBack: () => void;
  onScan: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.inlineHeader}>
        <View>
          <Text style={styles.eyebrow}>SCAN HISTORY</Text>
          <Text style={styles.screenTitle}>ประวัติการสแกน</Text>
        </View>
        <Pressable onPress={props.onScan}><Text style={styles.linkText}>สแกนใหม่</Text></Pressable>
      </View>
      <Text style={styles.screenBody}>
        ประวัตินี้เก็บบนอุปกรณ์เท่านั้น และไม่มี QR Token
      </Text>
      <View style={styles.listCard}>
        {props.items.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyTitle}>ยังไม่มีประวัติ</Text>
            <Text style={styles.emptyText}>เริ่มจากการสแกน Asset Label</Text>
          </View>
        ) : props.items.map((item, index) => (
          <View key={item.assetId} style={[styles.historyRow, index > 0 && styles.rowDivider]}>
            <View style={styles.historyMain}>
              <Text style={styles.assetTag}>{item.assetTag}</Text>
              <Text style={styles.historyMeta}>{item.name}</Text>
              <Text style={styles.historyMeta}>{item.brandModel || '—'}{item.owner ? ' · ' + item.owner : ''}</Text>
            </View>
            <Text style={styles.timeText}>{relativeTime(item.scannedAt)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ResultScreen(props: { asset: ResolvedAsset; onScanAgain: () => void }) {
  const { asset } = props;
  const statusTone = asset.status.toLowerCase().includes('retired') ? styles.badgeDanger : styles.badgeSuccess;
  const customFields = useMemo(
    () => asset.customFields.filter((item) => item.value !== null && item.value !== undefined),
    [asset.customFields],
  );

  return (
    <ScrollView contentContainerStyle={styles.resultContent}>
      <View style={styles.resultHero}>
        <View style={styles.resultHeroTop}>
          <View>
            <Text style={styles.eyebrow}>ASSET FOUND</Text>
            <Text style={styles.resultTag}>{asset.assetTag}</Text>
            <Text style={styles.resultName}>{asset.name}</Text>
          </View>
          <View style={[styles.badge, statusTone]}>
            <Text style={styles.badgeText}>{asset.status}</Text>
          </View>
        </View>
        <Text style={styles.resultMeta}>
          {[asset.brand, asset.model].filter(Boolean).join(' ') || asset.category}
        </Text>
      </View>

      <InfoSection title="Asset overview">
        <InfoRow label="Category" value={asset.category} />
        <InfoRow label="Serial" value={asset.serialNumber ?? '—'} />
        <InfoRow label="Owner" value={asset.owner?.name ?? 'Unassigned'} />
        <InfoRow label="Organization" value={asset.organization?.name ?? '—'} />
        <InfoRow label="Location" value={asset.location?.name ?? '—'} />
        <InfoRow label="Warranty" value={asset.warrantyEndAt ? 'ถึง ' + friendlyDate(asset.warrantyEndAt) : 'ไม่มีข้อมูล'} />
      </InfoSection>

      <InfoSection title="Managed endpoint">
        {asset.linkedDevice ? (
          <>
            <InfoRow label="Device" value={asset.linkedDevice.name} />
            <InfoRow label="Status" value={asset.linkedDevice.status} />
            <InfoRow label="Operating system" value={asset.linkedDevice.operatingSystem ?? '—'} />
          </>
        ) : (
          <Text style={styles.mutedBody}>Asset นี้ยังไม่ได้เชื่อมกับ Managed Endpoint</Text>
        )}
      </InfoSection>

      {customFields.length > 0 ? (
        <InfoSection title="Additional information">
          {customFields.map((item) => (
            <InfoRow
              key={item.fieldKey}
              label={item.label}
              value={renderCustomValue(item.value)}
            />
          ))}
        </InfoSection>
      ) : null}

      <View style={styles.updatedCard}>
        <Text style={styles.updatedTitle}>ข้อมูลล่าสุดจาก INNO.One</Text>
        <Text style={styles.updatedText}>สแกน {friendlyDate(asset.scannedAt)} · Asset updated {friendlyDate(asset.updatedAt)}</Text>
      </View>

      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={props.onScanAgain}>
        <Text style={styles.primaryButtonText}>สแกนอีกครั้ง</Text>
      </Pressable>
    </ScrollView>
  );
}

function ErrorScreen(props: { message: string; onScanAgain: () => void }) {
  return (
    <View style={styles.errorScreen}>
      <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
      <Text style={styles.errorTitle}>ตรวจสอบ QR Code ไม่สำเร็จ</Text>
      <Text style={styles.errorBody}>{props.message}</Text>
      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={props.onScanAgain}>
        <Text style={styles.primaryButtonText}>สแกนอีกครั้ง</Text>
      </Pressable>
    </View>
  );
}

function InfoSection(props: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{props.title}</Text>
      <View>{props.children}</View>
    </View>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{props.label}</Text>
      <Text style={styles.infoValue}>{props.value}</Text>
    </View>
  );
}

function renderCustomValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '—';
  }
}
const styles: Record<string, any> = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f5f7fb' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f7fb' },
  bootText: { color: '#536176', fontSize: 14 },
  signInScreen: { flex: 1, backgroundColor: '#f5f7fb', paddingHorizontal: 20, paddingTop: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2c63dc', alignItems: 'center', justifyContent: 'center' },
  logoSmall: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#2c63dc', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logoTextSmall: { color: '#fff', fontWeight: '800', fontSize: 12 },
  brand: { fontSize: 22, fontWeight: '800', color: '#172238' },
  brandAccent: { color: '#2c63dc' },
  signInCard: { marginTop: 96, padding: 22, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#dde4ef', gap: 14 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '800', color: '#77849a' },
  signInTitle: { fontSize: 26, lineHeight: 34, fontWeight: '800', color: '#172238' },
  signInBody: { fontSize: 15, lineHeight: 23, color: '#5b687b' },
  securityNote: { fontSize: 12, lineHeight: 18, color: '#77849a', textAlign: 'center' },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#2c63dc', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.65 },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e7ef' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#172238' },
  headerSub: { fontSize: 11, color: '#7a8799', marginTop: 1 },
  signOut: { fontSize: 12, fontWeight: '700', color: '#56657a' },
  screenContent: { padding: 16, paddingBottom: 100 },
  resultContent: { padding: 16, paddingBottom: 32, gap: 12 },
  screenTitle: { marginTop: 5, fontSize: 26, lineHeight: 33, fontWeight: '800', color: '#172238' },
  screenBody: { marginTop: 7, fontSize: 14, lineHeight: 21, color: '#5d6b7f' },
  cameraCard: { height: 350, marginTop: 18, borderRadius: 22, overflow: 'hidden', backgroundColor: '#121b2b', borderWidth: 1, borderColor: '#27344a' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 220, height: 220, borderWidth: 3, borderColor: '#fff', borderRadius: 22, backgroundColor: 'transparent' },
  cameraBadge: { position: 'absolute', top: 16, right: 16, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(15,24,40,.72)' },
  cameraBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  permissionCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#fff' },
  permissionTitle: { fontSize: 19, fontWeight: '800', color: '#172238' },
  permissionBody: { textAlign: 'center', fontSize: 14, lineHeight: 21, color: '#657286' },
  busyOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(10,17,29,.78)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { color: '#fff', fontWeight: '700' },
  secureLine: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  secureDot: { color: '#2b9b68', fontSize: 12 },
  secureText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#66748a' },
  sectionHeader: { marginTop: 24, marginBottom: 9, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#172238' },
  sectionSub: { marginTop: 2, fontSize: 11, color: '#7c899a' },
  linkText: { color: '#2c63dc', fontSize: 13, fontWeight: '800' },
  listCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe5ed', borderRadius: 16, overflow: 'hidden' },
  historyRow: { minHeight: 68, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#edf0f4' },
  historyMain: { flex: 1, minWidth: 0 },
  assetTag: { fontSize: 13, fontWeight: '800', color: '#21314a' },
  historyMeta: { marginTop: 3, fontSize: 12, color: '#66748a' },
  timeText: { fontSize: 11, color: '#8a96a7' },
  emptyRow: { padding: 20, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#33435a' },
  emptyText: { marginTop: 4, fontSize: 12, color: '#7a8798' },
  inlineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  resultHero: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe5ed', borderRadius: 18, padding: 16 },
  resultHeroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resultTag: { marginTop: 5, fontSize: 21, fontWeight: '900', color: '#172238' },
  resultName: { marginTop: 2, fontSize: 15, fontWeight: '700', color: '#46556c' },
  resultMeta: { marginTop: 10, fontSize: 13, color: '#6b788b' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeSuccess: { backgroundColor: '#e5f5ec' },
  badgeDanger: { backgroundColor: '#fde9ea' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#35546a' },
  infoCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe5ed', borderRadius: 16, overflow: 'hidden' },
  infoTitle: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '800', color: '#26364d', borderBottomWidth: 1, borderBottomColor: '#edf0f4' },
  infoRow: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#edf0f4' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#7a8799' },
  infoValue: { marginTop: 3, fontSize: 13, fontWeight: '700', color: '#34445b' },
  mutedBody: { padding: 14, fontSize: 13, color: '#6c788a' },
  updatedCard: { padding: 14, borderRadius: 14, backgroundColor: '#edf3ff' },
  updatedTitle: { fontSize: 12, fontWeight: '800', color: '#2b4f94' },
  updatedText: { marginTop: 4, fontSize: 11, lineHeight: 17, color: '#5f7194' },
  errorScreen: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fde9ea', alignItems: 'center', justifyContent: 'center' },
  errorIconText: { fontSize: 28, fontWeight: '900', color: '#b3444c' },
  errorTitle: { marginTop: 16, fontSize: 22, fontWeight: '800', color: '#172238', textAlign: 'center' },
  errorBody: { marginTop: 8, marginBottom: 20, fontSize: 14, lineHeight: 21, color: '#66748a', textAlign: 'center' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dde3ec', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10, gap: 8 },
  navButton: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navButtonActive: { backgroundColor: '#edf3ff' },
  navText: { fontSize: 12, fontWeight: '700', color: '#7b8798' },
  navTextActive: { color: '#2c63dc' },
});
