import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOEditorFooter,
  INNOIcon,
  INNOPage,
  INNOPagination,
  INNOPurposeNote,
  INNOResourceHeader,
  INNOResourceSummary,
  INNOResourceSummaryItem,
  INNOSearchField,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOTableWrap,
  INNOToolbarSpacer,
} from '@inno/ui';
import {
  acknowledgeAllDeviceAlerts,
  acknowledgeDeviceAlert,
  createDeviceAlertRule,
  getDeviceAlertChannels,
  getDeviceAlertHistory,
  getDeviceAlertRule,
  getDeviceAlertRules,
  getDeviceAlerts,
  getDeviceGroups,
  testDeviceAlertChannels,
  updateDeviceAlertChannels,
  updateDeviceAlertRule,
} from '../api/client';
import type {
  AlertChannelConfig,
  DeviceAlertItem,
  DeviceAlertRule,
} from '../api/types';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value));
}

function severityTone(severity: DeviceAlertItem['severity'] | DeviceAlertRule['severity']) {
  if (severity === 'critical') return 'danger' as const;
  if (severity === 'warning') return 'warning' as const;
  return 'info' as const;
}

function statusTone(status: string) {
  if (status === 'acknowledged' || status === 'enabled' || status === 'healthy') return 'success' as const;
  if (status === 'open' || status === 'not_configured') return 'warning' as const;
  if (status === 'resolved') return 'neutral' as const;
  return 'neutral' as const;
}

function AlertSubnav() {
  return (
    <nav className="section-subnav" aria-label="Alert sections">
      <NavLink end to="/devices/alerts">Active Alerts</NavLink>
      <NavLink to="/devices/alerts/rules">Rules</NavLink>
      <NavLink to="/devices/alerts/channels">Channels</NavLink>
      <NavLink to="/devices/alerts/history">History</NavLink>
    </nav>
  );
}

function AlertPageShell(props: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="inno-page">
      <INNOResourceHeader
        icon={<INNOIcon token="section.attention" size={20} />}
        title={props.title}
        meta={<span>{props.description}</span>}
        actions={props.actions}
      />
      <AlertSubnav />
      {props.children}
    </main>
  );
}

export function DeviceAlertsPage() {
  const canManage = usePermission('devices.alert.manage');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const query = useQuery({
    queryKey: ['devices', 'active-alerts', search, severity],
    queryFn: () => getDeviceAlerts(1, 100, { search, severity }),
    refetchInterval: 30_000,
  });

  const acknowledge = useMutation({
    mutationFn: acknowledgeDeviceAlert,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices', 'active-alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['devices', 'alert-history'] });
      await queryClient.invalidateQueries({ queryKey: ['devices', 'overview'] });
    },
  });
  const acknowledgeAll = useMutation({
    mutationFn: acknowledgeAllDeviceAlerts,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices', 'active-alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['devices', 'alert-history'] });
    },
  });

  const items = query.data?.items ?? [];
  const critical = items.filter((item) => item.severity === 'critical').length;
  const warning = items.filter((item) => item.severity === 'warning').length;
  const acknowledged = items.filter((item) => item.status === 'acknowledged').length;

  return (
    <AlertPageShell
      title="Active Alerts"
      description="Monitor current fleet conditions backed by Device evidence. Alert rules and delivery configuration are kept in separate screens."
      actions={canManage ? (
        <>
          <INNOButton
            variant="secondary"
            busy={acknowledgeAll.isPending}
            disabled={!items.some((item) => item.status === 'open')}
            onClick={() => acknowledgeAll.mutate()}
          >
            Acknowledge all
          </INNOButton>
          <Link to="/devices/alerts/rules/new"><INNOButton>New Rule</INNOButton></Link>
        </>
      ) : undefined}
    >
      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Active alerts" value={String(query.data?.totalItems ?? 0)} detail={critical + ' critical · ' + warning + ' warning in current result'} />
        <INNOResourceSummaryItem label="Critical" value={String(critical)} detail="Requires immediate operator review" />
        <INNOResourceSummaryItem label="Warning" value={String(warning)} detail="Current warning conditions" />
        <INNOResourceSummaryItem label="Acknowledged" value={String(acknowledged)} detail="Still active but operator acknowledged" />
      </INNOResourceSummary>

      <INNOCollection>
        <INNOCollectionHeader title="Alert Queue" description="Search and act on current, non-resolved alerts only." />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search alerts" value={search} onChange={setSearch} placeholder="Search alert condition…" />
          <INNOSelectField label="Severity" value={severity} onChange={setSeverity}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="information">Information</option>
          </INNOSelectField>
          <INNOToolbarSpacer />
        </INNOCollectionToolbar>

        {query.isPending ? (
          <LoadingState label="Loading active alerts…" />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <INNOCollectionState
            kind={search || severity !== 'all' ? 'no-results' : 'empty'}
            title={search || severity !== 'all' ? 'No alerts match these filters' : 'No active alerts'}
            description={search || severity !== 'all'
              ? 'Change the search or severity filter.'
              : 'No evidence-backed alert condition is currently active in your effective scope.'}
          />
        ) : (
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>Severity</th><th>Alert</th><th>Scope / Device</th><th>Detected</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><INNOStatus tone={severityTone(item.severity)}>{item.severity}</INNOStatus></td>
                    <td><b>{item.title}</b><div className="table-meta">{item.detail}</div></td>
                    <td>{item.scopeLabel}</td>
                    <td>{formatDate(item.detectedAt)}</td>
                    <td><INNOStatus tone={statusTone(item.status)}>{item.status}</INNOStatus></td>
                    <td className="action-column">
                      {canManage && item.status === 'open' ? (
                        <INNOButton
                          variant="secondary"
                          busy={acknowledge.isPending && acknowledge.variables === item.id}
                          onClick={() => acknowledge.mutate(item.id)}
                        >
                          Acknowledge
                        </INNOButton>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        )}
      </INNOCollection>

      <INNOPurposeNote
        title="Evidence-backed alerts only"
        description="Connectivity rules can evaluate immediately from current Device state. Hardware, software, and baseline rules remain silent until comparable trusted observations exist; INNO.One does not invent drift events."
      />
    </AlertPageShell>
  );
}

export function DeviceAlertRulesPage() {
  const canManage = usePermission('devices.alert.manage');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const query = useQuery({
    queryKey: ['devices', 'alert-rules', page, search, severity],
    queryFn: () => getDeviceAlertRules(page, 25, { search, severity }),
  });

  return (
    <AlertPageShell
      title="Alert Rules"
      description="Define fleet alert conditions separately from the current alert queue."
      actions={canManage ? <Link to="/devices/alerts/rules/new"><INNOButton>New Rule</INNOButton></Link> : undefined}
    >
      <INNOCollection>
        <INNOCollectionHeader title="Rules" description="Each rule owns its condition, scope, severity, channels, and enabled state." />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search rules" value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search rules…" />
          <INNOSelectField label="Severity" value={severity} onChange={(value) => { setSeverity(value); setPage(1); }}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="information">Information</option>
          </INNOSelectField>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <LoadingState label="Loading alert rules…" />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : query.data.items.length === 0 ? (
          <INNOCollectionState kind="empty" title="No alert rules" description="Create a rule to evaluate an evidence-backed Device condition." />
        ) : (
          <>
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>Rule</th><th>Type</th><th>Scope</th><th>Severity</th><th>Channels</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {query.data.items.map((rule) => (
                    <tr key={rule.id}>
                      <td><b>{rule.name}</b><div className="table-meta">{rule.description ?? rule.code}</div></td>
                      <td>{rule.ruleType.replaceAll('_', ' ')}</td>
                      <td>{rule.scopeType.replaceAll('_', ' ')}</td>
                      <td><INNOStatus tone={severityTone(rule.severity)}>{rule.severity}</INNOStatus></td>
                      <td>{rule.channels.length ? rule.channels.join(' · ') : 'None'}</td>
                      <td><INNOStatus tone={rule.status === 'enabled' ? 'success' : 'neutral'}>{rule.status}</INNOStatus></td>
                      <td className="action-column"><Link to={'/devices/alerts/rules/' + rule.id}>{canManage ? 'Edit' : 'View'}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={query.data.page}
              pageSize={query.data.pageSize}
              totalItems={query.data.totalItems}
              totalPages={query.data.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </INNOCollection>
    </AlertPageShell>
  );
}

function getNumber(configuration: Record<string, unknown>, key: string, fallback: number) {
  const value = configuration[key];
  return typeof value === 'number' ? value : fallback;
}

export function DeviceAlertRuleEditorPage() {
  const { ruleId } = useParams();
  const isNew = !ruleId;
  const canManage = usePermission('devices.alert.manage');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const groups = useQuery({
    queryKey: ['device-groups', 'alert-rule-picker'],
    queryFn: () => getDeviceGroups({ page: 1, pageSize: 100, type: 'static', status: 'active' }),
  });
  const rule = useQuery({
    queryKey: ['devices', 'alert-rule', ruleId],
    queryFn: () => getDeviceAlertRule(ruleId!),
    enabled: Boolean(ruleId),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleType, setRuleType] = useState<DeviceAlertRule['ruleType']>('offline_anomaly');
  const [severity, setSeverity] = useState<DeviceAlertRule['severity']>('critical');
  const [scopeType, setScopeType] = useState<DeviceAlertRule['scopeType']>('all_groups');
  const [scopeId, setScopeId] = useState('');
  const [status, setStatus] = useState<DeviceAlertRule['status']>('enabled');
  const [threshold, setThreshold] = useState(30);
  const [minimum, setMinimum] = useState(1);
  const [consoleChannel, setConsoleChannel] = useState(true);
  const [soundChannel, setSoundChannel] = useState(false);
  const [emailChannel, setEmailChannel] = useState(false);

  useEffect(() => {
    if (!rule.data) return;
    setName(rule.data.name);
    setDescription(rule.data.description ?? '');
    setRuleType(rule.data.ruleType);
    setSeverity(rule.data.severity);
    setScopeType(rule.data.scopeType);
    setScopeId(rule.data.scopeId ?? '');
    setStatus(rule.data.status);
    setThreshold(getNumber(rule.data.configuration, 'offlineThresholdPercent', 30));
    setMinimum(getNumber(rule.data.configuration, 'minimumAffectedDevices', 1));
    setConsoleChannel(rule.data.channels.includes('console'));
    setSoundChannel(rule.data.channels.includes('sound'));
    setEmailChannel(rule.data.channels.includes('email'));
  }, [rule.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const configuration: Record<string, unknown> = ruleType === 'offline_anomaly'
        ? {
            evaluationWindowMinutes: 10,
            baseline: 'current_scope',
            offlineThresholdPercent: threshold,
            minimumAffectedDevices: minimum,
          }
        : ruleType === 'hardware_change'
          ? { detect: ['added', 'removed', 'version_changed'] }
          : ruleType === 'software_change'
            ? { detect: ['added', 'removed', 'version_changed'], ignoreApprovedDeployments: true }
            : { evidenceRequired: true };

      const input = {
        name,
        description,
        ruleType,
        severity,
        scopeType,
        scopeId: scopeType === 'device_group' ? scopeId : undefined,
        configuration,
        channels: [
          ...(consoleChannel ? ['console'] : []),
          ...(soundChannel ? ['sound'] : []),
          ...(emailChannel ? ['email'] : []),
        ],
        status,
      };

      return isNew ? createDeviceAlertRule(input) : updateDeviceAlertRule(ruleId!, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices', 'alert-rules'] });
      navigate('/devices/alerts/rules');
    },
  });

  if (!isNew && rule.isPending) return <main className="inno-page"><LoadingState label="Loading alert rule…" /></main>;
  if (!isNew && rule.isError) return <main className="inno-page"><ErrorState error={rule.error} retry={() => void rule.refetch()} /></main>;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !name.trim() || (scopeType === 'device_group' && !scopeId)) return;
    mutation.mutate();
  }

  return (
    <AlertPageShell
      title={isNew ? 'New Alert Rule' : name || 'Alert Rule'}
      description={isNew ? 'Create one evidence-backed alert condition.' : 'Review and update this alert rule.'}
    >
      <form className="editor-form" onSubmit={submit}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Rule definition</h3><p>Choose the evidence condition, scope, severity and delivery channels.</p></div></div>
          <div className="editor-grid">
            <label className="field-block"><span>Rule name</span><input required disabled={!canManage} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field-block"><span>Rule type</span><select disabled={!canManage} value={ruleType} onChange={(event) => {
              const next = event.target.value as DeviceAlertRule['ruleType'];
              setRuleType(next);
              if (next === 'offline_anomaly') setScopeType('all_groups');
              else setScopeType('all_devices');
            }}>
              <option value="offline_anomaly">Offline anomaly</option>
              <option value="hardware_change">Hardware change</option>
              <option value="software_change">Software inventory change</option>
              <option value="baseline_drift">Asset baseline drift</option>
            </select></label>
            <label className="field-block"><span>Severity</span><select disabled={!canManage} value={severity} onChange={(event) => setSeverity(event.target.value as DeviceAlertRule['severity'])}>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="information">Information</option>
            </select></label>
            <label className="field-block"><span>Scope</span><select disabled={!canManage} value={scopeType} onChange={(event) => setScopeType(event.target.value as DeviceAlertRule['scopeType'])}>
              {ruleType === 'offline_anomaly' ? <option value="all_groups">All Device Groups</option> : <option value="all_devices">All managed devices</option>}
              <option value="device_group">Device Group</option>
            </select></label>
            {scopeType === 'device_group' ? (
              <label className="field-block"><span>Device Group</span><select required disabled={!canManage || groups.isPending} value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                <option value="">Select a group</option>
                {groups.data?.items.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select></label>
            ) : null}
            <label className="field-block"><span>Status</span><select disabled={!canManage} value={status} onChange={(event) => setStatus(event.target.value as DeviceAlertRule['status'])}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select></label>
          </div>
          <label className="field-block"><span>Description</span><textarea disabled={!canManage} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        </section>

        {ruleType === 'offline_anomaly' ? (
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Condition</h3><p>Trigger when the observed offline percentage crosses this evidence threshold.</p></div></div>
            <div className="editor-grid">
              <label className="field-block"><span>Offline threshold (%)</span><input type="number" min={1} max={100} disabled={!canManage} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
              <label className="field-block"><span>Minimum affected devices</span><input type="number" min={1} disabled={!canManage} value={minimum} onChange={(event) => setMinimum(Number(event.target.value))} /></label>
            </div>
          </section>
        ) : (
          <INNOState
            banner
            kind="partial"
            title="Comparison evidence required"
            description="This rule is enabled for evaluation, but INNO.One does not create a hardware, software, or baseline drift alert until comparable trusted observations exist."
          />
        )}

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Channels</h3><p>Select configured Product channels for this rule.</p></div></div>
          <div className="device-live-actions">
            <label><input type="checkbox" disabled={!canManage} checked={consoleChannel} onChange={(event) => setConsoleChannel(event.target.checked)} /> Console</label>
            <label><input type="checkbox" disabled={!canManage} checked={soundChannel} onChange={(event) => setSoundChannel(event.target.checked)} /> Sound</label>
            <label><input type="checkbox" disabled={!canManage} checked={emailChannel} onChange={(event) => setEmailChannel(event.target.checked)} /> Email</label>
          </div>
        </section>

        {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        {canManage ? (
          <INNOEditorFooter>
            <Link to="/devices/alerts/rules"><INNOButton type="button" variant="secondary">Cancel</INNOButton></Link>
            <INNOButton type="submit" busy={mutation.isPending}>{isNew ? 'Create Rule' : 'Save Rule'}</INNOButton>
          </INNOEditorFooter>
        ) : null}
      </form>
    </AlertPageShell>
  );
}

function configString(channel: AlertChannelConfig, key: string, fallback = '') {
  const value = channel.configuration[key];
  return typeof value === 'string' ? value : fallback;
}

function configStringArray(channel: AlertChannelConfig, key: string) {
  const value = channel.configuration[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function DeviceAlertChannelsPage() {
  const canManage = usePermission('devices.alert.manage');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['devices', 'alert-channels'],
    queryFn: getDeviceAlertChannels,
  });
  const [consoleEnabled, setConsoleEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [minimumSeverity, setMinimumSeverity] = useState('warning');
  const [recipients, setRecipients] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setConsoleEnabled(query.data.console.enabled);
    setSoundEnabled(query.data.sound.enabled);
    setEmailEnabled(query.data.email.enabled);
    setMinimumSeverity(configString(query.data.email, 'minimumSeverity', 'warning'));
    setRecipients(configStringArray(query.data.email, 'recipients').join(', '));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => updateDeviceAlertChannels({
      console: {
        enabled: consoleEnabled,
        configuration: { showSymbol: true, showToast: true, alertCenter: true },
      },
      sound: {
        enabled: soundEnabled,
        configuration: { minimumSeverity: 'warning', criticalSound: 'Critical Pulse', warningSound: 'System Alert' },
      },
      email: {
        enabled: emailEnabled,
        configuration: {
          recipients: recipients.split(',').map((value) => value.trim()).filter(Boolean),
          delivery: 'immediate',
          minimumSeverity,
        },
      },
    }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['devices', 'alert-channels'], updated);
    },
  });
  const test = useMutation({
    mutationFn: testDeviceAlertChannels,
  });

  if (query.isPending) return <main className="inno-page"><LoadingState label="Loading alert channels…" /></main>;
  if (query.isError) return <main className="inno-page"><ErrorState error={query.error} retry={() => void query.refetch()} /></main>;

  return (
    <AlertPageShell
      title="Alert Channels"
      description="Configure Product-owned alert delivery surfaces without implying an external provider is connected."
      actions={canManage ? <INNOButton variant="secondary" busy={test.isPending} onClick={() => test.mutate()}>Test Alert Channels</INNOButton> : undefined}
    >
      <form className="editor-form" onSubmit={(event) => { event.preventDefault(); if (canManage) save.mutate(); }}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Console</h3><p>Alert Center, symbol, and in-Product toast delivery.</p></div><INNOStatus tone={statusTone(query.data.console.status)}>{query.data.console.status}</INNOStatus></div>
          <label className="field-block"><span>Console alerts</span><select disabled={!canManage} value={consoleEnabled ? 'enabled' : 'disabled'} onChange={(event) => setConsoleEnabled(event.target.value === 'enabled')}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Sound</h3><p>Audible notification inside the supported Product surface.</p></div><INNOStatus tone={statusTone(query.data.sound.status)}>{query.data.sound.status}</INNOStatus></div>
          <label className="field-block"><span>Sound alerts</span><select disabled={!canManage} value={soundEnabled ? 'enabled' : 'disabled'} onChange={(event) => setSoundEnabled(event.target.value === 'enabled')}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Email</h3><p>Email remains Not configured until recipients exist. Step45X does not fabricate external mail delivery.</p></div><INNOStatus tone={statusTone(query.data.email.status)}>{query.data.email.status}</INNOStatus></div>
          <div className="editor-grid">
            <label className="field-block"><span>Email alerts</span><select disabled={!canManage} value={emailEnabled ? 'enabled' : 'disabled'} onChange={(event) => setEmailEnabled(event.target.value === 'enabled')}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
            <label className="field-block"><span>Minimum severity</span><select disabled={!canManage} value={minimumSeverity} onChange={(event) => setMinimumSeverity(event.target.value)}><option value="critical">Critical</option><option value="warning">Warning</option><option value="information">Information</option></select></label>
          </div>
          <label className="field-block"><span>Recipients</span><input disabled={!canManage} value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="ops@example.com, security@example.com" /></label>
        </section>

        {test.data ? (
          <INNOState
            banner
            kind="partial"
            title={test.data.status === 'succeeded' ? 'Configured channels passed the Product check' : 'Some configured channels are unavailable'}
            description={test.data.unavailableChannels.length ? 'Unavailable: ' + test.data.unavailableChannels.join(', ') : 'All enabled channels have the configuration required by the Product.'}
          />
        ) : null}
        {save.isError ? <ErrorState error={save.error} /> : null}
        {test.isError ? <ErrorState error={test.error} /> : null}
        {canManage ? <INNOEditorFooter><INNOButton type="submit" busy={save.isPending}>Save Channels</INNOButton></INNOEditorFooter> : null}
      </form>
    </AlertPageShell>
  );
}

export function DeviceAlertHistoryPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['devices', 'alert-history', page],
    queryFn: () => getDeviceAlertHistory(page, 25),
  });

  return (
    <AlertPageShell
      title="Alert History"
      description="Review acknowledgement, resolution, and Product delivery history without mixing it into the active alert queue."
    >
      {query.isPending ? (
        <LoadingState label="Loading alert history…" />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <INNOCollectionState kind="empty" title="No alert history" description="Alert lifecycle and delivery events appear here as they occur." />
      ) : (
        <INNOCollection>
          <INNOCollectionHeader title="Alert events" description="Acknowledgements, resolved conditions, and channel delivery attempts." />
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>Time</th><th>Alert</th><th>Severity</th><th>Scope / Device</th><th>Event</th><th>Channels</th><th>Operator</th><th>Result</th></tr></thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.occurredAt)}</td>
                    <td><b>{item.title}</b></td>
                    <td><INNOStatus tone={severityTone(item.severity)}>{item.severity}</INNOStatus></td>
                    <td>{item.scopeLabel}</td>
                    <td>{item.eventType}</td>
                    <td>{item.channels.length ? item.channels.join(' · ') : '—'}</td>
                    <td>{item.operatorName ?? '—'}</td>
                    <td>{item.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
          <INNOPagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            totalItems={query.data.totalItems}
            totalPages={query.data.totalPages}
            onPageChange={setPage}
          />
        </INNOCollection>
      )}
    </AlertPageShell>
  );
}
