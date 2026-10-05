import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { INNOButton, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterNote, INNOEditorFooterStart, INNOPage, INNOStatus, INNOTableWrap } from '@inno/ui';
import {
  getBusinessCalendar,
  updateBusinessCalendar,
} from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { BusinessWorkingDay } from '../api/types';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function minuteLabel(value: number) {
  const hour = Math.floor(value / 60).toString().padStart(2, '0');
  const minute = (value % 60).toString().padStart(2, '0');
  return hour + ':' + minute;
}

export function BusinessCalendarPage() {
  const { t: t45n, locale } = useStep45NI18n();
  const canManage = usePermission('helpdesk.sla.manage');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['helpdesk', 'business-calendar'],
    queryFn: getBusinessCalendar,
  });

  const [name, setName] = useState('');
  const [timeZoneId, setTimeZoneId] = useState('Asia/Bangkok');
  const [days, setDays] = useState<BusinessWorkingDay[]>([]);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setName(query.data.name);
    setTimeZoneId(query.data.timeZoneId);
    const byDay = new Map(query.data.workingDays.map((day) => [day.dayOfWeek, day]));
    setDays(Array.from({ length: 7 }, (_, dayOfWeek) =>
      byDay.get(dayOfWeek) ?? {
        dayOfWeek,
        startMinute: 8 * 60 + 30,
        endMinute: 17 * 60 + 30,
        isWorking: false,
      }));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error(t45n('helpdesk.step45n.businessCalendar.businessCalendarIsNotLoaded'));
      return updateBusinessCalendar(query.data.eTag, {
        name,
        timeZoneId,
        workingDays: days,
      });
    },
    onSuccess: async () => {
      setSaveError('');
      await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'business-calendar'] });
      await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'sla-policies'] });
      await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'sla-monitor'] });
    },
    onError: (error: Error) => setSaveError(error.message),
  });

  const orderedDays = useMemo(
    () => days.slice().sort((a, b) => {
      const rank = (value: number) => value === 0 ? 7 : value;
      return rank(a.dayOfWeek) - rank(b.dayOfWeek);
    }),
    [days],
  );

  const dayName = (dayOfWeek: number) => {
    const sunday = new Date(Date.UTC(2024, 0, 7 + dayOfWeek));
    return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(sunday);
  };

  const updateDay = (dayOfWeek: number, patch: Partial<BusinessWorkingDay>) => {
    setDays((current) => current.map((day) =>
      day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day));
  };

  return (
    <INNOPage
      eyebrow={t45n('helpdesk.step45n.businessCalendar.helpdeskConfiguration')}
      title={t45n('navigation.businessCalendar')}
      description={t45n('helpdesk.step45n.businessCalendar.workingHoursAndHolidaysUsedForSlaCalculations')}
      actions={<Link className="inno-link-button secondary" to="/helpdesk/sla">{t45n('helpdesk.step45n.businessCalendar.openSlaPolicies')}</Link>}
    >

      {query.isPending ? <LoadingState label={t45n('helpdesk.step45n.businessCalendar.loadingBusinessCalendar')} /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <div className="sla-operational-layout">
          <div className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>{t45n('helpdesk.step45n.businessCalendar.workingHours')}</h3><p>{t45n('helpdesk.step45n.businessCalendar.theSlaClockRunsOnlyInsideTheseWindows')}</p></div>
                <INNOStatus>{timeZoneId}</INNOStatus>
              </div>
              <div className="editor-form">
                {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
                <div className="editor-grid calendar-meta-grid">
                  <label className="field-block">
                    <span>{t45n('helpdesk.step45n.businessCalendar.calendarName')}</span>
                    <input disabled={!canManage} value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>{t45n('profile.timeZone')}</span>
                    <select disabled={!canManage} value={timeZoneId} onChange={(event) => setTimeZoneId(event.target.value)}>
                      <option value="Asia/Bangkok">{t45n('helpdesk.step45n.businessCalendar.asiaBangkok')}</option>
                      <option value="UTC">{t45n('helpdesk.step45n.businessCalendar.utc')}</option>
                    </select>
                  </label>
                </div>

                <div className="business-week-list">
                  {orderedDays.map((day) => {
                    const localizedDay = dayName(day.dayOfWeek);
                    return (
                      <div className={'business-day-row ' + (day.isWorking ? '' : 'off')} key={day.dayOfWeek}>
                        <div className="business-day-identity">
                          <b>{localizedDay}</b>
                          <span>{day.isWorking
                            ? minuteLabel(day.startMinute) + ' – ' + minuteLabel(day.endMinute)
                            : t45n('helpdesk.step45n.businessCalendar.off')}</span>
                        </div>
                        <button
                          type="button"
                          className={'production-switch ' + (day.isWorking ? 'on' : '')}
                          role="switch"
                          aria-checked={day.isWorking}
                          aria-label={t45n('admin.step45n.adminApps.enable') + ' ' + localizedDay}
                          disabled={!canManage}
                          onClick={() => updateDay(day.dayOfWeek, { isWorking: !day.isWorking })}
                        >
                          <span />
                        </button>
                        <div className="business-day-times">
                          <label>
                            <span>{t45n('helpdesk.step45n.businessCalendar.start')}</span>
                            <input
                              type="time"
                              disabled={!canManage || !day.isWorking}
                              value={minuteLabel(day.startMinute)}
                              onChange={(event) => {
                                const [hour, minute] = event.target.value.split(':').map(Number);
                                updateDay(day.dayOfWeek, { startMinute: hour * 60 + minute });
                              }}
                            />
                          </label>
                          <label>
                            <span>{t45n('workflow.kind.end')}</span>
                            <input
                              type="time"
                              disabled={!canManage || !day.isWorking}
                              value={minuteLabel(day.endMinute)}
                              onChange={(event) => {
                                const [hour, minute] = event.target.value.split(':').map(Number);
                                updateDay(day.dayOfWeek, { endMinute: hour * 60 + minute });
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>{t45n('helpdesk.step45n.businessCalendar.holidayExceptions')}</h3><p>{t45n('helpdesk.step45n.businessCalendar.readOnlyDatesRemovedFromSlaTimerCalculations')}</p></div>
                <INNOStatus>{query.data.holidays.length} {t45n('helpdesk.step45n.businessCalendar.dates')}</INNOStatus>
              </div>
              <INNOTableWrap>
                <table>
                  <thead><tr><th>{t45n('helpdesk.step45n.businessCalendar.date')}</th><th>{t45n('helpdesk.step45n.businessCalendar.holiday')}</th><th>{t45n('reports.column.type')}</th></tr></thead>
                  <tbody>
                    {query.data.holidays.map((holiday) => (
                      <tr key={holiday.date}>
                        <td>{new Date(holiday.date + 'T00:00:00').toLocaleDateString()}</td>
                        <td>{holiday.name}</td>
                        <td><INNOStatus tone={holiday.isWorking ? 'warning' : 'neutral'}>{holiday.isWorking ? t45n('helpdesk.step45n.businessCalendar.workingException') : t45n('helpdesk.step45n.businessCalendar.publicHoliday')}</INNOStatus></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>

            </section>

            {canManage ? (
              <INNOEditorFooter>
                <INNOEditorFooterStart>
                  <INNOEditorFooterNote>{t45n('helpdesk.step45n.businessCalendar.savingRecalculatesDueDatesForActiveTicketsThat')}</INNOEditorFooterNote>
                </INNOEditorFooterStart>
                <INNOEditorFooterEnd>
                  <INNOButton busy={mutation.isPending} onClick={() => mutation.mutate()}>{t45n('helpdesk.step45n.businessCalendar.saveCalendar')}</INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            ) : null}
          </div>

          <aside className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>{t45n('helpdesk.step45n.businessCalendar.slaCalendarUsage')}</h3><p>{t45n('helpdesk.step45n.businessCalendar.defaultWorkingTimeSource')}</p></div>
                <INNOStatus tone="success">{t45n('assets.automation.editor.lifecycle.in_use')}</INNOStatus>
              </div>
              <div className="production-kv-grid ticket-properties">
                <div className="kv-row"><span>{t45n('helpdesk.step45n.businessCalendar.calendar')}</span><b>{query.data.name}</b></div>
                <div className="kv-row"><span>{t45n('profile.timeZone')}</span><b>{query.data.timeZoneId}</b></div>
                <div className="kv-row"><span>{t45n('helpdesk.step45n.businessCalendar.workingDays')}</span><b>{days.filter((day) => day.isWorking).length}</b></div>
                <div className="kv-row"><span>{t45n('helpdesk.step45n.businessCalendar.holidayExceptions')}</span><b>{query.data.holidays.length}</b></div>
              </div>
            </section>

          </aside>
        </div>
      ) : null}
    </INNOPage>
  );
}
