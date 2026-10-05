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
import {
  getMobileProfile,
  MobileApiError,
  resolveAssetQr,
  setMobilePreferredLocale,
} from './src/api';
import { config, discovery } from './src/config';
import { readRecentScans, saveRecentScan } from './src/history';
import {
  deviceLocale,
  formatDate,
  formatRelativeTime,
  translate,
  type Locale,
  type MessageKey,
} from './src/i18n';
import type { RecentScan, ResolvedAsset, TokenSession } from './src/types';

WebBrowser.maybeCompleteAuthSession();

const SESSION_KEY = 'inno-one-assets.oidc-session.v1';
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'innoone-assets',
  path: 'oauth',
});

type MainView = 'scanner' | 'history' | 'result' | 'error';

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
  const [locale, setLocale] = useState<Locale>(() => deviceLocale());
  const [profileWarning, setProfileWarning] = useState('');
  const [localeSaving, setLocaleSaving] = useState(false);

  const tx = useCallback(
    (key: MessageKey) => translate(locale, key),
    [locale],
  );

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
        setErrorMessage('');
        setSession(nextSession);
      })
      .catch(() => {
        setErrorMessage(translate(locale, 'signInError'));
        setView('error');
      });
  }, [locale, request?.codeVerifier, response]);

  const getAccessToken = useCallback(async () => {
    if (!session) {
      throw new MobileApiError(401, translate(locale, 'signInRequired'));
    }
    if (isSessionFresh(session)) return session.accessToken;

    if (!session.refreshToken) {
      await persistSession(null);
      setSession(null);
      throw new MobileApiError(401, translate(locale, 'sessionExpired'));
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
      throw new MobileApiError(401, translate(locale, 'sessionExpired'));
    }
  }, [locale, session]);

  useEffect(() => {
    if (!session) {
      setProfileWarning('');
      return;
    }

    let cancelled = false;
    void getAccessToken()
      .then((accessToken) => getMobileProfile(accessToken, locale))
      .then((profile) => {
        if (cancelled) return;
        setLocale(profile.locale);
        setProfileWarning('');
      })
      .catch(() => {
        if (cancelled) return;
        setProfileWarning(translate(locale, 'profileOffline'));
      });

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, locale, session]);

  const changeLocale = useCallback(async () => {
    const next: Locale = locale === 'th-TH' ? 'en-US' : 'th-TH';
    setLocaleSaving(true);
    try {
      const accessToken = await getAccessToken();
      const profile = await setMobilePreferredLocale(accessToken, next);
      setLocale(profile.locale);
      setProfileWarning('');
    } catch {
      setProfileWarning(translate(locale, 'profileSaveError'));
    } finally {
      setLocaleSaving(false);
    }
  }, [getAccessToken, locale]);

  const resolveToken = useCallback(async (token: string) => {
    if (scanBusy || !scannerArmed) return;
    setScanBusy(true);
    setScannerArmed(false);
    try {
      const accessToken = await getAccessToken();
      const asset = await resolveAssetQr(token, accessToken, locale);
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
          : translate(locale, 'genericQrError'),
      );
      setView('error');
    } finally {
      setScanBusy(false);
    }
  }, [getAccessToken, locale, scanBusy, scannerArmed]);

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
    setProfileWarning('');
    setErrorMessage('');
    setLocale(deviceLocale());
  }, []);

  if (restoring) {
    return (
      <SafeAreaView style={styles.boot}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" />
        <Text style={styles.bootText}>{tx('boot')}</Text>
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
          <Text style={styles.signInTitle}>{tx('signInTitle')}</Text>
          <Text style={styles.signInBody}>{tx('signInBody')}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!request}
            style={({ pressed }) => [
              styles.primaryButton,
              (!request || pressed) && styles.buttonPressed,
            ]}
            onPress={() => {
              setErrorMessage('');
              void promptAsync();
            }}
          >
            <Text style={styles.primaryButtonText}>{tx('signIn')}</Text>
          </Pressable>
          {errorMessage ? <Text style={styles.signInError}>{errorMessage}</Text> : null}
          <Text style={styles.securityNote}>{tx('securityNote')}</Text>
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
            <Text style={styles.headerSub}>{tx('headerSub')}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('language')}
            disabled={localeSaving}
            style={styles.languageButton}
            onPress={() => void changeLocale()}
          >
            <Text style={styles.languageButtonText}>{locale === 'th-TH' ? 'EN' : 'TH'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void signOut()}>
            <Text style={styles.signOut}>{tx('signOut')}</Text>
          </Pressable>
        </View>
      </View>

      {profileWarning ? (
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerText}>{profileWarning}</Text>
        </View>
      ) : null}

      {view === 'scanner' ? (
        <ScannerScreen
          locale={locale}
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
        <HistoryScreen locale={locale} items={recentScans} onScan={scanAgain} />
      ) : null}

      {view === 'result' && resolvedAsset ? (
        <ResultScreen locale={locale} asset={resolvedAsset} onScanAgain={scanAgain} />
      ) : null}

      {view === 'error' ? (
        <ErrorScreen locale={locale} message={errorMessage} onScanAgain={scanAgain} />
      ) : null}

      {view === 'scanner' || view === 'history' ? (
        <View style={styles.bottomNav}>
          <Pressable
            accessibilityRole="button"
            style={[styles.navButton, view === 'scanner' && styles.navButtonActive]}
            onPress={() => setView('scanner')}
          >
            <Text style={[styles.navText, view === 'scanner' && styles.navTextActive]}>{tx('scanNav')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.navButton, view === 'history' && styles.navButtonActive]}
            onPress={() => setView('history')}
          >
            <Text style={[styles.navText, view === 'history' && styles.navTextActive]}>{tx('historyNav')}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
function ScannerScreen(props: {
  locale: Locale;
  permission: boolean;
  canAskPermission: boolean;
  requestPermission: () => void;
  busy: boolean;
  armed: boolean;
  onScan: (data: string) => void;
  history: RecentScan[];
  onHistory: () => void;
}) {
  const tx = (key: MessageKey) => translate(props.locale, key);
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.eyebrow}>{tx('scannerEyebrow')}</Text>
      <Text style={styles.screenTitle}>{tx('scannerTitle')}</Text>
      <Text style={styles.screenBody}>{tx('scannerBody')}</Text>

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
              <View style={styles.cameraBadge}><Text style={styles.cameraBadgeText}>{tx('qrTokenOnly')}</Text></View>
            </View>
          </CameraView>
        ) : (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>{tx('cameraPermissionTitle')}</Text>
            <Text style={styles.permissionBody}>{tx('cameraPermissionBody')}</Text>
            {props.canAskPermission ? (
              <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={props.requestPermission}>
                <Text style={styles.primaryButtonText}>{tx('cameraPermissionAllow')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.permissionBody}>{tx('cameraPermissionSettings')}</Text>
            )}
          </View>
        )}
        {props.busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.busyText}>{tx('checkingToken')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.secureLine}>
        <Text style={styles.secureDot}>●</Text>
        <Text style={styles.secureText}>{tx('secureNote')}</Text>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{tx('recentScans')}</Text>
          <Text style={styles.sectionSub}>{tx('onThisDevice')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={props.onHistory}>
          <Text style={styles.linkText}>{tx('viewAll')}</Text>
        </Pressable>
      </View>

      <View style={styles.listCard}>
        {props.history.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyTitle}>{tx('noRecent')}</Text>
            <Text style={styles.emptyText}>{tx('noRecentBody')}</Text>
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
            <Text style={styles.timeText}>{formatRelativeTime(props.locale, item.scannedAt)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function HistoryScreen(props: {
  locale: Locale;
  items: RecentScan[];
  onScan: () => void;
}) {
  const tx = (key: MessageKey) => translate(props.locale, key);
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.inlineHeader}>
        <View>
          <Text style={styles.eyebrow}>{tx('historyEyebrow')}</Text>
          <Text style={styles.screenTitle}>{tx('historyTitle')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={props.onScan}><Text style={styles.linkText}>{tx('scanAgain')}</Text></Pressable>
      </View>
      <Text style={styles.screenBody}>{tx('historyBody')}</Text>
      <View style={styles.listCard}>
        {props.items.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyTitle}>{tx('noHistory')}</Text>
            <Text style={styles.emptyText}>{tx('noHistoryBody')}</Text>
          </View>
        ) : props.items.map((item, index) => (
          <View key={item.assetId} style={[styles.historyRow, index > 0 && styles.rowDivider]}>
            <View style={styles.historyMain}>
              <Text style={styles.assetTag}>{item.assetTag}</Text>
              <Text style={styles.historyMeta}>{item.name}</Text>
              <Text style={styles.historyMeta}>{item.brandModel || '—'}{item.owner ? ' · ' + item.owner : ''}</Text>
            </View>
            <Text style={styles.timeText}>{formatRelativeTime(props.locale, item.scannedAt)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ResultScreen(props: { locale: Locale; asset: ResolvedAsset; onScanAgain: () => void }) {
  const { asset } = props;
  const tx = (key: MessageKey) => translate(props.locale, key);
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
            <Text style={styles.eyebrow}>{tx('assetFound')}</Text>
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

      <InfoSection title={tx('assetOverview')}>
        <InfoRow label={tx('category')} value={asset.category} />
        <InfoRow label={tx('serial')} value={asset.serialNumber ?? '—'} />
        <InfoRow label={tx('owner')} value={asset.owner?.name ?? tx('unassigned')} />
        <InfoRow label={tx('organization')} value={asset.organization?.name ?? '—'} />
        <InfoRow label={tx('location')} value={asset.location?.name ?? '—'} />
        <InfoRow
          label={tx('warranty')}
          value={asset.warrantyEndAt ? tx('warrantyUntil') + ' ' + formatDate(props.locale, asset.warrantyEndAt) : tx('noData')}
        />
      </InfoSection>

      <InfoSection title={tx('managedEndpoint')}>
        {asset.linkedDevice ? (
          <>
            <InfoRow label={tx('device')} value={asset.linkedDevice.name} />
            <InfoRow label={tx('status')} value={asset.linkedDevice.status} />
            <InfoRow label={tx('operatingSystem')} value={asset.linkedDevice.operatingSystem ?? '—'} />
          </>
        ) : (
          <Text style={styles.mutedBody}>{tx('noManagedEndpoint')}</Text>
        )}
      </InfoSection>

      {customFields.length > 0 ? (
        <InfoSection title={tx('additionalInformation')}>
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
        <Text style={styles.updatedTitle}>{tx('latestData')}</Text>
        <Text style={styles.updatedText}>
          {tx('scanned')} {formatDate(props.locale, asset.scannedAt)} · {tx('assetUpdated')} {formatDate(props.locale, asset.updatedAt)}
        </Text>
      </View>

      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={props.onScanAgain}>
        <Text style={styles.primaryButtonText}>{tx('scanAgain')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function ErrorScreen(props: { locale: Locale; message: string; onScanAgain: () => void }) {
  const tx = (key: MessageKey) => translate(props.locale, key);
  return (
    <View style={styles.errorScreen}>
      <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
      <Text style={styles.errorTitle}>{tx('errorTitle')}</Text>
      <Text style={styles.errorBody}>{props.message}</Text>
      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={props.onScanAgain}>
        <Text style={styles.primaryButtonText}>{tx('scanAgain')}</Text>
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
  signInError: { fontSize: 12, lineHeight: 18, color: '#b3444c', textAlign: 'center' },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#2c63dc', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.65 },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e7ef' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#172238' },
  headerSub: { fontSize: 11, color: '#7a8799', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  languageButton: { minWidth: 38, height: 32, borderRadius: 9, borderWidth: 1, borderColor: '#d8e0eb', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  languageButtonText: { fontSize: 11, fontWeight: '800', color: '#2c63dc' },
  signOut: { fontSize: 12, fontWeight: '700', color: '#56657a' },
  warningBanner: { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#fff7df', borderBottomWidth: 1, borderBottomColor: '#f0dfaa' },
  warningBannerText: { fontSize: 11, lineHeight: 17, color: '#725b18' },
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
