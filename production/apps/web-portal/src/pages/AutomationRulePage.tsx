import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { INNOButton, INNOPage } from '@inno/ui';
import {
  createAutomationRule,
  getAutomationRule,
  updateAutomationRule,
  type AutomationRuleInput,
} from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

const defaults: AutomationRuleInput = {
  name: '',
  ruleType: 'Assignment',
  trigger: 'ticket_created',
  scopeType: 'all',
  scopeValue: '',
  conditionField: 'category',
  conditionOperator: 'equals',
  conditionValue: '',
  actionType: 'assign_team',
  actionValue: 'Support L1',
  status: 'active',
  sortOrder: 100,
};

export function AutomationRulePage() {
  const { ruleId } = useParams();
  const isNew = !ruleId || ruleId === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['helpdesk', 'automation-rule', ruleId],
    queryFn: () => getAutomationRule(ruleId ?? ''),
    enabled: !isNew,
  });

  const [form, setForm] = useState<AutomationRuleInput>(defaults);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setForm({
      name: query.data.name,
      ruleType: query.data.ruleType,
      trigger: query.data.trigger,
      scopeType: query.data.scopeType,
      scopeValue: query.data.scopeValue ?? '',
      conditionField: query.data.conditionField,
      conditionOperator: query.data.conditionOperator,
      conditionValue: query.data.conditionValue,
      actionType: query.data.actionType,
      actionValue: query.data.actionValue,
      status: query.data.status,
      sortOrder: query.data.sortOrder,
    });
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => isNew
      ? createAutomationRule(form)
      : updateAutomationRule(ruleId ?? '', query.data?.eTag ?? '', form),
    onSuccess: async (saved) => {
      setSaveError('');
      await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'automation-rules'] });
      if (isNew) {
        navigate('/helpdesk/automation/' + saved.id, { replace: true });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'automation-rule', ruleId] });
      }
    },
    onError: (error: Error) => setSaveError(error.message),
  });

  const patch = (value: Partial<AutomationRuleInput>) => setForm((current) => ({ ...current, ...value }));
  const escalates = form.actionType === 'escalate_manager_chain';

  if (!isNew && query.isPending) {
    return <div className="page-loading-wrap"><LoadingState label="Loading automation rule…" /></div>;
  }
  if (!isNew && query.isError) {
    return <div className="page-error-wrap"><ErrorState error={query.error} retry={() => void query.refetch()} /></div>;
  }

  return (
    <INNOPage eyebrow="Helpdesk · Automation" title={isNew ? 'New Automation Rule' : 'Edit Automation Rule'}>
      <div className="resource-breadcrumb">
        <Link to="/helpdesk">Helpdesk</Link><span>›</span>
        <Link to="/helpdesk/automation">Automation</Link><span>›</span>
        <span>{isNew ? 'New Rule' : query.data?.name}</span>
      </div>

      <div className="automation-editor-layout">
        <div className="panel-stack">
          <section className="prod-panel">
            <div className="prod-panel-head">
              <div><h3>{form.name || 'Untitled automation rule'}</h3><p>Trigger, conditions and resulting action.</p></div>
              <span className={'prod-tag ' + (form.status === 'active' ? 'success' : '')}>{form.status === 'active' ? 'Active' : 'Paused'}</span>
            </div>
            <div className="editor-form">
              {saveError ? <div className="form-error" role="alert">{saveError}</div> : null}
              <div className="editor-grid">
                <label className="field-block field-wide">
                  <span>Rule name</span>
                  <input required value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Describe the automation purpose" />
                </label>
                <label className="field-block">
                  <span>Type</span>
                  <select value={form.ruleType} onChange={(event) => patch({ ruleType: event.target.value })}>
                    <option>Assignment</option>
                    <option>Escalation</option>
                    <option>Classification</option>
                    <option>Routing</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Trigger</span>
                  <select value={form.trigger} onChange={(event) => patch({ trigger: event.target.value })}>
                    <option value="ticket_created">Ticket created</option>
                    <option value="ticket_updated">Ticket updated</option>
                    <option value="sla_at_risk">SLA at risk</option>
                    <option value="status_changed">Status changed</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Scope</span>
                  <select value={form.scopeType} onChange={(event) => patch({ scopeType: event.target.value })}>
                    <option value="all">All tickets</option>
                    <option value="category">Category</option>
                    <option value="priority">Priority</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Scope value</span>
                  <input value={form.scopeValue ?? ''} disabled={form.scopeType === 'all'} onChange={(event) => patch({ scopeValue: event.target.value })} placeholder={form.scopeType === 'priority' ? 'P1' : 'network-vpn'} />
                </label>
              </div>

              <div className="automation-condition">
                <div>
                  <label className="field-block">
                    <span>Condition field</span>
                    <select value={form.conditionField} onChange={(event) => patch({ conditionField: event.target.value })}>
                      <option value="category">Category</option>
                      <option value="priority">Priority</option>
                      <option value="status">Status</option>
                      <option value="business_calendar">Business Calendar</option>
                    </select>
                  </label>
                </div>
                <div>
                  <label className="field-block">
                    <span>Operator</span>
                    <select value={form.conditionOperator} onChange={(event) => patch({ conditionOperator: event.target.value })}>
                      <option value="equals">equals</option>
                      <option value="contains">contains</option>
                    </select>
                  </label>
                </div>
                <div>
                  <label className="field-block">
                    <span>Value</span>
                    <input value={form.conditionValue} onChange={(event) => patch({ conditionValue: event.target.value })} placeholder={form.conditionField === 'business_calendar' ? 'outside' : 'VPN'} />
                  </label>
                </div>
              </div>

              <div className="editor-grid automation-action-grid">
                <label className="field-block">
                  <span>Primary action</span>
                  <select value={form.actionType} onChange={(event) => patch({ actionType: event.target.value })}>
                    <option value="assign_team">Assign team</option>
                    <option value="set_priority">Set priority</option>
                    <option value="escalate_manager_chain">Escalate to manager chain</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Action value</span>
                  {form.actionType === 'set_priority' ? (
                    <select value={form.actionValue} onChange={(event) => patch({ actionValue: event.target.value })}>
                      <option>P1</option><option>P2</option><option>P3</option><option>P4</option>
                    </select>
                  ) : (
                    <input value={form.actionValue} onChange={(event) => patch({ actionValue: event.target.value })} placeholder="Network Support" />
                  )}
                </label>
                <label className="field-block">
                  <span>Rule status</span>
                  <select value={form.status} onChange={(event) => patch({ status: event.target.value })}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Order</span>
                  <input type="number" min={1} value={form.sortOrder ?? 100} onChange={(event) => patch({ sortOrder: Number(event.target.value) })} />
                </label>
              </div>
            </div>
          </section>

          {escalates ? (
            <section className="prod-panel">
              <div className="prod-panel-head">
                <div><h3>Escalation sequence</h3><p>The active SLA policy supplies the level thresholds.</p></div>
                <span className="prod-tag">3 levels</span>
              </div>
              <div className="automation-escalation-summary">
                <div><b>Level 1 · Team Lead</b><span>75% of resolution target</span></div>
                <div><b>Level 2 · Service Manager</b><span>90% of resolution target</span></div>
                <div><b>Level 3 · Breach owner</b><span>At SLA breach</span></div>
              </div>
            </section>
          ) : null}

          <div className="editor-footer standalone-editor-footer">
            <Link className="inno-link-button secondary-link" to="/helpdesk/automation">Cancel</Link>
            <INNOButton
              disabled={mutation.isPending || !form.name.trim() || !form.conditionValue.trim() || !form.actionValue.trim()}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Saving rule…' : 'Save Rule'}
            </INNOButton>
          </div>
        </div>

        <aside className="panel-stack">
          <section className="prod-panel">
            <div className="prod-panel-head"><div><h3>Rule behavior</h3><p>Current definition summary.</p></div></div>
            <div className="production-kv-grid ticket-properties">
              <div className="kv-row"><span>Trigger</span><b>{form.trigger.replaceAll('_', ' ')}</b></div>
              <div className="kv-row"><span>Condition</span><b>{form.conditionField.replaceAll('_', ' ')} {form.conditionOperator} {form.conditionValue || '—'}</b></div>
              <div className="kv-row"><span>Action</span><b>{form.actionType.replaceAll('_', ' ')} · {form.actionValue}</b></div>
              <div className="kv-row"><span>Status</span><b>{form.status}</b></div>
            </div>
          </section>

          {!isNew && query.data ? (
            <section className="prod-panel">
              <div className="prod-panel-head"><div><h3>Recent executions</h3><p>Latest idempotent worker evaluations.</p></div></div>
              <div className="automation-execution-list">
                {query.data.recentExecutions.length ? query.data.recentExecutions.map((execution) => (
                  <Link to={'/helpdesk/tickets/' + execution.ticketId} className="automation-execution-row" key={execution.id}>
                    <div><b>{execution.result}</b><span>{execution.trigger.replaceAll('_', ' ')}</span></div>
                    <time>{new Date(execution.executedAt).toLocaleString()}</time>
                  </Link>
                )) : <div className="compact-empty">This rule has not executed yet.</div>}
              </div>
            </section>
          ) : null}

          <div className="purpose-note">
            <b>Automation is bounded to contracted actions.</b>
            <span>Step 18 implements team assignment, priority classification and SLA escalation actions only.</span>
          </div>
        </aside>
      </div>
    </INNOPage>
  );
}
