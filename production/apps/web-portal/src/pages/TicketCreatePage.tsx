import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { INNOButton, INNOEditorFooter, INNOEditorFooterEnd, INNOEditorFooterStart, INNOIcon, INNOPage, INNOStatus } from '@inno/ui';
import { createTicket, getDevices, getTicketCategories } from '../api/client';
import { usePermission, useProfile } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { TicketCategoryNode } from '../api/types';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function flattenCategories(
  nodes: TicketCategoryNode[],
  prefix = '',
): Array<{ id: string; label: string }> {
  return nodes.flatMap((node) => {
    const label = prefix ? prefix + ' / ' + node.name : node.name;
    return [
      { id: node.id, label },
      ...flattenCategories(node.children, label),
    ];
  });
}

export function TicketCreatePage() {
  const { t: t45n } = useStep45NI18n();
  const profile = useProfile();
  const canViewDevices = usePermission('devices.view');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [impact, setImpact] = useState('Individual');
  const [urgency, setUrgency] = useState('Normal');
  const [relatedDeviceId, setRelatedDeviceId] = useState(() => searchParams.get('relatedDeviceId') ?? '');
  const [formError, setFormError] = useState('');

  const categories = useQuery({
    queryKey: ['helpdesk', 'categories'],
    queryFn: getTicketCategories,
  });
  const devices = useQuery({
    queryKey: ['helpdesk', 'related-devices'],
    queryFn: () => getDevices({ page: 1, pageSize: 100, sort: 'name', order: 'asc' }),
    enabled: canViewDevices,
  });
  const categoryOptions = useMemo(
    () => flattenCategories(categories.data ?? []),
    [categories.data],
  );

  const mutation = useMutation({
    mutationFn: createTicket,
    onSuccess: (ticket) => navigate('/helpdesk/tickets/' + ticket.id),
    onError: (error: Error) => setFormError(error.message),
  });

  const submit = () => {
    setFormError('');
    if (!subject.trim()) {
      setFormError('Subject is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    mutation.mutate({
      subject,
      description,
      categoryId: categoryId || undefined,
      impact,
      urgency,
      relatedDeviceId: relatedDeviceId || undefined,
    });
  };

  const calculatedPriority = urgency === 'Critical' || impact === 'Organization'
    ? 'P1 · Critical'
    : urgency === 'High' || impact === 'Department' || impact === 'Team'
      ? 'P2 · High'
      : 'P3 · Normal';
  const priorityTone = calculatedPriority.startsWith('P1')
    ? 'danger'
    : calculatedPriority.startsWith('P2')
      ? 'warning'
      : 'neutral';

  return (
    <INNOPage
      eyebrow={t45n('navigation.helpdesk')}
      title={t45n('helpdesk.step45n.helpdeskOverview.createTicket')}
      description={t45n('helpdesk.step45n.ticketCreate.captureTheProblemFirstRoutingAndOperationalDetails')}
      breadcrumb={(
        <>
          <Link to="/helpdesk">{t45n('navigation.helpdesk')}</Link>
          <INNOIcon token="action.next" size={11} />
          <Link to="/helpdesk/tickets">{t45n('navigation.tickets')}</Link>
          <INNOIcon token="action.next" size={11} />
          <span>{t45n('helpdesk.step45n.ticketCreate.newTicket')}</span>
        </>
      )}
    >
      {categories.isPending ? <LoadingState label={t45n('helpdesk.step45n.ticketCreate.loadingTicketForm')} /> : null}
      {categories.isError ? <ErrorState error={categories.error} retry={() => void categories.refetch()} /> : null}

      {!categories.isPending && !categories.isError ? (
        <div className="ticket-create-layout">
          <div className="ticket-create-main">
            {formError ? <div className="form-error" role="alert">{formError}</div> : null}

            <section className="ticket-create-section">
              <div className="ticket-create-section-head">
                <div className="ticket-create-section-title">
                  <span className="ticket-create-step">1</span>
                  <div>
                    <h3>{t45n('helpdesk.step45n.ticketCreate.describeTheIssue')}</h3>
                    <p>{t45n('helpdesk.step45n.ticketCreate.giveHelpdeskEnoughInformationToUnderstandWhatIs')}</p>
                  </div>
                </div>
              </div>
              <div className="editor-grid">
                <label className="field-block field-wide">
                  <span>{t45n('reports.column.subject')}</span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder={t45n('helpdesk.step45n.ticketCreate.brieflyDescribeTheIssue')}
                  />
                </label>
                <label className="field-block field-wide">
                  <span>{t45n('reports.editor.descriptionField')}</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={7}
                    placeholder={t45n('helpdesk.step45n.ticketCreate.describeWhatHappenedWhenItStartedAndWhat')}
                  />
                </label>
                <label className="field-block field-wide">
                  <span>{t45n('reports.column.category')}</span>
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">{t45n('helpdesk.step45n.ticketCreate.selectCategory')}</option>
                    {categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            </section>
            <section className="ticket-create-section">
              <div className="ticket-create-section-head">
                <div className="ticket-create-section-title">
                  <span className="ticket-create-step">2</span>
                  <div>
                    <h3>{t45n('helpdesk.step45n.ticketCreate.addContext')}</h3>
                    <p>{t45n('helpdesk.step45n.ticketCreate.linkTheAffectedDeviceWhenItHelpsInvestigation')}</p>
                  </div>
                </div>
                <INNOStatus>{t45n('helpdesk.step45n.ticketCreate.optional')}</INNOStatus>
              </div>
              <div className="editor-grid">
                <label className="field-block field-wide">
                  <span>{t45n('helpdesk.step45n.ticketCreate.relatedDevice')}</span>
                  <select
                    value={relatedDeviceId}
                    onChange={(event) => setRelatedDeviceId(event.target.value)}
                    disabled={!canViewDevices}
                  >
                    <option value="">{t45n('helpdesk.step45n.ticketCreate.noRelatedDevice')}</option>
                    {(devices.data?.items ?? []).map((device) => (
                      <option key={device.id} value={device.id}>{device.name} · {device.status}</option>
                    ))}
                  </select>
                  {!canViewDevices ? <small>{t45n('helpdesk.step45n.ticketCreate.deviceLinkingIsHiddenWithoutDevicesAccess')}</small> : null}
                </label>
              </div>
            </section>

            <details className="ticket-create-advanced">
              <summary>
                <span>{t45n('helpdesk.step45n.ticketCreate.advancedRoutingPriority')}</span>
                <INNOStatus tone={priorityTone}>{calculatedPriority}</INNOStatus>
              </summary>
              <div className="ticket-create-advanced-body">
                <div className="editor-grid">
                  <label className="field-block">
                    <span>{t45n('helpdesk.step45n.ticketCreate.impact')}</span>
                    <select value={impact} onChange={(event) => setImpact(event.target.value)}>
                      <option>{t45n('helpdesk.step45n.ticketCreate.individual')}</option>
                      <option>{t45n('reports.column.team')}</option>
                      <option>{t45n('helpdesk.step45n.ticketCreate.department')}</option>
                      <option>{t45n('profile.organization')}</option>
                    </select>
                  </label>
                  <label className="field-block">
                    <span>{t45n('helpdesk.step45n.ticketCreate.urgency')}</span>
                    <select value={urgency} onChange={(event) => setUrgency(event.target.value)}>
                      <option>{t45n('helpdesk.step45n.ticketCreate.normal')}</option>
                      <option>{t45n('helpdesk.step45n.ticketCreate.high')}</option>
                      <option>{t45n('helpdesk.step45n.ticketCreate.critical')}</option>
                    </select>
                  </label>
                  <label className="field-block field-wide">
                    <span>{t45n('helpdesk.step45n.ticketCreate.calculatedPriority')}</span>
                    <input value={calculatedPriority} readOnly />
                  </label>
                </div>
              </div>
            </details>

            <INNOEditorFooter>
              <INNOEditorFooterStart>
                <INNOButton variant="secondary" onClick={() => navigate('/helpdesk')}>{t45n('reports.action.cancel')}</INNOButton>
              </INNOEditorFooterStart>
              <INNOEditorFooterEnd>
                <INNOButton busy={mutation.isPending} onClick={submit}>{t45n('helpdesk.step45n.helpdeskOverview.createTicket')}</INNOButton>
              </INNOEditorFooterEnd>
            </INNOEditorFooter>
          </div>

          <aside className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>{t45n('reports.column.requester')}</h3><p>{t45n('helpdesk.step45n.ticketCreate.resolvedFromYourSignedInInnoOneProfile')}</p></div>
                <INNOStatus tone="success">{t45n('helpdesk.step45n.ticketCreate.matched')}</INNOStatus>
              </div>
              <div className="production-kv-grid">
                <div className="kv-row"><span>{t45n('admin.step45n.adminHierarchy.name')}</span><b>{profile.fullName}</b></div>
                <div className="kv-row"><span>{t45n('profile.organization')}</span><b>{profile.organization?.name ?? '—'}</b></div>
                <div className="kv-row"><span>{t45n('profile.location')}</span><b>{profile.location?.name ?? '—'}</b></div>
                <div className="kv-row"><span>{t45n('profile.employeeId')}</span><b>{profile.employeeId}</b></div>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </INNOPage>
  );
}
