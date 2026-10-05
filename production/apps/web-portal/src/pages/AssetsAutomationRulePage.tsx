import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOEditorFooter,
  INNOEditorFooterEnd,
  INNOEditorFooterNote,
  INNOEditorFooterStart,
  INNOPage,
  INNOStatus,
} from '@inno/ui';
import type { INNOWorkflowEdge, INNOWorkflowNode } from '@inno/ui/workflow';
import {
  createAssetsAutomationDefinition,
  getAssetsAutomationDefinition,
  getSoftwareBaselines,
  updateAssetsAutomationDefinition,
} from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';

type TriggerCatalog =
  | 'assets.asset.lifecycle_status'
  | 'assets.asset.owner_unassigned'
  | 'assets.asset.warranty_expiring'
  | 'assets.asset.baseline_drift'
  | 'assets.license.overused';
type ActionCatalog =
  | 'assets.asset.set_lifecycle_status'
  | 'helpdesk.ticket.create';
type ConditionOperator = 'equals' | 'not_equals' | 'contains';

const ASSET_FIELDS = ['category', 'lifecycleStatus', 'ownerState'] as const;
const LICENSE_FIELDS = ['vendor', 'licenseModel', 'compliance'] as const;
type AssetConditionField = typeof ASSET_FIELDS[number];
type LicenseConditionField = typeof LICENSE_FIELDS[number];
type ConditionField = AssetConditionField | LicenseConditionField;

const LIFECYCLE_STATUSES = ['in_use', 'stock', 'repair', 'retired'] as const;

function stringConfig(value: Record<string, unknown> | undefined, key: string): string {
  const candidate = value?.[key];
  return typeof candidate === 'string' ? candidate : '';
}

function numberConfig(value: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const candidate = value?.[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
}

function isLicenseTrigger(trigger: TriggerCatalog) {
  return trigger === 'assets.license.overused';
}

export function AssetsAutomationRulePage() {
  const { t } = useI18n();
  const { automationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !automationId || automationId === 'new';
  const canViewRuns = usePermission('assets.automation.run.view');
  const canViewAssets = usePermission('assets.view');
  const canManageAssets = usePermission('assets.manage');
  const canManageLicenses = usePermission('assets.license.manage');
  const canCreateTicket = usePermission('helpdesk.ticket.create');

  const definition = useQuery({
    queryKey: ['assets', 'automation-definition', automationId],
    queryFn: () => getAssetsAutomationDefinition(automationId ?? ''),
    enabled: !isNew,
  });

  const baselines = useQuery({
    queryKey: ['assets', 'automation-baselines'],
    queryFn: () => getSoftwareBaselines({ status: 'active' }),
    enabled: canViewAssets,
    staleTime: 30_000,
  });

  const availableTriggers = useMemo<TriggerCatalog[]>(() => {
    const result: TriggerCatalog[] = [];
    if (canViewAssets) {
      result.push(
        'assets.asset.lifecycle_status',
        'assets.asset.owner_unassigned',
        'assets.asset.warranty_expiring',
        'assets.asset.baseline_drift',
      );
    }
    if (canManageLicenses) result.push('assets.license.overused');
    return result;
  }, [canViewAssets, canManageLicenses]);

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<TriggerCatalog>('assets.asset.lifecycle_status');
  const [triggerStatus, setTriggerStatus] = useState('in_use');
  const [withinDays, setWithinDays] = useState(30);
  const [baselineId, setBaselineId] = useState('');
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [conditionField, setConditionField] = useState<ConditionField>('category');
  const [conditionOperator, setConditionOperator] = useState<ConditionOperator>('equals');
  const [conditionValue, setConditionValue] = useState('');
  const [action, setAction] = useState<ActionCatalog>(
    canManageAssets ? 'assets.asset.set_lifecycle_status' : 'helpdesk.ticket.create',
  );
  const [targetStatus, setTargetStatus] = useState('repair');
  const [ticketSubject, setTicketSubject] = useState('Asset automation requires attention');
  const [ticketDescription, setTicketDescription] = useState('Review the resource raised by Assets automation.');
  const [ticketPriority, setTicketPriority] = useState('P3');
  const [feedback, setFeedback] = useState('');

  const licenseTrigger = isLicenseTrigger(trigger);
  const allowedActions = useMemo<ActionCatalog[]>(() => {
    const result: ActionCatalog[] = [];
    if (!licenseTrigger && canManageAssets) result.push('assets.asset.set_lifecycle_status');
    const canReadSource = licenseTrigger ? canManageLicenses : canViewAssets;
    if (canCreateTicket && canReadSource) result.push('helpdesk.ticket.create');
    return result;
  }, [
    licenseTrigger,
    canManageAssets,
    canManageLicenses,
    canViewAssets,
    canCreateTicket,
  ]);

  useEffect(() => {
    if (availableTriggers.length && !availableTriggers.includes(trigger)) {
      setTrigger(availableTriggers[0]);
    }
  }, [availableTriggers, trigger]);

  useEffect(() => {
    if (allowedActions.length && !allowedActions.includes(action)) {
      setAction(allowedActions[0]);
    }
  }, [action, allowedActions]);

  useEffect(() => {
    if (!definition.data) return;

    setName(definition.data.name);
    const triggerNode = definition.data.nodes.find((node) => node.kind === 'trigger');
    const catalog = triggerNode?.catalogKey as TriggerCatalog | undefined;
    if (catalog && [
      'assets.asset.lifecycle_status',
      'assets.asset.owner_unassigned',
      'assets.asset.warranty_expiring',
      'assets.asset.baseline_drift',
      'assets.license.overused',
    ].includes(catalog)) {
      setTrigger(catalog);
    }

    const triggerConfig = triggerNode?.configuration as Record<string, unknown> | undefined;
    setTriggerStatus(stringConfig(triggerConfig, 'status') || 'in_use');
    setWithinDays(numberConfig(triggerConfig, 'withinDays', 30));
    setBaselineId(stringConfig(triggerConfig, 'baselineId'));

    const rawCondition = triggerConfig?.condition;
    if (rawCondition && typeof rawCondition === 'object' && !Array.isArray(rawCondition)) {
      const condition = rawCondition as Record<string, unknown>;
      const field = stringConfig(condition, 'field') as ConditionField;
      const operator = stringConfig(condition, 'operator') as ConditionOperator;
      setConditionEnabled(true);
      setConditionField(field || (catalog === 'assets.license.overused' ? 'vendor' : 'category'));
      setConditionOperator(
        ['equals', 'not_equals', 'contains'].includes(operator) ? operator : 'equals',
      );
      setConditionValue(stringConfig(condition, 'value'));
    } else {
      setConditionEnabled(false);
      setConditionField(catalog === 'assets.license.overused' ? 'vendor' : 'category');
      setConditionValue('');
    }

    const actionNode = definition.data.nodes.find((node) => node.kind === 'action');
    const actionCatalog = actionNode?.catalogKey as ActionCatalog | undefined;
    if (actionCatalog === 'assets.asset.set_lifecycle_status' || actionCatalog === 'helpdesk.ticket.create') {
      setAction(actionCatalog);
    }
    const actionConfig = actionNode?.configuration as Record<string, unknown> | undefined;
    setTargetStatus(stringConfig(actionConfig, 'status') || 'repair');
    setTicketSubject(stringConfig(actionConfig, 'subject') || 'Asset automation requires attention');
    setTicketDescription(stringConfig(actionConfig, 'description') || 'Review the resource raised by Assets automation.');
    setTicketPriority(stringConfig(actionConfig, 'priority') || 'P3');
  }, [definition.data]);

  useEffect(() => {
    setConditionField(licenseTrigger ? 'vendor' : 'category');
    setConditionValue('');
    if (licenseTrigger && action === 'assets.asset.set_lifecycle_status') {
      setAction('helpdesk.ticket.create');
    }
  }, [licenseTrigger]);

  useEffect(() => {
    if (conditionField === 'ownerState' || conditionField === 'compliance' || conditionField === 'lifecycleStatus') {
      if (conditionOperator === 'contains') setConditionOperator('equals');
    }
  }, [conditionField, conditionOperator]);

  const triggerValid = availableTriggers.includes(trigger) && (
    trigger === 'assets.asset.lifecycle_status'
    ? Boolean(triggerStatus)
    : trigger === 'assets.asset.warranty_expiring'
      ? Number.isFinite(withinDays) && withinDays >= 0 && withinDays <= 3650
      : trigger === 'assets.asset.baseline_drift'
        ? Boolean(baselineId)
        : true);
  const conditionValid = !conditionEnabled || Boolean(conditionValue.trim());
  const actionValid = allowedActions.includes(action)
    && (action === 'assets.asset.set_lifecycle_status'
      ? Boolean(targetStatus)
      : Boolean(ticketSubject.trim() && ticketDescription.trim() && ticketPriority));
  const formValid = Boolean(name.trim() && triggerValid && conditionValid && actionValid);

  const buildDefinition = () => {
    const triggerMeta: Record<TriggerCatalog, { label: string; labelKey: string; description: string; descriptionKey: string }> = {
      'assets.asset.lifecycle_status': {
        label: 'Lifecycle Status',
        labelKey: 'assets.automation.catalog.lifecycle.label',
        description: 'Requires the selected Asset to be in the configured lifecycle state.',
        descriptionKey: 'assets.automation.catalog.lifecycle.description',
      },
      'assets.asset.owner_unassigned': {
        label: 'Owner Unassigned',
        labelKey: 'assets.automation.catalog.ownerUnassigned.label',
        description: 'Requires the selected Asset to have no owner.',
        descriptionKey: 'assets.automation.catalog.ownerUnassigned.description',
      },
      'assets.asset.warranty_expiring': {
        label: 'Warranty Expiring',
        labelKey: 'assets.automation.catalog.warrantyExpiring.label',
        description: 'Requires the Asset warranty to be inside the configured threshold.',
        descriptionKey: 'assets.automation.catalog.warrantyExpiring.description',
      },
      'assets.asset.baseline_drift': {
        label: 'Baseline Missing',
        labelKey: 'assets.automation.catalog.baselineDrift.label',
        description: 'Requires the latest persisted software baseline result to be missing.',
        descriptionKey: 'assets.automation.catalog.baselineDrift.description',
      },
      'assets.license.overused': {
        label: 'License Overused',
        labelKey: 'assets.automation.catalog.licenseOverused.label',
        description: 'Requires used seats to exceed entitled seats.',
        descriptionKey: 'assets.automation.catalog.licenseOverused.description',
      },
    };
    const meta = triggerMeta[trigger];
    const configuration: Record<string, unknown> = {};
    if (trigger === 'assets.asset.lifecycle_status') configuration.status = triggerStatus;
    if (trigger === 'assets.asset.warranty_expiring') configuration.withinDays = withinDays;
    if (trigger === 'assets.asset.baseline_drift') configuration.baselineId = baselineId;
    if (conditionEnabled) {
      configuration.condition = {
        field: conditionField,
        operator: conditionOperator,
        value: conditionValue.trim(),
      };
    }

    const actionConfiguration = action === 'assets.asset.set_lifecycle_status'
      ? { status: targetStatus }
      : {
          subject: ticketSubject.trim(),
          description: ticketDescription.trim(),
          priority: ticketPriority,
        };
    const actionMeta = action === 'assets.asset.set_lifecycle_status'
      ? {
          label: 'Update Lifecycle',
          labelKey: 'assets.automation.catalog.setLifecycle.label',
          description: 'Updates the selected Asset lifecycle state using the normal Assets permission boundary.',
          descriptionKey: 'assets.automation.catalog.setLifecycle.description',
        }
      : {
          label: 'Create Helpdesk Ticket',
          labelKey: 'assets.automation.catalog.createTicket.label',
          description: 'Creates a Helpdesk ticket using the automation actor current Helpdesk permission.',
          descriptionKey: 'assets.automation.catalog.createTicket.description',
        };

    const nodes: INNOWorkflowNode[] = [
      {
        id: 'when',
        kind: 'trigger',
        catalogKey: trigger,
        label: meta.label,
        labelKey: meta.labelKey,
        description: meta.description,
        descriptionKey: meta.descriptionKey,
        configuration,
      },
      {
        id: 'then',
        kind: 'action',
        catalogKey: action,
        label: actionMeta.label,
        labelKey: actionMeta.labelKey,
        description: actionMeta.description,
        descriptionKey: actionMeta.descriptionKey,
        configuration: actionConfiguration,
      },
      {
        id: 'end',
        kind: 'end',
        catalogKey: 'workflow.end',
        label: 'End',
        labelKey: 'assets.automation.catalog.end.label',
        description: 'Ends this automation path.',
        descriptionKey: 'assets.automation.catalog.end.description',
        configuration: {},
      },
    ];
    const edges: INNOWorkflowEdge[] = [
      { id: 'edge_when_then', source: 'when', target: 'then' },
      { id: 'edge_then_end', source: 'then', target: 'end' },
    ];
    return { name: name.trim(), nodes, edges, orientation: 'horizontal' as const };
  };

  const save = useMutation({
    mutationFn: () => {
      if (!formValid) throw new Error(t('assets.automation.editor.validation.action'));
      const payload = buildDefinition();
      return isNew
        ? createAssetsAutomationDefinition(payload)
        : updateAssetsAutomationDefinition(
            automationId ?? '',
            definition.data?.eTag ?? '',
            payload,
          );
    },
    onSuccess: async (saved) => {
      setFeedback(isNew
        ? t('assets.automation.editor.feedback.created')
        : t('assets.automation.editor.feedback.updated'));
      await queryClient.invalidateQueries({ queryKey: ['assets', 'automation-definitions'] });
      queryClient.setQueryData(['assets', 'automation-definition', saved.id], saved);
      if (isNew) navigate('/assets/automation/' + saved.id, { replace: true });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  if (!isNew && definition.isPending) {
    return <div className="page-loading-wrap"><LoadingState /></div>;
  }
  if (!isNew && definition.isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState error={definition.error} retry={() => void definition.refetch()} />
      </div>
    );
  }

  const conditionFields: ConditionField[] = licenseTrigger
    ? [...LICENSE_FIELDS]
    : [...ASSET_FIELDS];
  const constrainedCondition = ['ownerState', 'compliance', 'lifecycleStatus'].includes(conditionField);
  const operators: ConditionOperator[] = constrainedCondition
    ? ['equals', 'not_equals']
    : ['equals', 'not_equals', 'contains'];

  const conditionValueControl = conditionField === 'ownerState' ? (
    <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
      <option value="">{t('assets.automation.editor.conditionValuePlaceholder')}</option>
      <option value="assigned">{t('assets.automation.editor.owner.assigned')}</option>
      <option value="unassigned">{t('assets.automation.editor.owner.unassigned')}</option>
    </select>
  ) : conditionField === 'compliance' ? (
    <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
      <option value="">{t('assets.automation.editor.conditionValuePlaceholder')}</option>
      <option value="overused">{t('assets.automation.editor.compliance.overused')}</option>
      <option value="compliant">{t('assets.automation.editor.compliance.compliant')}</option>
    </select>
  ) : conditionField === 'lifecycleStatus' ? (
    <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
      <option value="">{t('assets.automation.editor.conditionValuePlaceholder')}</option>
      {LIFECYCLE_STATUSES.map((value) => (
        <option key={value} value={value}>{t('assets.automation.editor.lifecycle.' + value)}</option>
      ))}
    </select>
  ) : (
    <input
      value={conditionValue}
      onChange={(event) => setConditionValue(event.target.value)}
      placeholder={t('assets.automation.editor.conditionValuePlaceholder')}
    />
  );

  return (
    <INNOPage
      eyebrow={t('assets.automation.eyebrow')}
      title={isNew
        ? t('assets.automation.editor.newTitle')
        : t('assets.automation.editor.editTitle')}
      description={t('assets.automation.editor.description')}
      actions={(
        <div className="workflow-builder-header-status">
          <INNOStatus tone="neutral">
            {definition.data
              ? t('assets.automation.editor.version', { version: definition.data.version })
              : t('assets.automation.editor.unsaved')}
          </INNOStatus>
          {canViewRuns && automationId && !isNew ? (
            <Link className="inno-link-button secondary" to={'/assets/automation/' + automationId + '/runs'}>
              {t('assets.automation.runs')}
            </Link>
          ) : null}
        </div>
      )}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('assets.automation.boundary.title')}</b>
        <span>{t('assets.automation.boundary.description')}</span>
      </div>

      <form className="device-automation-rule-form" onSubmit={(event) => {
        event.preventDefault();
        if (formValid && !save.isPending) save.mutate();
      }}>
        <section className="device-automation-rule-card device-automation-rule-identity">
          <label className="field-block">
            <span>{t('assets.automation.editor.name')}</span>
            <input
              data-autofocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('assets.automation.editor.namePlaceholder')}
            />
          </label>
        </section>

        <section className="device-automation-rule-card">
          <div className="device-automation-rule-label">
            <b>{t('assets.automation.editor.when')}</b>
            <span>{t('assets.automation.editor.whenDescription')}</span>
          </div>
          <div className="asset-automation-config-stack">
            <label className="field-block">
              <span>{t('assets.automation.editor.trigger')}</span>
              <select value={trigger} onChange={(event) => setTrigger(event.target.value as TriggerCatalog)}>
                {availableTriggers.map((value) => {
                  const key = value === 'assets.asset.lifecycle_status' ? 'lifecycle'
                    : value === 'assets.asset.owner_unassigned' ? 'ownerUnassigned'
                      : value === 'assets.asset.warranty_expiring' ? 'warrantyExpiring'
                        : value === 'assets.asset.baseline_drift' ? 'baselineDrift'
                          : 'licenseOverused';
                  return <option key={value} value={value}>{t('assets.automation.editor.trigger.' + key)}</option>;
                })}
              </select>
            </label>

            {trigger === 'assets.asset.lifecycle_status' ? (
              <label className="field-block">
                <span>{t('assets.automation.editor.triggerStatus')}</span>
                <select value={triggerStatus} onChange={(event) => setTriggerStatus(event.target.value)}>
                  {LIFECYCLE_STATUSES.map((value) => (
                    <option key={value} value={value}>{t('assets.automation.editor.lifecycle.' + value)}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {trigger === 'assets.asset.warranty_expiring' ? (
              <label className="field-block">
                <span>{t('assets.automation.editor.withinDays')}</span>
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={withinDays}
                  onChange={(event) => setWithinDays(Number(event.target.value))}
                />
              </label>
            ) : null}

            {trigger === 'assets.asset.baseline_drift' ? (
              <label className="field-block">
                <span>{t('assets.automation.editor.baseline')}</span>
                <select value={baselineId} onChange={(event) => setBaselineId(event.target.value)}>
                  <option value="">{t('assets.automation.editor.baselinePlaceholder')}</option>
                  {baselines.data?.items.map((baseline) => (
                    <option key={baseline.id} value={baseline.id}>{baseline.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </section>

        <section className="device-automation-rule-card">
          <div className="device-automation-rule-label">
            <b>{t('assets.automation.editor.if')}</b>
            <span>{t('assets.automation.editor.ifDescription')}</span>
          </div>
          <label className="device-automation-condition-toggle">
            <input
              type="checkbox"
              checked={conditionEnabled}
              onChange={(event) => {
                setConditionEnabled(event.target.checked);
                if (!event.target.checked) setConditionValue('');
              }}
            />
            <span>{t('assets.automation.editor.ifEnabled')}</span>
          </label>
          {conditionEnabled ? (
            <div className="device-automation-condition-grid">
              <label className="field-block">
                <span>{t('assets.automation.editor.conditionField')}</span>
                <select value={conditionField} onChange={(event) => {
                  setConditionField(event.target.value as ConditionField);
                  setConditionValue('');
                }}>
                  {conditionFields.map((field) => (
                    <option key={field} value={field}>
                      {t('assets.automation.editor.' + (licenseTrigger ? 'licenseField.' : 'assetField.') + field)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>{t('assets.automation.editor.operator')}</span>
                <select value={conditionOperator} onChange={(event) => setConditionOperator(event.target.value as ConditionOperator)}>
                  {operators.map((operator) => (
                    <option key={operator} value={operator}>{t('assets.automation.editor.operator.' + operator)}</option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>{t('assets.automation.editor.conditionValue')}</span>
                {conditionValueControl}
              </label>
            </div>
          ) : null}
        </section>

        <section className="device-automation-rule-card">
          <div className="device-automation-rule-label">
            <b>{t('assets.automation.editor.then')}</b>
            <span>{t('assets.automation.editor.thenDescription')}</span>
          </div>
          <div className="asset-automation-config-stack">
            <label className="field-block">
              <span>{t('assets.automation.editor.action')}</span>
              <select
                value={action}
                onChange={(event) => setAction(event.target.value as ActionCatalog)}
                disabled={allowedActions.length < 2}
              >
                {allowedActions.map((value) => (
                  <option key={value} value={value}>
                    {t('assets.automation.editor.action.' + (value === 'assets.asset.set_lifecycle_status' ? 'lifecycle' : 'ticket'))}
                  </option>
                ))}
              </select>
            </label>

            {action === 'assets.asset.set_lifecycle_status' ? (
              <label className="field-block">
                <span>{t('assets.automation.editor.targetStatus')}</span>
                <select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>
                  {LIFECYCLE_STATUSES.map((value) => (
                    <option key={value} value={value}>{t('assets.automation.editor.lifecycle.' + value)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="field-block">
                  <span>{t('assets.automation.editor.ticketSubject')}</span>
                  <input
                    value={ticketSubject}
                    maxLength={240}
                    onChange={(event) => setTicketSubject(event.target.value)}
                    placeholder={t('assets.automation.editor.ticketSubjectPlaceholder')}
                  />
                </label>
                <label className="field-block">
                  <span>{t('assets.automation.editor.ticketDescription')}</span>
                  <textarea
                    value={ticketDescription}
                    maxLength={12000}
                    rows={4}
                    onChange={(event) => setTicketDescription(event.target.value)}
                    placeholder={t('assets.automation.editor.ticketDescriptionPlaceholder')}
                  />
                  <small>{t(licenseTrigger ? 'assets.automation.editor.tokens.license' : 'assets.automation.editor.tokens.asset')}</small>
                </label>
                <label className="field-block">
                  <span>{t('assets.automation.editor.ticketPriority')}</span>
                  <select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value)}>
                    {['P1', 'P2', 'P3', 'P4'].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
        </section>
      </form>

      <INNOEditorFooter>
        <INNOEditorFooterStart>
          <Link className="inno-link-button secondary" to="/assets/automation">
            {t('assets.automation.editor.cancel')}
          </Link>
        </INNOEditorFooterStart>
        <INNOEditorFooterNote>
          {feedback || (!formValid
            ? !name.trim()
              ? t('assets.automation.editor.validation.name')
              : !triggerValid
                ? t('assets.automation.editor.validation.trigger')
                : !conditionValid
                  ? t('assets.automation.editor.validation.condition')
                  : t('assets.automation.editor.validation.action')
            : '')}
        </INNOEditorFooterNote>
        <INNOEditorFooterEnd>
          <INNOButton
            type="button"
            busy={save.isPending}
            disabled={!formValid}
            onClick={() => { if (formValid && !save.isPending) save.mutate(); }}
          >
            {isNew
              ? t('assets.automation.editor.save')
              : t('assets.automation.editor.saveVersion')}
          </INNOButton>
        </INNOEditorFooterEnd>
      </INNOEditorFooter>
    </INNOPage>
  );
}
