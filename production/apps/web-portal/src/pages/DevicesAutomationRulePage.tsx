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
  createDeviceAutomationDefinition,
  getDeviceAutomationDefinition,
  getDeviceGroups,
  updateDeviceAutomationDefinition,
} from '../api/client';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';

type ConditionField = 'operatingSystem' | 'deviceType' | 'status' | 'groupId';
type ConditionOperator = 'equals' | 'not_equals' | 'contains';

function stringConfig(
  value: Record<string, unknown> | undefined,
  key: string,
): string {
  const candidate = value?.[key];
  return typeof candidate === 'string' ? candidate : '';
}

export function DevicesAutomationRulePage() {
  const { t } = useI18n();
  const { automationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canViewRuns = usePermission('devices.automation.run.view');
  const isNew = !automationId || automationId === 'new';

  const definition = useQuery({
    queryKey: ['devices', 'automation-definition', automationId],
    queryFn: () => getDeviceAutomationDefinition(automationId ?? ''),
    enabled: !isNew,
  });

  const groups = useQuery({
    queryKey: ['devices', 'groups', 'automation-editor'],
    queryFn: () => getDeviceGroups({ page: 1, pageSize: 100, status: 'active' }),
    staleTime: 30_000,
  });

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<'device.online' | 'device.offline'>('device.online');
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [conditionField, setConditionField] = useState<ConditionField>('operatingSystem');
  const [conditionOperator, setConditionOperator] = useState<ConditionOperator>('contains');
  const [conditionValue, setConditionValue] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [feedback, setFeedback] = useState('');

  const eligibleGroups = useMemo(
    () => (groups.data?.items ?? []).filter((group) => (
      group.groupType === 'static'
      && group.status === 'active'
      && group.syncStatus === 'local'
    )),
    [groups.data],
  );

  useEffect(() => {
    if (!definition.data) return;

    setName(definition.data.name);
    const triggerNode = definition.data.nodes.find((node) => node.kind === 'trigger');
    if (triggerNode?.catalogKey === 'device.offline') {
      setTrigger('device.offline');
    } else {
      setTrigger('device.online');
    }

    const triggerConfig = triggerNode?.configuration as Record<string, unknown> | undefined;
    const rawCondition = triggerConfig?.condition;
    if (rawCondition && typeof rawCondition === 'object' && !Array.isArray(rawCondition)) {
      const condition = rawCondition as Record<string, unknown>;
      const field = stringConfig(condition, 'field') as ConditionField;
      const operator = stringConfig(condition, 'operator') as ConditionOperator;
      setConditionEnabled(true);
      if (['operatingSystem', 'deviceType', 'status', 'groupId'].includes(field)) {
        setConditionField(field);
      }
      if (['equals', 'not_equals', 'contains'].includes(operator)) {
        setConditionOperator(operator);
      }
      setConditionValue(stringConfig(condition, 'value'));
    } else {
      setConditionEnabled(false);
      setConditionValue('');
    }

    const action = definition.data.nodes.find(
      (node) => node.catalogKey === 'devices.device.add_to_group',
    );
    setTargetGroupId(stringConfig(
      action?.configuration as Record<string, unknown> | undefined,
      'groupId',
    ));
  }, [definition.data]);

  useEffect(() => {
    if (!conditionEnabled) return;
    if (conditionField === 'groupId' || conditionField === 'status') {
      if (conditionOperator === 'contains') setConditionOperator('equals');
    }
  }, [conditionEnabled, conditionField, conditionOperator]);

  const conditionValid = !conditionEnabled || Boolean(conditionValue.trim());
  const formValid = Boolean(name.trim() && targetGroupId && conditionValid);

  const buildDefinition = () => {
    const triggerLabel = trigger === 'device.online' ? 'Device Online' : 'Device Offline';
    const triggerLabelKey = trigger === 'device.online'
      ? 'devices.automation.catalog.deviceOnline.label'
      : 'devices.automation.catalog.deviceOffline.label';
    const triggerDescription = trigger === 'device.online'
      ? 'Starts from an online device context.'
      : 'Starts from an offline device context.';
    const triggerDescriptionKey = trigger === 'device.online'
      ? 'devices.automation.catalog.deviceOnline.description'
      : 'devices.automation.catalog.deviceOffline.description';

    const condition = conditionEnabled ? {
      field: conditionField,
      operator: conditionOperator,
      value: conditionValue.trim(),
    } : undefined;

    const nodes: INNOWorkflowNode[] = [
      {
        id: 'when',
        kind: 'trigger',
        catalogKey: trigger,
        label: triggerLabel,
        labelKey: triggerLabelKey,
        description: triggerDescription,
        descriptionKey: triggerDescriptionKey,
        configuration: condition ? { condition } : {},
      },
      {
        id: 'then',
        kind: 'action',
        catalogKey: 'devices.device.add_to_group',
        label: 'Add to Group',
        labelKey: 'devices.automation.catalog.addToGroup.label',
        description: 'Adds the device to an INNO.One-owned local static group.',
        descriptionKey: 'devices.automation.catalog.addToGroup.description',
        configuration: { groupId: targetGroupId },
      },
      {
        id: 'end',
        kind: 'end',
        catalogKey: 'workflow.end',
        label: 'End',
        labelKey: 'devices.automation.catalog.end.label',
        description: 'Ends this remediation path.',
        descriptionKey: 'devices.automation.catalog.end.description',
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
      if (!name.trim()) throw new Error(t('devices.automation.editor.validation.name'));
      if (!targetGroupId) throw new Error(t('devices.automation.editor.validation.group'));
      if (!conditionValid) throw new Error(t('devices.automation.editor.validation.condition'));

      const payload = buildDefinition();
      return isNew
        ? createDeviceAutomationDefinition(payload)
        : updateDeviceAutomationDefinition(
            automationId ?? '',
            definition.data?.eTag ?? '',
            payload,
          );
    },
    onSuccess: async (saved) => {
      setFeedback(isNew
        ? t('devices.automation.editor.feedback.created')
        : t('devices.automation.editor.feedback.updated'));
      await queryClient.invalidateQueries({ queryKey: ['devices', 'automation-definitions'] });
      queryClient.setQueryData(
        ['devices', 'automation-definition', saved.id],
        saved,
      );
      if (isNew) {
        navigate('/devices/automation/' + saved.id, { replace: true });
      }
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

  const conditionOperators: ConditionOperator[] =
    conditionField === 'groupId' || conditionField === 'status'
      ? ['equals', 'not_equals']
      : ['equals', 'not_equals', 'contains'];

  const valueControl = conditionField === 'status' ? (
    <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
      <option value="">{t('devices.automation.editor.conditionValuePlaceholder')}</option>
      <option value="online">{t('devices.automation.editor.status.online')}</option>
      <option value="offline">{t('devices.automation.editor.status.offline')}</option>
    </select>
  ) : conditionField === 'deviceType' ? (
    <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
      <option value="">{t('devices.automation.editor.conditionValuePlaceholder')}</option>
      {['desktop', 'notebook', 'server', 'virtual', 'mobile'].map((value) => (
        <option key={value} value={value}>
          {t('devices.automation.editor.deviceType.' + value)}
        </option>
      ))}
    </select>
  ) : conditionField === 'groupId' ? (
    <select value={conditionValue} onChange={(event) => setConditionValue(event.target.value)}>
      <option value="">{t('devices.automation.editor.conditionValuePlaceholder')}</option>
      {groups.data?.items.map((group) => (
        <option key={group.id} value={group.id}>{group.name}</option>
      ))}
    </select>
  ) : (
    <input
      value={conditionValue}
      onChange={(event) => setConditionValue(event.target.value)}
      placeholder={t('devices.automation.editor.conditionValuePlaceholder')}
    />
  );

  return (
    <INNOPage
      eyebrow={t('devices.automation.eyebrow')}
      title={isNew
        ? t('devices.automation.editor.newTitle')
        : t('devices.automation.editor.editTitle')}
      description={t('devices.automation.editor.description')}
      actions={(
        <div className="workflow-builder-header-status">
          <INNOStatus tone="neutral">
            {definition.data
              ? t('devices.automation.editor.version', { version: definition.data.version })
              : t('devices.automation.editor.unsaved')}
          </INNOStatus>
          {canViewRuns && automationId && !isNew ? (
            <Link
              className="inno-link-button secondary"
              to={'/devices/automation/' + automationId + '/history'}
            >
              {t('devices.automation.history')}
            </Link>
          ) : null}
        </div>
      )}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('devices.automation.boundary.title')}</b>
        <span>{t('devices.automation.boundary.description')}</span>
      </div>

      <form
        className="device-automation-rule-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (formValid && !save.isPending) save.mutate();
        }}
      >
        <section className="device-automation-rule-card device-automation-rule-identity">
          <label className="field-block">
            <span>{t('devices.automation.editor.name')}</span>
            <input
              data-autofocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('devices.automation.editor.namePlaceholder')}
            />
          </label>
        </section>

        <section className="device-automation-rule-card">
          <div className="device-automation-rule-label">
            <b>{t('devices.automation.editor.when')}</b>
            <span>{t('devices.automation.editor.whenDescription')}</span>
          </div>
          <label className="field-block">
            <span>{t('devices.automation.editor.trigger')}</span>
            <select
              value={trigger}
              onChange={(event) => setTrigger(event.target.value as typeof trigger)}
            >
              <option value="device.online">{t('devices.automation.editor.trigger.online')}</option>
              <option value="device.offline">{t('devices.automation.editor.trigger.offline')}</option>
            </select>
          </label>
        </section>

        <section className="device-automation-rule-card">
          <div className="device-automation-rule-label">
            <b>{t('devices.automation.editor.if')}</b>
            <span>{t('devices.automation.editor.ifDescription')}</span>
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
            <span>{t('devices.automation.editor.ifEnabled')}</span>
          </label>
          {conditionEnabled ? (
            <div className="device-automation-condition-grid">
              <label className="field-block">
                <span>{t('devices.automation.editor.conditionField')}</span>
                <select
                  value={conditionField}
                  onChange={(event) => {
                    setConditionField(event.target.value as ConditionField);
                    setConditionValue('');
                  }}
                >
                  {(['operatingSystem', 'deviceType', 'status', 'groupId'] as ConditionField[]).map((field) => (
                    <option key={field} value={field}>
                      {t('devices.automation.editor.conditionField.' + field)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>{t('devices.automation.editor.conditionOperator')}</span>
                <select
                  value={conditionOperator}
                  onChange={(event) => setConditionOperator(event.target.value as ConditionOperator)}
                >
                  {conditionOperators.map((operator) => (
                    <option key={operator} value={operator}>
                      {t('devices.automation.editor.operator.' + operator)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>{t('devices.automation.editor.conditionValue')}</span>
                {valueControl}
              </label>
            </div>
          ) : null}
        </section>

        <section className="device-automation-rule-card">
          <div className="device-automation-rule-label">
            <b>{t('devices.automation.editor.then')}</b>
            <span>{t('devices.automation.editor.thenDescription')}</span>
          </div>
          <div className="device-automation-then-grid">
            <div className="field-block">
              <span>{t('devices.automation.editor.action')}</span>
              <div className="device-automation-readonly-value">
                {t('devices.automation.editor.action.addToGroup')}
              </div>
            </div>
            <label className="field-block">
              <span>{t('devices.automation.editor.targetGroup')}</span>
              <select
                value={targetGroupId}
                onChange={(event) => setTargetGroupId(event.target.value)}
                disabled={groups.isPending}
              >
                <option value="">{t('devices.automation.editor.targetGroupPlaceholder')}</option>
                {eligibleGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
          </div>
          {!groups.isPending && eligibleGroups.length === 0 ? (
            <span className="field-error">{t('devices.automation.editor.noEligibleGroups')}</span>
          ) : null}
          {groups.isError ? <ErrorState error={groups.error} retry={() => void groups.refetch()} /> : null}
        </section>
      </form>

      <INNOEditorFooter>
        <INNOEditorFooterStart>
          <Link className="inno-link-button secondary" to="/devices/automation">
            {t('devices.automation.editor.cancel')}
          </Link>
        </INNOEditorFooterStart>
        <INNOEditorFooterNote>
          {feedback || (formValid ? '' : (
            !name.trim()
              ? t('devices.automation.editor.validation.name')
              : !targetGroupId
                ? t('devices.automation.editor.validation.group')
                : t('devices.automation.editor.validation.condition')
          ))}
        </INNOEditorFooterNote>
        <INNOEditorFooterEnd>
          <INNOButton
            type="button"
            busy={save.isPending}
            disabled={!formValid || groups.isPending}
            onClick={() => { if (formValid && !save.isPending) save.mutate(); }}
          >
            {isNew
              ? t('devices.automation.editor.save')
              : t('devices.automation.editor.saveVersion')}
          </INNOButton>
        </INNOEditorFooterEnd>
      </INNOEditorFooter>
    </INNOPage>
  );
}
