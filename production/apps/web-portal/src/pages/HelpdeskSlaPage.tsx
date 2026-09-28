import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOEditorFooter, INNOPage, INNOState, INNOStatus } from '@inno/ui';
import {
  getSlaMonitor,
  getSlaPolicies,
  updateSlaPolicy,
} from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { SlaEscalationLevel, SlaPolicy } from '../api/types';

function minutesLabel(minutes: number) {
  if (minutes < 60) return minutes + ' min';
  const hours = minutes / 60;
  return Number.isInteger(hours) ? hours + ' hours' : hours.toFixed(1) + ' hours';
}

function SwitchRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div><b>{title}</b><span>{description}</span></div>
      <button
        type="button"
        className={'production-switch ' + (checked ? 'on' : '')}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export function HelpdeskSlaPage() {
  const canManage = usePermission('helpdesk.sla.manage');
  const queryClient = useQueryClient();
  const policiesQuery = useQuery({
    queryKey: ['helpdesk', 'sla-policies'],
    queryFn: getSlaPolicies,
  });
  const monitorQuery = useQuery({
    queryKey: ['helpdesk', 'sla-monitor'],
    queryFn: () => getSlaMonitor({ page: 1, pageSize: 100 }),
    refetchInterval: 15_000,
  });

  const [selectedId, setSelectedId] = useState('');
  const selected = useMemo(
    () => policiesQuery.data?.find((item) => item.id === selectedId)
      ?? policiesQuery.data?.find((item) => item.priority === 'P2')
      ?? policiesQuery.data?.[0],
    [policiesQuery.data, selectedId],
  );

  const [responseMinutes, setResponseMinutes] = useState(60);
  const [resolutionMinutes, setResolutionMinutes] = useState(240);
  const [appliesTo, setAppliesTo] = useState('');
  const [pauseOnRequesterWait, setPauseOnRequesterWait] = useState(true);
  const [notifyRequester, setNotifyRequester] = useState(true);
  const [reassignOnBreach, setReassignOnBreach] = useState(true);
  const [levels, setLevels] = useState<SlaEscalationLevel[]>([]);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setResponseMinutes(selected.responseMinutes);
    setResolutionMinutes(selected.resolutionMinutes);
    setAppliesTo(selected.appliesTo ?? '');
    setPauseOnRequesterWait(selected.pauseOnRequesterWait);
    setNotifyRequester(selected.notifyRequesterOnStatusChange);
    setReassignOnBreach(selected.reassignOnBreach);
    setLevels(selected.escalationLevels);
  }, [selected]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select an SLA policy.');
      return updateSlaPolicy(selected.id, selected.eTag, {
        responseMinutes,
        resolutionMinutes,
        businessCalendarId: selected.businessCalendar?.id,
        appliesTo,
        pauseOnRequesterWait,
        notifyRequesterOnStatusChange: notifyRequester,
        reassignOnBreach,
        escalationLevels: levels,
        isActive: selected.isActive,
      });
    },
    onSuccess: async () => {
      setSaveError('');
      await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'sla-policies'] });
      await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'sla-monitor'] });
    },
    onError: (error: Error) => setSaveError(error.message),
  });

  const monitor = monitorQuery.data?.items ?? [];
  const activePolicies = policiesQuery.data?.filter((item) => item.isActive).length ?? 0;
  const atRisk = monitor.filter((item) => item.state === 'at_risk').length;
  const breached = monitor.filter((item) => item.state === 'breached').length;
  const compliance = monitor.length
    ? Math.max(0, Math.round((monitor.length - breached) * 100 / monitor.length))
    : 100;

  const updateLevel = (
    index: number,
    patch: Partial<SlaEscalationLevel>,
  ) => {
    setLevels((current) => current.map((level, position) =>
      position === index ? { ...level, ...patch } : level));
  };

  return (
    <INNOPage
      eyebrow="Helpdesk · Manage"
      title="SLA & Escalation"
      description="Response and resolution targets, business-time behavior and escalation levels."
      actions={<Link className="inno-link-button secondary" to="/helpdesk/calendar">Business Calendar</Link>}
    >

      <div className="production-stat-strip helpdesk-stat-strip">
        <div><span>Active policies</span><b>{activePolicies}</b><small>Across priority levels</small></div>
        <div><span>At risk</span><b>{atRisk}</b><small>Current scoped queue</small></div>
        <div><span>Breached</span><b>{breached}</b><small>{breached ? 'Needs review' : 'No active breach'}</small></div>
        <div><span>Compliance</span><b>{compliance}%</b><small>Current open-ticket sample</small></div>
      </div>

      {policiesQuery.isPending ? <LoadingState label="Loading SLA policies…" /> : null}
      {policiesQuery.isError ? <ErrorState error={policiesQuery.error} retry={() => void policiesQuery.refetch()} /> : null}

      {selected ? (
        <div className="sla-operational-layout">
          <div className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.appliesTo ?? 'Priority default policy'}</p>
                </div>
                <INNOStatus tone={selected.isActive ? 'success' : 'neutral'}>{selected.isActive ? 'Active' : 'Inactive'}</INNOStatus>
              </div>
              <div className="editor-form">
                {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
                <div className="editor-grid">
                  <label className="field-block field-wide">
                    <span>Policy</span>
                    <select
                      value={selected.id}
                      onChange={(event) => setSelectedId(event.target.value)}
                    >
                      {(policiesQuery.data ?? []).map((policy) => (
                        <option key={policy.id} value={policy.id}>{policy.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span>First response target · minutes</span>
                    <input
                      type="number"
                      min={1}
                      disabled={!canManage}
                      value={responseMinutes}
                      onChange={(event) => setResponseMinutes(Number(event.target.value))}
                    />
                    <small>{minutesLabel(responseMinutes)}</small>
                  </label>
                  <label className="field-block">
                    <span>Resolution target · minutes</span>
                    <input
                      type="number"
                      min={1}
                      disabled={!canManage}
                      value={resolutionMinutes}
                      onChange={(event) => setResolutionMinutes(Number(event.target.value))}
                    />
                    <small>{minutesLabel(resolutionMinutes)}</small>
                  </label>
                  <label className="field-block">
                    <span>Business calendar</span>
                    <input value={selected.businessCalendar?.name ?? 'No calendar'} readOnly />
                    <small>{selected.businessCalendar?.timeZoneId ?? 'Calendar time not configured'}</small>
                  </label>
                  <label className="field-block">
                    <span>Applies to</span>
                    <input
                      disabled={!canManage}
                      value={appliesTo}
                      onChange={(event) => setAppliesTo(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>Policy behavior</h3><p>Controls how the SLA clock and escalation path behave.</p></div>
              </div>
              <div className="settings-list sla-settings-list">
                <SwitchRow
                  title="Pause SLA on requester wait"
                  description="Status: Waiting for Requester"
                  checked={pauseOnRequesterWait}
                  disabled={!canManage}
                  onChange={setPauseOnRequesterWait}
                />
                <SwitchRow
                  title="Notify requester on status change"
                  description="Notification rule consumer may react to status facts"
                  checked={notifyRequester}
                  disabled={!canManage}
                  onChange={setNotifyRequester}
                />
                <SwitchRow
                  title="Reassign on breach"
                  description="Move the ticket to the configured breach escalation team"
                  checked={reassignOnBreach}
                  disabled={!canManage}
                  onChange={setReassignOnBreach}
                />
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>Escalation levels</h3><p>Sequential escalation by elapsed resolution target.</p></div>
                <INNOStatus>{levels.length} levels</INNOStatus>
              </div>
              <div className="sla-level-list">
                {levels.map((level, index) => (
                  <div className="sla-level-row" key={level.level}>
                    <div>
                      <b>Level {level.level}</b>
                      <span>{level.percent}% of resolution target</span>
                    </div>
                    <label>
                      <span className="sr-only">Level {level.level} percent</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        disabled={!canManage}
                        value={level.percent}
                        onChange={(event) => updateLevel(index, { percent: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      <span className="sr-only">Level {level.level} target</span>
                      <input
                        disabled={!canManage}
                        value={level.targetId}
                        onChange={(event) => updateLevel(index, { targetId: event.target.value })}
                      />
                    </label>
                    <label>
                      <span className="sr-only">Level {level.level} reassign team</span>
                      <input
                        disabled={!canManage}
                        value={level.reassignTeam ?? ''}
                        placeholder="Reassign team"
                        onChange={(event) => updateLevel(index, { reassignTeam: event.target.value })}
                      />
                    </label>
                  </div>
                ))}
              </div>
              {canManage ? (
                <INNOEditorFooter>
                  <span className="footer-helper">Changes recalculate active ticket targets using business time.</span>
                  <INNOButton busy={mutation.isPending} onClick={() => mutation.mutate()}>Save Policy</INNOButton>
                </INNOEditorFooter>
              ) : null}
            </section>
          </div>

          <aside className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>Live SLA monitor</h3><p>Operational context inside your effective ticket scope.</p></div>
                {monitorQuery.isFetching ? <INNOStatus>Refreshing</INNOStatus> : null}
              </div>
              {monitorQuery.isError ? (
                <INNOState compact kind="error" title="SLA monitor unavailable" description="The live monitor could not be loaded. Policy editing remains available." />
              ) : (
                <div className="sla-monitor-list">
                  {monitor.slice(0, 8).map((item) => (
                    <Link className="sla-monitor-row" to={'/helpdesk/tickets/' + item.ticketId} key={item.ticketId}>
                      <div>
                        <b>{item.ticketNumber} · {item.priority}</b>
                        <span>{item.elapsedPercent}% elapsed · {item.policyName}</span>
                      </div>
                      <span className={'sla-chip ' + item.state}>{item.state.replace('_', ' ')}</span>
                    </Link>
                  ))}
                  {!monitor.length ? <INNOState compact kind="empty" title="No active SLA timers" description="No open ticket in scope currently has an active SLA timer." /> : null}
                </div>
              )}
            </section>
            <div className="purpose-note">
              <b>Business time is authoritative.</b>
              <span>Weekends, configured holidays and requester-wait pauses do not consume the SLA target.</span>
            </div>
          </aside>
        </div>
      ) : null}
    </INNOPage>
  );
}
