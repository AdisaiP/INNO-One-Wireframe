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

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function minuteLabel(value: number) {
  const hour = Math.floor(value / 60).toString().padStart(2, '0');
  const minute = (value % 60).toString().padStart(2, '0');
  return hour + ':' + minute;
}

export function BusinessCalendarPage() {
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
      if (!query.data) throw new Error('Business Calendar is not loaded.');
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

  const updateDay = (dayOfWeek: number, patch: Partial<BusinessWorkingDay>) => {
    setDays((current) => current.map((day) =>
      day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day));
  };

  return (
    <INNOPage
      eyebrow="Helpdesk · Configuration"
      title="Business Calendar"
      description="Working hours and holidays used for SLA calculations."
      actions={<Link className="inno-link-button secondary" to="/helpdesk/sla">Open SLA policies</Link>}
    >

      {query.isPending ? <LoadingState label="Loading Business Calendar…" /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <div className="sla-operational-layout">
          <div className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>Working hours</h3><p>The SLA clock runs only inside these windows.</p></div>
                <INNOStatus>{timeZoneId}</INNOStatus>
              </div>
              <div className="editor-form">
                {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
                <div className="editor-grid calendar-meta-grid">
                  <label className="field-block">
                    <span>Calendar name</span>
                    <input disabled={!canManage} value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Time zone</span>
                    <select disabled={!canManage} value={timeZoneId} onChange={(event) => setTimeZoneId(event.target.value)}>
                      <option value="Asia/Bangkok">Asia/Bangkok</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </label>
                </div>

                <div className="business-day-grid">
                  {orderedDays.map((day) => (
                    <div className={'business-day-card ' + (day.isWorking ? '' : 'off')} key={day.dayOfWeek}>
                      <div className="business-day-head">
                        <b>{dayNames[day.dayOfWeek]}</b>
                        <button
                          type="button"
                          className={'production-switch ' + (day.isWorking ? 'on' : '')}
                          role="switch"
                          aria-checked={day.isWorking}
                          aria-label={'Enable ' + dayNames[day.dayOfWeek]}
                          disabled={!canManage}
                          onClick={() => updateDay(day.dayOfWeek, { isWorking: !day.isWorking })}
                        >
                          <span />
                        </button>
                      </div>
                      {day.isWorking ? (
                        <div className="business-day-times">
                          <label>
                            <span>Start</span>
                            <input
                              type="time"
                              disabled={!canManage}
                              value={minuteLabel(day.startMinute)}
                              onChange={(event) => {
                                const [hour, minute] = event.target.value.split(':').map(Number);
                                updateDay(day.dayOfWeek, { startMinute: hour * 60 + minute });
                              }}
                            />
                          </label>
                          <label>
                            <span>End</span>
                            <input
                              type="time"
                              disabled={!canManage}
                              value={minuteLabel(day.endMinute)}
                              onChange={(event) => {
                                const [hour, minute] = event.target.value.split(':').map(Number);
                                updateDay(day.dayOfWeek, { endMinute: hour * 60 + minute });
                              }}
                            />
                          </label>
                        </div>
                      ) : <span className="business-day-off-label">Off</span>}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>Holiday exceptions</h3><p>These dates are removed from SLA timer calculations.</p></div>
                <INNOStatus>{query.data.holidays.length} dates</INNOStatus>
              </div>
              <INNOTableWrap width="wide">
                <table>
                  <thead><tr><th>Date</th><th>Holiday</th><th>Type</th></tr></thead>
                  <tbody>
                    {query.data.holidays.map((holiday) => (
                      <tr key={holiday.date}>
                        <td>{new Date(holiday.date + 'T00:00:00').toLocaleDateString()}</td>
                        <td>{holiday.name}</td>
                        <td><INNOStatus tone={holiday.isWorking ? 'warning' : 'neutral'}>{holiday.isWorking ? 'Working exception' : 'Public holiday'}</INNOStatus></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
              <div className="purpose-note calendar-note">
                <b>Holiday maintenance remains read-only in this slice.</b>
                <span>Step 18 implements working-time calculation against seeded holidays without introducing an uncontracted holiday-import workflow.</span>
              </div>
            </section>

            {canManage ? (
              <INNOEditorFooter>
                <INNOEditorFooterStart>
                  <INNOEditorFooterNote>Saving recalculates due dates for active tickets that use this calendar.</INNOEditorFooterNote>
                </INNOEditorFooterStart>
                <INNOEditorFooterEnd>
                  <INNOButton busy={mutation.isPending} onClick={() => mutation.mutate()}>Save Calendar</INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            ) : null}
          </div>

          <aside className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>SLA calendar usage</h3><p>Default working-time source.</p></div>
                <INNOStatus tone="success">In use</INNOStatus>
              </div>
              <div className="production-kv-grid ticket-properties">
                <div className="kv-row"><span>Calendar</span><b>{query.data.name}</b></div>
                <div className="kv-row"><span>Time zone</span><b>{query.data.timeZoneId}</b></div>
                <div className="kv-row"><span>Working days</span><b>{days.filter((day) => day.isWorking).length}</b></div>
                <div className="kv-row"><span>Holiday exceptions</span><b>{query.data.holidays.length}</b></div>
              </div>
            </section>
            <div className="purpose-note">
              <b>This page owns working time only.</b>
              <span>Response targets, pause rules and escalation levels remain in SLA & Escalation.</span>
            </div>
          </aside>
        </div>
      ) : null}
    </INNOPage>
  );
}
