import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AgentApiError,
  createHelpRequest,
  decideConsent,
  getDeviceContext,
  getMachineAgentContext,
  getOwnershipContext,
  getPendingConsent,
  getPendingPrompt,
  respondToPrompt,
  submitOwnership,
  submitTelemetry,
  type AgentPrompt,
  type ConsentRequest,
  type DeviceContext,
  type OwnershipContext,
  type Profile,
} from './api';
import { translate, type Locale } from './i18n';
import {
  collectHardwareTelemetry,
  collectNetworkTelemetry,
  collectPerformanceTelemetry,
  collectSoftwareInventory,
  isNativeAgentRuntime,
} from './telemetry';
import './styles.css';

type View = 'home' | 'help' | 'ownership';

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [device, setDevice] = useState<DeviceContext | null>(null);
  const [ownership, setOwnership] = useState<OwnershipContext | null>(null);
  const [ownershipUnavailable, setOwnershipUnavailable] = useState(false);
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [consent, setConsent] = useState<ConsentRequest | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [prompt, setPrompt] = useState<AgentPrompt | null>(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const locale: Locale = profile?.locale === 'en-US' ? 'en-US' : 'th-TH';
  const t = useCallback((key: Parameters<typeof translate>[1]) => translate(locale, key), [locale]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [machine, nextDevice] = await Promise.all([
        getMachineAgentContext(),
        getDeviceContext(),
      ]);
      const storedLocale = window.localStorage.getItem('inno-agent-locale');
      const nextLocale: Locale = storedLocale === 'en-US' ? 'en-US' : 'th-TH';
      const person = machine.owner ?? machine.ownershipSuggestion?.candidate ?? null;
      const awaitingConfirmation = machine.ownershipSuggestion?.status === 'pending';

      setProfile({
        id: person?.id ?? 'machine',
        fullName: person?.fullName
          ?? (awaitingConfirmation ? 'รอ IT ยืนยันผู้ใช้งาน' : 'ยังไม่กำหนดผู้ใช้งาน'),
        email: person?.email ?? '',
        locale: nextLocale,
        preferredLocale: nextLocale,
        organizationDefaultLocale: 'th-TH',
      });
      setDevice(nextDevice);
      setOwnership(null);
      setOwnershipUnavailable(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'REQUEST_FAILED');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.documentElement.lang = locale === 'th-TH' ? 'th' : 'en';
  }, [locale]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!device || !online) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const [request, pendingPrompt] = await Promise.all([
          getPendingConsent(),
          getPendingPrompt(),
        ]);
        if (!cancelled) {
          setConsent(request);
          setPrompt(pendingPrompt);
        }
      } catch {
        if (!cancelled) {
          setConsent(null);
          setPrompt(null);
        }
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [device, online]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!device || !online || !isNativeAgentRuntime()) return;

    let cancelled = false;
    let busy = false;
    let ticks = 0;

    const publish = async (
      includeNetwork: boolean,
      includeHardware: boolean,
      includeSoftware: boolean,
    ) => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const performance = await collectPerformanceTelemetry();
        let network = null;
        let hardware = null;
        let software = null;

        if (includeNetwork) {
          try {
            network = await collectNetworkTelemetry();
          } catch {
            network = null;
          }
        }

        if (includeHardware) {
          try {
            hardware = await collectHardwareTelemetry();
          } catch {
            hardware = null;
          }
        }

        if (includeSoftware) {
          try {
            const packages = await collectSoftwareInventory();
            software = { completeness: 'complete' as const, packages };
          } catch {
            software = null;
          }
        }

        if (cancelled) return;
        await submitTelemetry({
          observedAt: new Date().toISOString(),
          sourceInstance: device.agentVersion ?? 'endpoint-agent',
          performance,
          network,
          hardware,
          software,
        });
      } catch {
        // Telemetry is best-effort. User-facing Agent flows must remain usable.
      } finally {
        busy = false;
      }
    };

    void publish(true, true, true);
    const interval = window.setInterval(() => {
      ticks += 1;
      void publish(
        ticks % 12 === 0,
        ticks % 60 === 0,
        ticks % 360 === 0,
      );
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [device, online]);

  const switchLocale = async () => {
    if (!profile) return;
    const next: Locale = locale === 'th-TH' ? 'en-US' : 'th-TH';
    window.localStorage.setItem('inno-agent-locale', next);
    setProfile({ ...profile, locale: next, preferredLocale: next });
  };

  const navigateTo = async (nextView: View) => {
    setView(nextView);
    if (nextView !== 'ownership' || ownership || ownershipUnavailable) return;

    try {
      setOwnership(await getOwnershipContext());
      setOwnershipUnavailable(false);
    } catch (error) {
      if (error instanceof AgentApiError && error.status === 404) {
        setOwnership(null);
        setOwnershipUnavailable(true);
        return;
      }
      throw error;
    }
  };

  const answerConsent = async (decision: 'approved' | 'declined') => {
    if (!consent) return;
    setConsentBusy(true);
    try {
      await decideConsent(consent.id, decision);
      setConsent(null);
    } finally {
      setConsentBusy(false);
    }
  };

  const answerPrompt = async (responseKey: 'acknowledged' | 'accepted' | 'declined') => {
    if (!prompt) return;
    setPromptBusy(true);
    try {
      await respondToPrompt(prompt.id, responseKey);
      setPrompt(null);
    } finally {
      setPromptBusy(false);
    }
  };

  if (loading) {
    return <CenteredState title={t('loading')} body="INNO.One Agent" />;
  }

  if (loadError || !profile || !device) {
    return (
      <CenteredState
        title={t('loadError')}
        body={loadError}
        action={<button className="primary" onClick={() => void load()}>{t('retry')}</button>}
      />
    );
  }

  const secondsLeft = consent
    ? Math.max(0, Math.ceil((new Date(consent.expiresAt).getTime() - now) / 1000))
    : 0;
  const promptSecondsLeft = prompt
    ? Math.max(0, Math.ceil((new Date(prompt.expiresAt).getTime() - now) / 1000))
    : 0;

  return (
    <div className="agent-app">
      <header className="titlebar">
        <div className="brand">
          <span className="logo">I1</span>
          <div><b>INNO.<em>One</em> Agent</b><small>{t('brandSub')}</small></div>
        </div>
        <div className="title-actions">
          <span className={'connection ' + (online ? 'ok' : 'off')}><i />{online ? t('connected') : t('offline')}</span>
          <button className="ghost compact" onClick={() => void switchLocale()} aria-label={t('language')}>
            {locale === 'th-TH' ? 'EN' : 'ไทย'}
          </button>
        </div>
      </header>

      {!online ? <div className="offline-banner">{t('offline')} · {t('loadError')}</div> : null}

      <main className="content">
        {view === 'home' ? <Home profile={profile} device={device} ownership={ownership} t={t} onNavigate={(next) => void navigateTo(next)} /> : null}
        {view === 'help' ? <HelpView device={device} t={t} online={online} /> : null}
        {view === 'ownership' ? (
          <OwnershipView
            ownership={ownership}
            unavailable={ownershipUnavailable}
            t={t}
            online={online}
          />
        ) : null}
      </main>

      <nav className="bottom-nav" aria-label="Agent navigation">
        <NavButton active={view === 'home'} label={t('home')} icon="⌂" onClick={() => void navigateTo('home')} />
        <NavButton active={view === 'help'} label={t('help')} icon="?" onClick={() => void navigateTo('help')} />
        <NavButton active={view === 'ownership'} label={t('ownership')} icon="✓" onClick={() => void navigateTo('ownership')} />
      </nav>

      <footer className="footer">
        <button className="text-button" onClick={() => window.open(import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5173', '_blank')}>
          {t('portal')}
        </button>
        <span>{profile.fullName}</span>
      </footer>

      {consent ? (
        <div className="modal-backdrop" role="presentation">
          <section className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <div className="consent-brand"><span className="logo small">I1</span><b id="consent-title">{t('remoteTitle')}</b></div>
            <p>{locale === 'th-TH' ? consent.messageTh : consent.messageEn}</p>
            <div className="operator-card">
              <span className="avatar">{initials(consent.operatorName)}</span>
              <div><b>{consent.operatorName}</b><small>{consent.operatorRole ?? 'IT Support'} · {consent.mode}</small></div>
            </div>
            <div className="countdown">{t('remoteExpires')} <b>{secondsLeft}</b> {t('seconds')}</div>
            <div className="dialog-actions">
              <button className="secondary danger" disabled={consentBusy || secondsLeft === 0} onClick={() => void answerConsent('declined')}>{t('remoteDecline')}</button>
              <button className="primary" disabled={consentBusy || secondsLeft === 0} onClick={() => void answerConsent('approved')}>{t('remoteApprove')}</button>
            </div>
          </section>
        </div>
      ) : null}

      {!consent && prompt ? (
        <div className="modal-backdrop" role="presentation">
          <section className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="agent-prompt-title">
            <div className="consent-brand">
              <span className="logo small">I1</span>
              <div>
                <small>{t('promptFrom')} {prompt.sourceModule}</small>
                <b id="agent-prompt-title">{locale === 'th-TH' ? prompt.titleTh : prompt.titleEn}</b>
              </div>
            </div>
            <p>{locale === 'th-TH' ? prompt.messageTh : prompt.messageEn}</p>
            <div className="countdown">{t('remoteExpires')} <b>{promptSecondsLeft}</b> {t('seconds')}</div>
            {prompt.promptType === 'notice' ? (
              <button className="primary full" disabled={promptBusy || promptSecondsLeft === 0} onClick={() => void answerPrompt('acknowledged')}>
                {t('acknowledge')}
              </button>
            ) : (
              <div className="dialog-actions">
                <button className="secondary danger" disabled={promptBusy || promptSecondsLeft === 0} onClick={() => void answerPrompt('declined')}>{t('decline')}</button>
                <button className="primary" disabled={promptBusy || promptSecondsLeft === 0} onClick={() => void answerPrompt('accepted')}>{t('accept')}</button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Home(props: {
  profile: Profile;
  device: DeviceContext;
  ownership: OwnershipContext | null;
  t: (key: Parameters<typeof translate>[1]) => string;
  onNavigate: (view: View) => void;
}) {
  const { profile, device, ownership, t } = props;
  return (
    <>
      <section className="hero">
        <span className="eyebrow">{t('agent')}</span>
        <h1>{t('welcome')}</h1>
        <p>{t('welcomeBody')}</p>
      </section>
      <section className="device-card">
        <div className="device-heading">
          <span className="device-icon">▣</span>
          <div><b>{device.hostname}</b><small>{[device.manufacturer, device.model].filter(Boolean).join(' ')}</small></div>
          <span className="pill">{device.connectivityState}</span>
        </div>
        <div className="facts">
          <Fact label={t('os')} value={device.operatingSystem ?? '—'} />
          <Fact label={t('ip')} value={device.ipAddress ?? '—'} />
          <Fact label={t('asset')} value={ownership?.assetTag ?? device.assetReference ?? '—'} />
          <Fact label={t('agent')} value={device.agentVersion ?? '—'} />
        </div>
      </section>
      <section className="action-grid">
        <button className="action-card" onClick={() => props.onNavigate('help')}><span>?</span><div><b>{t('help')}</b><small>{profile.email}</small></div></button>
        <button className="action-card" onClick={() => props.onNavigate('ownership')}><span>✓</span><div><b>{t('ownership')}</b><small>{ownership?.assetTag ?? t('noAsset')}</small></div></button>
      </section>
    </>
  );
}

function HelpView(props: { device: DeviceContext; t: (key: Parameters<typeof translate>[1]) => string; online: boolean }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');
  const { t } = props;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await createHelpRequest({ subject, description, urgency });
      setTicket(result.data.ticketNumber);
      setSubject('');
      setDescription('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'REQUEST_FAILED');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-head"><span className="eyebrow">HELPDESK</span><h1>{t('requestHelp')}</h1><p>{t('requestHelpBody')}</p></div>
      <div className="context-line"><b>{props.device.hostname}</b><span>{props.device.operatingSystem}</span><span>{props.device.assetReference}</span></div>
      {ticket ? <div className="success-box"><b>{t('ticketCreated')}</b><span>{ticket}</span></div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <form className="form-card" onSubmit={(e) => void submit(e)}>
        <label><span>{t('subject')}</span><input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={180} /></label>
        <label><span>{t('urgency')}</span><select value={urgency} onChange={(e) => setUrgency(e.target.value)}><option value="medium">{t('normal')}</option><option value="high">{t('high')}</option></select></label>
        <label><span>{t('description')}</span><textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required /></label>
        <button className="primary" disabled={busy || !props.online}>{busy ? t('sending') : t('submit')}</button>
      </form>
    </section>
  );
}

function OwnershipView(props: {
  ownership: OwnershipContext | null;
  unavailable: boolean;
  t: (key: Parameters<typeof translate>[1]) => string;
  online: boolean;
}) {
  const { ownership, t } = props;
  const [possession, setPossession] = useState('owner');
  const [location, setLocation] = useState('');
  const [changes, setChanges] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ownership) return;
    const initial: Record<string, string | null> = {};
    ownership.fields.forEach((field) => { initial[field.key] = field.value ?? ''; });
    setChanges(initial);
  }, [ownership]);

  if (props.unavailable || !ownership) {
    return <section className="empty-state"><b>{t('noAsset')}</b></section>;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submitOwnership({ assetId: ownership.assetId, possession, location, changes });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'REQUEST_FAILED');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="page-head"><span className="eyebrow">ASSETS</span><h1>{t('ownershipTitle')}</h1><p>{t('ownershipBody')}</p></div>
      <div className="context-line"><b>{ownership.assetTag}</b><span>{ownership.assetName}</span><span>{ownership.deviceName}</span></div>
      {submitted ? <div className="success-box"><b>{t('submitted')}</b><span>{ownership.assetTag}</span></div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <form className="form-card" onSubmit={(e) => void submit(e)}>
        <fieldset className="radio-set">
          <legend>{t('possession')}</legend>
          {(['owner', 'borrowed', 'returned'] as const).map((value) => (
            <label className={possession === value ? 'selected' : ''} key={value}>
              <input type="radio" name="possession" value={value} checked={possession === value} onChange={() => setPossession(value)} />
              <span>{t(value)}</span>
            </label>
          ))}
        </fieldset>
        <label><span>{t('location')}</span><input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} /></label>
        {ownership.fields.map((field) => (
          <label key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span>
            {field.options.length ? (
              <select required={field.required} value={changes[field.key] ?? ''} onChange={(e) => setChanges({ ...changes, [field.key]: e.target.value })}>
                <option value="">—</option>{field.options.map((option) => <option key={option}>{option}</option>)}
              </select>
            ) : (
              <input required={field.required} value={changes[field.key] ?? ''} onChange={(e) => setChanges({ ...changes, [field.key]: e.target.value })} />
            )}
          </label>
        ))}
        <button className="primary" disabled={busy || submitted || !props.online}>{busy ? t('sending') : t('confirm')}</button>
      </form>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><b>{value}</b></div>;
}

function NavButton(props: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={props.active ? 'active' : ''} onClick={props.onClick}><span>{props.icon}</span><small>{props.label}</small></button>;
}

function CenteredState(props: { title: string; body?: string; action?: React.ReactNode }) {
  return <div className="centered-state"><span className="logo large">I1</span><h1>{props.title}</h1>{props.body ? <p>{props.body}</p> : null}{props.action}</div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
