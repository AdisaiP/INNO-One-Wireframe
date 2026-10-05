import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterNote, INNOEditorFooterStart, INNOPage, INNOPurposeNote, INNOState, INNOStatus } from '@inno/ui';
import {
  getSlaMonitor,
  getSlaPolicies,
  updateSlaPolicy,
} from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { SlaEscalationLevel, SlaPolicy } from '../api/types';
import { useI18n as useStep45NI18n } from '@inno/i18n';

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
  const { t: t45n } = useStep45NI18n();

  function durationLabel(minutes: number) {
    if (minutes < 60) {
      return t45n('helpdesk.step45n.helpdeskSla.durationMinutes', { count: minutes });
    }
    const hours = minutes / 60;
    const count = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
    return t45n('helpdesk.step45n.helpdeskSla.durationHours', { count });
  }

  function stateLabel(state: string) {
    if (state === 'at_risk') return t45n('helpdesk.step45n.helpdeskSla.state.atRisk');
    if (state === 'breached') return t45n('helpdesk.step45n.helpdeskSla.state.breached');
    if (state === 'on_track') return t45n('helpdesk.step45n.helpdeskSla.state.onTrack');
    if (state === 'paused') return t45n('helpdesk.step45n.helpdeskSla.state.paused');
    return state.replaceAll('_', ' ');
  }
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
      if (!selected) throw new Error(t45n('helpdesk.step45n.helpdeskSla.selectAnSlaPolicy'));
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
      eyebrow={t45n('helpdesk.step45n.helpdeskSla.helpdeskManage')}
      title={t45n('navigation.slaEscalation')}
      description={t45n('helpdesk.step45n.helpdeskSla.responseAndResolutionTargetsBusinessTimeBehaviorAnd')}
      actions={<Link className="inno-link-button secondary" to="/helpdesk/calendar">{t45n('navigation.businessCalendar')}</Link>}
    >

      <div className="production-stat-strip helpdesk-stat-strip">
        <div><span>{t45n('helpdesk.step45n.helpdeskSla.activePolicies')}</span><b>{activePolicies}</b><small>{t45n('helpdesk.step45n.helpdeskSla.acrossPriorityLevels')}</small></div>
        <div><span>{t45n('helpdesk.step45n.helpdeskSla.atRisk')}</span><b>{atRisk}</b><small>{t45n('helpdesk.step45n.helpdeskSla.currentScopedQueue')}</small></div>
        <div><span>{t45n('helpdesk.step45n.helpdeskSla.breached')}</span><b>{breached}</b><small>{breached ? t45n('helpdesk.step45n.helpdeskSla.needsReview') : t45n('helpdesk.step45n.helpdeskSla.noActiveBreach')}</small></div>
        <div><span>{t45n('assets.automation.editor.licenseField.compliance')}</span><b>{compliance}%</b><small>{t45n('helpdesk.step45n.helpdeskSla.currentOpenTicketSample')}</small></div>
      </div>

      {policiesQuery.isPending ? <LoadingState label={t45n('helpdesk.step45n.helpdeskSla.loadingSlaPolicies')} /> : null}
      {policiesQuery.isError ? <ErrorState error={policiesQuery.error} retry={() => void policiesQuery.refetch()} /> : null}

      {selected ? (
        <div className="sla-operational-layout">
          <div className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.appliesTo ?? t45n('helpdesk.step45n.helpdeskSla.priorityDefaultPolicy')}</p>
                </div>
                <INNOStatus tone={selected.isActive ? 'success' : 'neutral'}>{selected.isActive ? t45n('reports.status.active') : t45n('admin.step45n.adminAccessScopeEdit.inactive')}</INNOStatus>
              </div>
              <div className="editor-form">
                {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
                <div className="editor-grid">
                  <label className="field-block field-wide">
                    <span>{t45n('helpdesk.step45n.helpdeskSla.policy')}</span>
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
                    <span>{t45n('helpdesk.step45n.helpdeskSla.firstResponseTargetMinutes')}</span>
                    <input
                      type="number"
                      min={1}
                      disabled={!canManage}
                      value={responseMinutes}
                      onChange={(event) => setResponseMinutes(Number(event.target.value))}
                    />
                    <small>{durationLabel(responseMinutes)}</small>
                  </label>
                  <label className="field-block">
                    <span>{t45n('helpdesk.step45n.helpdeskSla.resolutionTargetMinutes')}</span>
                    <input
                      type="number"
                      min={1}
                      disabled={!canManage}
                      value={resolutionMinutes}
                      onChange={(event) => setResolutionMinutes(Number(event.target.value))}
                    />
                    <small>{durationLabel(resolutionMinutes)}</small>
                  </label>
                  <label className="field-block">
                    <span>{t45n('helpdesk.step45n.helpdeskSla.businessCalendar')}</span>
                    <input value={selected.businessCalendar?.name ?? t45n('helpdesk.step45n.helpdeskSla.noCalendar')} readOnly />
                    <small>{selected.businessCalendar?.timeZoneId ?? t45n('helpdesk.step45n.helpdeskSla.calendarTimeNotConfigured')}</small>
                  </label>
                  <label className="field-block">
                    <span>{t45n('helpdesk.step45n.helpdeskSla.appliesTo')}</span>
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
                <div><h3>{t45n('helpdesk.step45n.helpdeskSla.policyBehavior')}</h3><p>{t45n('helpdesk.step45n.helpdeskSla.controlsHowTheSlaClockAndEscalationPath')}</p></div>
              </div>
              <div className="settings-list sla-settings-list">
                <SwitchRow
                  title={t45n('helpdesk.step45n.helpdeskSla.pauseSlaOnRequesterWait')}
                  description={t45n('helpdesk.step45n.helpdeskSla.statusWaitingForRequester')}
                  checked={pauseOnRequesterWait}
                  disabled={!canManage}
                  onChange={setPauseOnRequesterWait}
                />
                <SwitchRow
                  title={t45n('helpdesk.step45n.helpdeskSla.notifyRequesterOnStatusChange')}
                  description={t45n('helpdesk.step45n.helpdeskSla.notificationRuleConsumerMayReactToStatusFacts')}
                  checked={notifyRequester}
                  disabled={!canManage}
                  onChange={setNotifyRequester}
                />
                <SwitchRow
                  title={t45n('helpdesk.step45n.helpdeskSla.reassignOnBreach')}
                  description={t45n('helpdesk.step45n.helpdeskSla.moveTheTicketToTheConfiguredBreachEscalation')}
                  checked={reassignOnBreach}
                  disabled={!canManage}
                  onChange={setReassignOnBreach}
                />
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>{t45n('helpdesk.step45n.helpdeskSla.escalationLevels')}</h3><p>{t45n('helpdesk.step45n.helpdeskSla.sequentialEscalationByElapsedResolutionTarget')}</p></div>
                <INNOStatus>{levels.length} {t45n('helpdesk.step45n.helpdeskSla.levels')}</INNOStatus>
              </div>
              <div className="sla-level-list">
                {levels.map((level, index) => (
                  <div className="sla-level-row" key={level.level}>
                    <div className="sla-level-identity">
                      <b>{t45n('helpdesk.step45n.helpdeskSla.level')}{' '}{level.level}</b>
                      <span>{level.percent}{t45n('helpdesk.step45n.helpdeskSla.ofResolutionTarget')}</span>
                    </div>
                    <label className="sla-level-field">
                      <span>{t45n('helpdesk.step45n.helpdeskSla.escalationThreshold')}</span>
                      <div className="sla-percent-control">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          disabled={!canManage}
                          value={level.percent}
                          onChange={(event) => updateLevel(index, { percent: Number(event.target.value) })}
                        />
                        <span aria-hidden="true">%</span>
                      </div>
                    </label>
                    <label className="sla-level-field">
                      <span>{t45n('helpdesk.step45n.helpdeskSla.targetRole')}</span>
                      <input
                        disabled={!canManage}
                        value={level.targetId}
                        onChange={(event) => updateLevel(index, { targetId: event.target.value })}
                      />
                    </label>
                    <label className="sla-level-field">
                      <span>{t45n('helpdesk.step45n.helpdeskSla.escalationTeam')}</span>
                      <input
                        disabled={!canManage}
                        value={level.reassignTeam ?? ''}
                        placeholder={t45n('helpdesk.step45n.helpdeskSla.reassignTeam')}
                        onChange={(event) => updateLevel(index, { reassignTeam: event.target.value })}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>

            {canManage ? (
              <INNOEditorFooter docked className="sla-save-footer">
                <INNOEditorFooterStart>
                  <INNOEditorFooterNote>{t45n('helpdesk.step45n.helpdeskSla.changesRecalculateActiveTicketTargetsUsingBusinessTime')}</INNOEditorFooterNote>
                </INNOEditorFooterStart>
                <INNOEditorFooterEnd>
                  <INNOButton busy={mutation.isPending} onClick={() => mutation.mutate()}>{t45n('helpdesk.step45n.helpdeskSla.savePolicy')}</INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            ) : null}
          </div>

          <aside className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>{t45n('helpdesk.step45n.helpdeskSla.liveSlaMonitor')}</h3><p>{t45n('helpdesk.step45n.helpdeskSla.operationalContextInsideYourEffectiveTicketScope')}</p></div>
                {monitorQuery.isFetching ? <INNOStatus>{t45n('helpdesk.step45n.helpdeskSla.refreshing')}</INNOStatus> : null}
              </div>
              {monitorQuery.isError ? (
                <INNOState compact kind="error" title={t45n('helpdesk.step45n.helpdeskSla.slaMonitorUnavailable')} description={t45n('helpdesk.step45n.helpdeskSla.theLiveMonitorCouldNotBeLoadedPolicy')} />
              ) : (
                <div className="sla-monitor-list">
                  {monitor.slice(0, 8).map((item) => (
                    <Link className="sla-monitor-row" to={'/helpdesk/tickets/' + item.ticketId} key={item.ticketId}>
                      <div>
                        <b>{item.ticketNumber} · {item.priority}</b>
                        <span>{item.elapsedPercent}{t45n('helpdesk.step45n.helpdeskSla.elapsed')}{' '}{item.policyName}</span>
                      </div>
                      <span className={'sla-chip ' + item.state}>{stateLabel(item.state)}</span>
                    </Link>
                  ))}
                  {!monitor.length ? <INNOState compact kind="empty" title={t45n('helpdesk.step45n.helpdeskSla.noActiveSlaTimers')} description={t45n('helpdesk.step45n.helpdeskSla.noOpenTicketInScopeCurrentlyHasAn')} /> : null}
                </div>
              )}
            </section>
            <INNOPurposeNote
              title={t45n('helpdesk.step45n.helpdeskSla.businessTimeIsAuthoritative')}
              description={t45n('helpdesk.step45n.helpdeskSla.weekendsConfiguredHolidaysAndRequesterWaitPausesDo')}
            />
          </aside>
        </div>
      ) : null}
    </INNOPage>
  );
}
