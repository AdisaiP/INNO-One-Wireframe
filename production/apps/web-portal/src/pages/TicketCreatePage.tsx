import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { INNOButton, INNOPage } from '@inno/ui';
import { createTicket, getDevices, getTicketCategories } from '../api/client';
import { usePermission, useProfile } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import type { TicketCategoryNode } from '../api/types';

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
  const profile = useProfile();
  const canViewDevices = usePermission('devices.view');
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [impact, setImpact] = useState('Individual');
  const [urgency, setUrgency] = useState('Normal');
  const [relatedDeviceId, setRelatedDeviceId] = useState('');
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

  return (
    <INNOPage eyebrow="Helpdesk" title="Create Ticket">
      <p className="page-helper">Capture the request once. Device context is linked by ID without duplicating endpoint inventory.</p>

      {categories.isPending ? <LoadingState label="Loading ticket form…" /> : null}
      {categories.isError ? <ErrorState error={categories.error} retry={() => void categories.refetch()} /> : null}

      {!categories.isPending && !categories.isError ? (
        <div className="ticket-create-layout">
          <section className="prod-panel">
            <div className="prod-panel-head">
              <div>
                <h3>Request details</h3>
                <p>Describe what the requester needs support with.</p>
              </div>
              <span className="prod-tag">{calculatedPriority}</span>
            </div>

            <div className="editor-form">
              {formError ? <div className="form-error" role="alert">{formError}</div> : null}
              <div className="editor-grid">
                <label className="field-block field-wide">
                  <span>Subject</span>
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short summary of the issue" />
                </label>
                <label className="field-block field-wide">
                  <span>Description</span>
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} placeholder="What happened, what was expected and what has already been tried?" />
                </label>
                <label className="field-block">
                  <span>Category</span>
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    <option value="">Select category</option>
                    {categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <label className="field-block">
                  <span>Related device</span>
                  <select value={relatedDeviceId} onChange={(event) => setRelatedDeviceId(event.target.value)} disabled={!canViewDevices}>
                    <option value="">No related device</option>
                    {(devices.data?.items ?? []).map((device) => (
                      <option key={device.id} value={device.id}>{device.name} · {device.status}</option>
                    ))}
                  </select>
                  {!canViewDevices ? <small>Device linking is hidden without Devices access.</small> : null}
                </label>
                <label className="field-block">
                  <span>Impact</span>
                  <select value={impact} onChange={(event) => setImpact(event.target.value)}>
                    <option>Individual</option>
                    <option>Team</option>
                    <option>Department</option>
                    <option>Organization</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Urgency</span>
                  <select value={urgency} onChange={(event) => setUrgency(event.target.value)}>
                    <option>Normal</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
              </div>
              <div className="editor-footer">
                <INNOButton variant="secondary" onClick={() => navigate('/helpdesk')}>Cancel</INNOButton>
                <INNOButton disabled={mutation.isPending} onClick={submit}>
                  {mutation.isPending ? 'Creating ticket…' : 'Create Ticket'}
                </INNOButton>
              </div>
            </div>
          </section>

          <aside className="panel-stack">
            <section className="prod-panel">
              <div className="prod-panel-head"><div><h3>Requester</h3><p>Resolved from your signed-in INNO.One profile.</p></div><span className="prod-tag success">Matched</span></div>
              <div className="production-kv-grid">
                <div className="kv-row"><span>Name</span><b>{profile.fullName}</b></div>
                <div className="kv-row"><span>Organization</span><b>{profile.organization?.name ?? '—'}</b></div>
                <div className="kv-row"><span>Location</span><b>{profile.location?.name ?? '—'}</b></div>
                <div className="kv-row"><span>Employee ID</span><b>{profile.employeeId}</b></div>
              </div>
            </section>
            <div className="purpose-note">
              <b>Related context stays canonical.</b>
              <span>The ticket stores stable Device/User references only. Device inventory remains owned by the Devices module.</span>
            </div>
          </aside>
        </div>
      ) : null}
    </INNOPage>
  );
}
