import { useMemo, useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNODialog,
  INNOPage,
  INNORowActions,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  createReportSchedule,
  deleteReportSchedule,
  getReports,
  getReportSchedules,
  updateReportSchedule,
} from '../api/client';
import type { ReportSchedule, ReportScheduleMutationInput } from '../api/types';
import { usePermission } from '../app/ProfileContext';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

const blank: ReportScheduleMutationInput = {
  name: '',
  reportId: '',
  cadence: 'daily',
  timeZoneId: 'Asia/Bangkok',
  hour: 8,
  minute: 0,
  dayOfWeek: 1,
  dayOfMonth: 1,
  isEnabled: true,
};

function timeValue(hour: number, minute: number) {
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

export function ReportSchedulesPage() {
  const { t: t45n } = useStep45NI18n();
  const { t, locale, formatDateTime } = useI18n();
  const canManage = usePermission('reports.manage');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReportSchedule | null>(null);
  const [form, setForm] = useState<ReportScheduleMutationInput>(blank);
  const [deleteTarget, setDeleteTarget] = useState<ReportSchedule | null>(null);
  const [feedback, setFeedback] = useState('');

  const schedules = useQuery({
    queryKey: ['reports', 'schedules'],
    queryFn: getReportSchedules,
  });
  const reports = useQuery({
    queryKey: ['reports', 'definitions', 'schedule-options'],
    queryFn: () => getReports({ page: 1, pageSize: 100 }),
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => ({
    value: index,
    label: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2026, 0, 4 + index))),
  })), [locale]);

  const close = () => {
    setOpen(false);
    setEditing(null);
    setForm(blank);
  };

  const beginCreate = () => {
    setEditing(null);
    setForm({ ...blank, reportId: reports.data?.items[0]?.id ?? '' });
    setOpen(true);
  };

  const beginEdit = (schedule: ReportSchedule) => {
    setEditing(schedule);
    setForm({
      name: schedule.name,
      reportId: schedule.reportId,
      cadence: schedule.cadence,
      timeZoneId: schedule.timeZoneId,
      hour: schedule.hour,
      minute: schedule.minute,
      dayOfWeek: schedule.dayOfWeek ?? 1,
      dayOfMonth: schedule.dayOfMonth ?? 1,
      isEnabled: schedule.isEnabled,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () => editing
      ? updateReportSchedule(editing.id, editing.eTag, form)
      : createReportSchedule(form),
    onSuccess: async () => {
      setFeedback(t('reports.toast.scheduleSaved'));
      close();
      await queryClient.invalidateQueries({ queryKey: ['reports', 'schedules'] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const remove = useMutation({
    mutationFn: (schedule: ReportSchedule) =>
      deleteReportSchedule(schedule.id, schedule.eTag),
    onSuccess: async () => {
      setFeedback(t('reports.toast.scheduleDeleted'));
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['reports', 'schedules'] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const formValid = Boolean(form.name.trim() && form.reportId);

  return (
    <INNOPage
      eyebrow={t('reports.schedules.eyebrow')}
      title={t('reports.schedules.title')}
      description={t('reports.schedules.description')}
      actions={(
        <div className="page-header-actions">
          <Link className="inno-link-button secondary" to="/reports">
            {t('reports.runs.back')}
          </Link>
          {canManage ? (
            <INNOButton disabled={!reports.data?.items.length} onClick={beginCreate}>
              {t('reports.schedules.new')}
            </INNOButton>
          ) : null}
        </div>
      )}
    >
      {feedback ? <div className="workflow-product-boundary" role="status">{feedback}</div> : null}

      <INNOCollection>
        <INNOCollectionHeader
          title={t('reports.schedules.title')}
          description={t('reports.schedules.description')}
          meta={schedules.data ? <INNOStatus>{schedules.data.length}</INNOStatus> : undefined}
        />

        {schedules.isPending ? (
          <CollectionLoadingState />
        ) : schedules.isError ? (
          <CollectionErrorState error={schedules.error} retry={() => void schedules.refetch()} />
        ) : schedules.data.length ? (
          <INNOTableWrap stickyAction>
            <table>
              <thead>
                <tr>
                  <th>{t('reports.schedules.name')}</th>
                  <th>{t('reports.schedules.report')}</th>
                  <th>{t('reports.schedules.cadence')}</th>
                  <th>{t('reports.schedules.nextRun')}</th>
                  <th>{t('reports.schedules.lastRun')}</th>
                  <th>{t('reports.schedules.enabled')}</th>
                  <th className="action-column">{t('reports.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {schedules.data.map((schedule) => (
                  <tr key={schedule.id}>
                    <td><b>{schedule.name}</b><div className="table-meta">{schedule.timeZoneId}</div></td>
                    <td>{schedule.reportName}</td>
                    <td>{t('reports.schedules.' + schedule.cadence)} · {timeValue(schedule.hour, schedule.minute)}</td>
                    <td>{schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : '—'}</td>
                    <td>{schedule.lastRunAt ? formatDateTime(schedule.lastRunAt) : t('reports.schedules.never')}</td>
                    <td>
                      <INNOStatus tone={schedule.isEnabled ? 'success' : 'neutral'}>
                        {schedule.isEnabled ? t('reports.schedules.enabled') : '—'}
                      </INNOStatus>
                    </td>
                    <td className="action-column">
                      {canManage ? (
                        <INNORowActions
                          ariaLabel={schedule.name}
                          items={[
                            { id: 'edit', label: t('reports.action.edit'), onSelect: () => beginEdit(schedule) },
                            { id: 'delete', label: t('reports.schedules.delete'), tone: 'danger', onSelect: () => setDeleteTarget(schedule) },
                          ]}
                        />
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <INNOCollectionState
            kind="empty"
            title={t('reports.schedules.empty.title')}
            description={t('reports.schedules.empty.description')}
            action={canManage && reports.data?.items.length ? (
              <INNOButton onClick={beginCreate}>{t('reports.schedules.new')}</INNOButton>
            ) : undefined}
          />
        )}
      </INNOCollection>

      <INNODialog
        open={open}
        title={editing ? t('reports.schedules.save') : t('reports.schedules.new')}
        description={t('reports.schedules.description')}
        onClose={close}
        size="md"
        footer={(
          <>
            <INNOButton type="button" variant="secondary" onClick={close}>
              {t('reports.schedules.cancel')}
            </INNOButton>
            <INNOButton
              type="button"
              busy={save.isPending}
              disabled={!formValid}
              onClick={() => { if (formValid) save.mutate(); }}
            >
              {t(editing ? 'reports.schedules.save' : 'reports.schedules.create')}
            </INNOButton>
          </>
        )}
      >
        <div className="report-schedule-form">
          <label className="field-block">
            <span>{t('reports.schedules.name')}</span>
            <input value={form.name} maxLength={180} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field-block">
            <span>{t('reports.schedules.report')}</span>
            <select value={form.reportId} onChange={(event) => setForm({ ...form, reportId: event.target.value })}>
              {(reports.data?.items ?? []).map((report) => <option key={report.id} value={report.id}>{report.name}</option>)}
            </select>
          </label>
          <div className="editor-grid">
            <label className="field-block">
              <span>{t('reports.schedules.cadence')}</span>
              <select
                value={form.cadence}
                onChange={(event) => setForm({
                  ...form,
                  cadence: event.target.value as ReportScheduleMutationInput['cadence'],
                })}
              >
                <option value="daily">{t('reports.schedules.daily')}</option>
                <option value="weekly">{t('reports.schedules.weekly')}</option>
                <option value="monthly">{t('reports.schedules.monthly')}</option>
              </select>
            </label>
            <label className="field-block">
              <span>{t('reports.schedules.time')}</span>
              <input
                type="time"
                value={timeValue(form.hour, form.minute)}
                onChange={(event) => {
                  const [hour, minute] = event.target.value.split(':').map(Number);
                  setForm({ ...form, hour, minute });
                }}
              />
            </label>
          </div>
          {form.cadence === 'weekly' ? (
            <label className="field-block">
              <span>{t('reports.schedules.dayOfWeek')}</span>
              <select value={form.dayOfWeek ?? 1} onChange={(event) => setForm({ ...form, dayOfWeek: Number(event.target.value) })}>
                {days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </label>
          ) : null}
          {form.cadence === 'monthly' ? (
            <label className="field-block">
              <span>{t('reports.schedules.dayOfMonth')}</span>
              <input type="number" min={1} max={31} value={form.dayOfMonth ?? 1} onChange={(event) => setForm({ ...form, dayOfMonth: Number(event.target.value) })} />
            </label>
          ) : null}
          <label className="field-block">
            <span>{t('reports.schedules.timeZone')}</span>
            <select value={form.timeZoneId} onChange={(event) => setForm({ ...form, timeZoneId: event.target.value })}>
              <option value="Asia/Bangkok">{t45n('helpdesk.step45n.businessCalendar.asiaBangkok')}</option>
              <option value="UTC">{t45n('helpdesk.step45n.businessCalendar.utc')}</option>
            </select>
          </label>
          <button
            type="button"
            className={'production-switch ' + (form.isEnabled ? 'on' : '')}
            role="switch"
            aria-checked={form.isEnabled}
            onClick={() => setForm({ ...form, isEnabled: !form.isEnabled })}
          >
            <span />
            <b>{t('reports.schedules.enabled')}</b>
          </button>
        </div>
      </INNODialog>

      <INNODialog
        open={Boolean(deleteTarget)}
        title={t('reports.schedules.delete')}
        description={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={(
          <>
            <INNOButton variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('reports.schedules.cancel')}
            </INNOButton>
            <INNOButton
              variant="danger"
              busy={remove.isPending}
              onClick={() => { if (deleteTarget) remove.mutate(deleteTarget); }}
            >
              {t('reports.schedules.delete')}
            </INNOButton>
          </>
        )}
      >
        <p>{t('reports.schedules.deleteConfirm', { name: deleteTarget?.name ?? '' })}</p>
      </INNODialog>
    </INNOPage>
  );
}
