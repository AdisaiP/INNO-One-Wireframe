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
  INNOIcon,
  INNOPage,
  INNOState,
  INNOStatus,
} from '@inno/ui';
import {
  INNOWorkflowCanvas,
  type INNOWorkflowEdge,
  type INNOWorkflowNode,
  type INNOWorkflowNodeKind,
  type INNOWorkflowValidationIssue,
} from '@inno/ui/workflow';
import '@inno/ui/workflow.css';
import {
  createHelpdeskAutomationDefinition,
  getHelpdeskAutomationDefinition,
  updateHelpdeskAutomationDefinition,
} from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import './WorkflowProductPages.css';

type CatalogItem = {
  key: string;
  kind: INNOWorkflowNodeKind;
  labelKey: string;
  descriptionKey: string;
  fallbackLabel: string;
  fallbackDescription: string;
};

const HELP_DESK_CATALOG: CatalogItem[] = [
  {
    key: 'helpdesk.ticket.created',
    kind: 'trigger',
    labelKey: 'helpdesk.automation.catalog.ticketCreated.label',
    descriptionKey: 'helpdesk.automation.catalog.ticketCreated.description',
    fallbackLabel: 'Ticket Created',
    fallbackDescription: 'Starts when a new Helpdesk ticket is created.',
  },
  {
    key: 'helpdesk.ticket.updated',
    kind: 'trigger',
    labelKey: 'helpdesk.automation.catalog.ticketUpdated.label',
    descriptionKey: 'helpdesk.automation.catalog.ticketUpdated.description',
    fallbackLabel: 'Ticket Updated',
    fallbackDescription: 'Starts when a tracked ticket field changes.',
  },
  {
    key: 'helpdesk.ticket.status_changed',
    kind: 'trigger',
    labelKey: 'helpdesk.automation.catalog.statusChanged.label',
    descriptionKey: 'helpdesk.automation.catalog.statusChanged.description',
    fallbackLabel: 'Status Changed',
    fallbackDescription: 'Starts when the ticket status changes.',
  },
  {
    key: 'helpdesk.sla.at_risk',
    kind: 'trigger',
    labelKey: 'helpdesk.automation.catalog.slaAtRisk.label',
    descriptionKey: 'helpdesk.automation.catalog.slaAtRisk.description',
    fallbackLabel: 'SLA At Risk',
    fallbackDescription: 'Starts when a ticket approaches its SLA target.',
  },
  {
    key: 'helpdesk.requester.reply',
    kind: 'trigger',
    labelKey: 'helpdesk.automation.catalog.requesterReply.label',
    descriptionKey: 'helpdesk.automation.catalog.requesterReply.description',
    fallbackLabel: 'Requester Replied',
    fallbackDescription: 'Starts when the requester adds a new reply.',
  },
  {
    key: 'helpdesk.ticket.condition',
    kind: 'condition',
    labelKey: 'helpdesk.automation.catalog.ticketCondition.label',
    descriptionKey: 'helpdesk.automation.catalog.ticketCondition.description',
    fallbackLabel: 'Ticket Condition',
    fallbackDescription: 'Checks ticket priority, category, status or requester context.',
  },
  {
    key: 'workflow.branch',
    kind: 'branch',
    labelKey: 'helpdesk.automation.catalog.branch.label',
    descriptionKey: 'helpdesk.automation.catalog.branch.description',
    fallbackLabel: 'Branch',
    fallbackDescription: 'Splits the automation into conditional paths.',
  },
  {
    key: 'helpdesk.manager.approval',
    kind: 'approval',
    labelKey: 'helpdesk.automation.catalog.managerApproval.label',
    descriptionKey: 'helpdesk.automation.catalog.managerApproval.description',
    fallbackLabel: 'Manager Approval',
    fallbackDescription: 'Waits for an approved manager decision.',
  },
  {
    key: 'helpdesk.ticket.assign_team',
    kind: 'assignment',
    labelKey: 'helpdesk.automation.catalog.assignTeam.label',
    descriptionKey: 'helpdesk.automation.catalog.assignTeam.description',
    fallbackLabel: 'Assign Team',
    fallbackDescription: 'Assigns the ticket to a Helpdesk team.',
  },
  {
    key: 'helpdesk.ticket.update',
    kind: 'action',
    labelKey: 'helpdesk.automation.catalog.updateTicket.label',
    descriptionKey: 'helpdesk.automation.catalog.updateTicket.description',
    fallbackLabel: 'Update Ticket',
    fallbackDescription: 'Updates supported ticket fields.',
  },
  {
    key: 'helpdesk.ticket.escalate',
    kind: 'action',
    labelKey: 'helpdesk.automation.catalog.escalateTicket.label',
    descriptionKey: 'helpdesk.automation.catalog.escalateTicket.description',
    fallbackLabel: 'Escalate Ticket',
    fallbackDescription: 'Escalates the ticket through the configured support chain.',
  },
  {
    key: 'workflow.wait',
    kind: 'wait',
    labelKey: 'helpdesk.automation.catalog.wait.label',
    descriptionKey: 'helpdesk.automation.catalog.wait.description',
    fallbackLabel: 'Wait',
    fallbackDescription: 'Pauses this path for a bounded delay or future event.',
  },
  {
    key: 'helpdesk.requester.notify',
    kind: 'notification',
    labelKey: 'helpdesk.automation.catalog.notifyRequester.label',
    descriptionKey: 'helpdesk.automation.catalog.notifyRequester.description',
    fallbackLabel: 'Notify Requester',
    fallbackDescription: 'Sends a Helpdesk notification to the requester.',
  },
  {
    key: 'workflow.end',
    kind: 'end',
    labelKey: 'helpdesk.automation.catalog.end.label',
    descriptionKey: 'helpdesk.automation.catalog.end.description',
    fallbackLabel: 'End',
    fallbackDescription: 'Ends this automation path.',
  },
];

function catalogNode(item: CatalogItem, id: string): INNOWorkflowNode {
  return {
    id,
    kind: item.kind,
    catalogKey: item.key,
    label: item.fallbackLabel,
    labelKey: item.labelKey,
    description: item.fallbackDescription,
    descriptionKey: item.descriptionKey,
    configuration: {},
  };
}

function catalogItem(key: string): CatalogItem {
  const item = HELP_DESK_CATALOG.find((candidate) => candidate.key === key);
  if (!item) throw new Error('Missing Helpdesk automation catalog item: ' + key);
  return item;
}

function starterNodes(): INNOWorkflowNode[] {
  return [
    catalogNode(catalogItem('helpdesk.ticket.created'), 'trigger'),
    catalogNode(catalogItem('helpdesk.ticket.assign_team'), 'assignment'),
    catalogNode(catalogItem('workflow.end'), 'end'),
  ];
}

function starterEdges(): INNOWorkflowEdge[] {
  return [
    { id: 'edge_trigger_assignment', source: 'trigger', target: 'assignment' },
    { id: 'edge_assignment_end', source: 'assignment', target: 'end' },
  ];
}

function nextNodeId(kind: INNOWorkflowNodeKind, nodes: INNOWorkflowNode[]) {
  let index = nodes.filter((node) => node.kind === kind).length + 1;
  let id = kind + '_' + index;
  while (nodes.some((node) => node.id === id)) {
    index += 1;
    id = kind + '_' + index;
  }
  return id;
}

function buildValidation(
  t: (key: string, params?: Record<string, string | number>) => string,
  nodes: INNOWorkflowNode[],
  edges: INNOWorkflowEdge[],
): INNOWorkflowValidationIssue[] {
  const issues: INNOWorkflowValidationIssue[] = [];
  const triggers = nodes.filter((node) => node.kind === 'trigger');
  const ends = nodes.filter((node) => node.kind === 'end');

  if (triggers.length !== 1) {
    if (triggers.length === 0) {
      issues.push({
        id: 'trigger-count',
        severity: 'error',
        message: t('helpdesk.automation.validation.triggerCount'),
      });
    } else {
      triggers.forEach((node, index) => issues.push({
        id: 'trigger-count-' + index,
        severity: 'error',
        nodeId: node.id,
        message: t('helpdesk.automation.validation.triggerCount'),
      }));
    }
  }

  if (!ends.length) {
    issues.push({
      id: 'missing-end',
      severity: 'error',
      message: t('helpdesk.automation.validation.missingEnd'),
    });
  }

  for (const node of nodes) {
    if (node.kind !== 'trigger' && !edges.some((edge) => edge.target === node.id)) {
      issues.push({
        id: 'missing-incoming-' + node.id,
        severity: 'warning',
        nodeId: node.id,
        message: t('helpdesk.automation.validation.missingIncoming'),
      });
    }
    if (node.kind !== 'end' && !edges.some((edge) => edge.source === node.id)) {
      issues.push({
        id: 'missing-outgoing-' + node.id,
        severity: 'warning',
        nodeId: node.id,
        message: t('helpdesk.automation.validation.missingOutgoing'),
      });
    }
  }

  return issues;
}

export function AutomationRulePage() {
  const { t } = useI18n();
  const { automationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !automationId || automationId === 'new';

  const query = useQuery({
    queryKey: ['helpdesk', 'automation-definition', automationId],
    queryFn: () => getHelpdeskAutomationDefinition(automationId ?? ''),
    enabled: !isNew,
  });

  const [name, setName] = useState('');
  const [nodes, setNodes] = useState<INNOWorkflowNode[]>(starterNodes);
  const [edges, setEdges] = useState<INNOWorkflowEdge[]>(starterEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('trigger');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setName(query.data.name);
    setNodes(query.data.nodes);
    setEdges(query.data.edges);
    setOrientation(query.data.orientation);
    setSelectedNodeId(query.data.nodes[0]?.id ?? null);
  }, [query.data]);

  const kindLabels = useMemo<Partial<Record<INNOWorkflowNodeKind, string>>>(() => ({
    trigger: t('workflow.kind.trigger'),
    action: t('workflow.kind.action'),
    condition: t('workflow.kind.condition'),
    branch: t('workflow.kind.branch'),
    approval: t('workflow.kind.approval'),
    assignment: t('workflow.kind.assignment'),
    wait: t('workflow.kind.wait'),
    notification: t('workflow.kind.notification'),
    ai: t('workflow.kind.ai'),
    subflow: t('workflow.kind.subflow'),
    end: t('workflow.kind.end'),
  }), [t]);

  const severityLabels = useMemo(() => ({
    error: t('workflow.severity.error'),
    warning: t('workflow.severity.warning'),
  }), [t]);

  const displayNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    label: node.labelKey ? t(node.labelKey) : node.label,
    description: node.descriptionKey ? t(node.descriptionKey) : node.description,
  })), [nodes, t]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const validation = useMemo(() => buildValidation(t, nodes, edges), [t, nodes, edges]);
  const errorCount = validation.filter((issue) => issue.severity === 'error').length;
  const warningCount = validation.filter((issue) => issue.severity === 'warning').length;
  const validDefinition = Boolean(name.trim())
    && nodes.filter((node) => node.kind === 'trigger').length === 1
    && nodes.some((node) => node.kind === 'end');

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), nodes, edges, orientation };
      if (!validDefinition) {
        throw new Error(t('helpdesk.automation.validation.name'));
      }
      return isNew
        ? createHelpdeskAutomationDefinition(payload)
        : updateHelpdeskAutomationDefinition(
            automationId ?? '',
            query.data?.eTag ?? '',
            payload,
          );
    },
    onSuccess: async (saved) => {
      setFeedback(isNew
        ? t('helpdesk.automation.feedback.created')
        : t('helpdesk.automation.feedback.updated'));
      await queryClient.invalidateQueries({ queryKey: ['helpdesk', 'automation-definitions'] });
      queryClient.setQueryData(
        ['helpdesk', 'automation-definition', saved.id],
        saved,
      );
      if (isNew) {
        navigate('/helpdesk/automation/' + saved.id, { replace: true });
      }
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  if (!isNew && query.isPending) {
    return <div className="page-loading-wrap"><LoadingState /></div>;
  }
  if (!isNew && query.isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  }

  const addNode = (item: CatalogItem) => {
    const id = nextNodeId(item.kind, nodes);
    setNodes((current) => [...current, catalogNode(item, id)]);
    setSelectedNodeId(id);
    setFeedback(t('helpdesk.automation.feedback.nodeAdded', { label: t(item.labelKey) }));
  };

  return (
    <INNOPage
      eyebrow={t('helpdesk.automation.eyebrow')}
      title={isNew
        ? t('helpdesk.automation.builder.newTitle')
        : name || t('helpdesk.automation.title')}
      description={t('helpdesk.automation.builder.description')}
      actions={(
        <div className="workflow-builder-header-status">
          <INNOStatus tone="neutral">
            {isNew
              ? t('helpdesk.automation.builder.newDefinition')
              : t('helpdesk.automation.builder.version', { version: query.data?.version ?? 1 })}
          </INNOStatus>
          <INNOStatus tone={errorCount ? 'danger' : warningCount ? 'warning' : 'success'}>
            {errorCount
              ? t('helpdesk.automation.builder.errors', { count: errorCount })
              : warningCount
                ? t('helpdesk.automation.builder.warnings', { count: warningCount })
                : t('helpdesk.automation.builder.valid')}
          </INNOStatus>
        </div>
      )}
    >
      <div className="workflow-product-boundary" role="status">
        <b>{t('helpdesk.automation.builder.definitionBoundary.title')}</b>
        <span>{t('helpdesk.automation.builder.definitionBoundary.description')}</span>
      </div>

      <section
        className="workflow-builder-shell"
        aria-label={t('helpdesk.automation.title')}
      >
        <aside
          className="workflow-builder-palette"
          aria-label={t('helpdesk.automation.builder.palette.title')}
        >
          <div className="workflow-builder-pane-head">
            <div>
              <b>{t('helpdesk.automation.builder.palette.title')}</b>
              <span>{t('helpdesk.automation.builder.palette.description')}</span>
            </div>
          </div>
          <div className="workflow-builder-palette-items">
            {HELP_DESK_CATALOG.map((item) => (
              <button key={item.key} type="button" onClick={() => addNode(item)}>
                <INNOIcon token="action.add" size={13} />
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="workflow-builder-canvas-pane">
          <div className="workflow-builder-pane-head">
            <div>
              <b>{t('helpdesk.automation.builder.canvas.title')}</b>
              <span>{t('helpdesk.automation.builder.canvas.description')}</span>
            </div>
            <div className="workflow-builder-canvas-actions">
              <INNOButton
                type="button"
                variant={orientation === 'horizontal' ? 'secondary' : 'ghost'}
                onClick={() => setOrientation('horizontal')}
              >
                {t('helpdesk.automation.builder.horizontal')}
              </INNOButton>
              <INNOButton
                type="button"
                variant={orientation === 'vertical' ? 'secondary' : 'ghost'}
                onClick={() => setOrientation('vertical')}
              >
                {t('helpdesk.automation.builder.vertical')}
              </INNOButton>
              <INNOStatus>
                {t('helpdesk.automation.builder.nodes', { count: nodes.length })}
              </INNOStatus>
            </div>
          </div>

          <INNOWorkflowCanvas
            ariaLabel={t('helpdesk.automation.builder.canvas.title')}
            nodes={displayNodes}
            edges={edges}
            validation={validation}
            selectedNodeId={selectedNodeId}
            onSelectedNodeChange={setSelectedNodeId}
            onConnect={(edge) => {
              if (edges.some((current) =>
                current.source === edge.source && current.target === edge.target
              )) return;
              setEdges((current) => [...current, {
                ...edge,
                id: 'edge_' + edge.source + '_' + edge.target + '_' + (current.length + 1),
              }]);
              setFeedback(t('helpdesk.automation.feedback.connectionAdded'));
            }}
            onDeleteNodes={(ids) => {
              setNodes((current) => current.filter((node) => !ids.includes(node.id)));
              setEdges((current) => current.filter((edge) =>
                !ids.includes(edge.source) && !ids.includes(edge.target)
              ));
              if (selectedNodeId && ids.includes(selectedNodeId)) {
                setSelectedNodeId(null);
              }
              setFeedback(ids.length === 1
                ? t('helpdesk.automation.feedback.nodeRemoved')
                : t('helpdesk.automation.feedback.nodesRemoved', { count: ids.length }));
            }}
            onDeleteEdges={(ids) => {
              setEdges((current) => current.filter((edge) => !ids.includes(edge.id)));
              setFeedback(ids.length === 1
                ? t('helpdesk.automation.feedback.connectionRemoved')
                : t('helpdesk.automation.feedback.connectionsRemoved', { count: ids.length }));
            }}
            onLayoutChange={(layout) => {
              setNodes((current) => current.map((node) => (
                layout[node.id] ? { ...node, layout: layout[node.id] } : node
              )));
            }}
            orientation={orientation}
            kindLabels={kindLabels}
            severityLabels={severityLabels}
            height={500}
          />
        </div>

        <aside
          className="workflow-builder-properties"
          aria-label={t('helpdesk.automation.builder.properties.title')}
        >
          <div className="workflow-builder-pane-head">
            <div>
              <b>{t('helpdesk.automation.builder.properties.title')}</b>
              <span>{t('helpdesk.automation.builder.properties.description')}</span>
            </div>
          </div>

          <label className="field-block">
            <span>{t('helpdesk.automation.builder.name')}</span>
            <input
              data-autofocus
              value={name}
              maxLength={180}
              placeholder={t('helpdesk.automation.builder.namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          {selectedNode ? (
            <div className="workflow-builder-node-properties">
              <div className="workflow-builder-properties-section">
                <span>{t('helpdesk.automation.builder.selectedNode')}</span>
                <b>{kindLabels[selectedNode.kind] ?? selectedNode.kind}</b>
                <code>{selectedNode.id}</code>
              </div>

              {selectedNode.catalogKey ? (
                <div className="workflow-builder-properties-section">
                  <span>{t('helpdesk.automation.builder.catalogKey')}</span>
                  <code>{selectedNode.catalogKey}</code>
                </div>
              ) : null}

              <label className="field-block">
                <span>{t('helpdesk.automation.builder.label')}</span>
                <input
                  value={selectedNode.labelKey ? t(selectedNode.labelKey) : selectedNode.label}
                  maxLength={160}
                  onChange={(event) => setNodes((current) => current.map((node) => (
                    node.id === selectedNode.id
                      ? { ...node, label: event.target.value, labelKey: undefined }
                      : node
                  )))}
                />
              </label>

              <label className="field-block">
                <span>{t('helpdesk.automation.builder.stepDescription')}</span>
                <textarea
                  rows={3}
                  value={selectedNode.descriptionKey
                    ? t(selectedNode.descriptionKey)
                    : selectedNode.description ?? ''}
                  onChange={(event) => setNodes((current) => current.map((node) => (
                    node.id === selectedNode.id
                      ? {
                          ...node,
                          description: event.target.value || undefined,
                          descriptionKey: undefined,
                        }
                      : node
                  )))}
                />
              </label>
            </div>
          ) : (
            <INNOState
              compact
              kind="empty"
              title={t('helpdesk.automation.builder.noSelection.title')}
              description={t('helpdesk.automation.builder.noSelection.description')}
            />
          )}

          <div className="workflow-builder-validation">
            <b>{t('helpdesk.automation.builder.validation')}</b>
            <span>
              {t('helpdesk.automation.builder.errors', { count: errorCount })}
              {' · '}
              {t('helpdesk.automation.builder.warnings', { count: warningCount })}
            </span>
            {validation.slice(0, 4).map((issue) => (
              <div
                key={issue.id}
                className={'workflow-builder-validation-item is-' + issue.severity}
              >
                <INNOIcon
                  token={issue.severity === 'error' ? 'status.error' : 'status.warning'}
                  size={13}
                />
                <span>{issue.message}</span>
              </div>
            ))}
            {!validation.length ? (
              <small>{t('helpdesk.automation.builder.noValidationIssues')}</small>
            ) : null}
          </div>
        </aside>
      </section>

      <INNOEditorFooter>
        <INNOEditorFooterStart>
          <Link className="inno-link-button secondary" to="/helpdesk/automation">
            {t('helpdesk.automation.builder.back')}
          </Link>
          <INNOEditorFooterNote>
            {feedback || t('helpdesk.automation.builder.footer')}
          </INNOEditorFooterNote>
        </INNOEditorFooterStart>
        <INNOEditorFooterEnd>
          <INNOButton
            type="button"
            disabled={!validDefinition}
            busy={save.isPending}
            onClick={() => { if (!save.isPending) save.mutate(); }}
          >
            {isNew
              ? t('helpdesk.automation.builder.create')
              : t('helpdesk.automation.builder.save')}
          </INNOButton>
        </INNOEditorFooterEnd>
      </INNOEditorFooter>
    </INNOPage>
  );
}
