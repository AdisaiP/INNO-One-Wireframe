import { useEffect, useMemo, useState } from 'react';
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
import { useWorkflowDrafts } from '../app/WorkflowDraftContext';
import './WorkflowProductPages.css';

const palette: Array<{ kind: INNOWorkflowNodeKind; label: string }> = [
  { kind: 'trigger', label: 'Trigger' },
  { kind: 'action', label: 'Action' },
  { kind: 'condition', label: 'Condition' },
  { kind: 'branch', label: 'Branch' },
  { kind: 'approval', label: 'Approval' },
  { kind: 'assignment', label: 'Assignment' },
  { kind: 'wait', label: 'Wait' },
  { kind: 'notification', label: 'Notification' },
  { kind: 'ai', label: 'AI' },
  { kind: 'subflow', label: 'Subflow' },
  { kind: 'end', label: 'End' },
];

function starterNodes(): INNOWorkflowNode[] {
  return [
    {
      id: 'trigger',
      kind: 'trigger',
      label: 'Workflow starts',
      description: 'Choose the business event in Step 45C.',
    },
    {
      id: 'action',
      kind: 'action',
      label: 'Choose an action',
      description: 'Configure a module action later.',
    },
    {
      id: 'end',
      kind: 'end',
      label: 'Workflow complete',
    },
  ];
}

function starterEdges(): INNOWorkflowEdge[] {
  return [
    { id: 'edge_trigger_action', source: 'trigger', target: 'action' },
    { id: 'edge_action_end', source: 'action', target: 'end' },
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

function nodeLabel(kind: INNOWorkflowNodeKind) {
  const item = palette.find((candidate) => candidate.kind === kind);
  return item?.label ?? kind;
}

function buildValidation(nodes: INNOWorkflowNode[], edges: INNOWorkflowEdge[]): INNOWorkflowValidationIssue[] {
  const issues: INNOWorkflowValidationIssue[] = [];
  const triggers = nodes.filter((node) => node.kind === 'trigger');
  const ends = nodes.filter((node) => node.kind === 'end');

  if (triggers.length !== 1) {
    triggers.forEach((node, index) => issues.push({
      id: 'trigger-count-' + index,
      severity: 'error',
      nodeId: node.id,
      message: 'A workflow definition must contain exactly one trigger.',
    }));
  }
  if (!ends.length) {
    issues.push({
      id: 'missing-end',
      severity: 'error',
      message: 'Add at least one End node.',
    });
  }

  for (const node of nodes) {
    if (node.kind !== 'trigger' && !edges.some((edge) => edge.target === node.id)) {
      issues.push({
        id: 'missing-incoming-' + node.id,
        severity: 'warning',
        nodeId: node.id,
        message: 'Connect an incoming path to this node.',
      });
    }
    if (node.kind !== 'end' && !edges.some((edge) => edge.source === node.id)) {
      issues.push({
        id: 'missing-outgoing-' + node.id,
        severity: 'warning',
        nodeId: node.id,
        message: 'Connect an outgoing path from this node.',
      });
    }
  }

  return issues;
}

export function WorkflowBuilderPage() {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const { createDraft, getDraft, updateDraft } = useWorkflowDrafts();
  const existing = workflowId ? getDraft(workflowId) : null;
  const isNew = !workflowId;

  const [name, setName] = useState(existing?.name ?? '');
  const [nodes, setNodes] = useState<INNOWorkflowNode[]>(() => existing?.nodes ?? starterNodes());
  const [edges, setEdges] = useState<INNOWorkflowEdge[]>(() => existing?.edges ?? starterEdges());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id ?? null);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (isNew || !existing) return;
    setName(existing.name);
    setNodes(existing.nodes);
    setEdges(existing.edges);
    setSelectedNodeId(existing.nodes[0]?.id ?? null);
  }, [existing?.id, isNew]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const validation = useMemo(() => buildValidation(nodes, edges), [nodes, edges]);
  const errorCount = validation.filter((issue) => issue.severity === 'error').length;
  const warningCount = validation.filter((issue) => issue.severity === 'warning').length;
  const validSessionDraft = Boolean(name.trim()) && nodes.filter((node) => node.kind === 'trigger').length === 1 && nodes.some((node) => node.kind === 'end');

  if (!isNew && !existing) {
    return (
      <INNOPage
        eyebrow="Automation · Dynamic Workflows"
        title="Workflow draft unavailable"
        description="Step 45B keeps workflow drafts in memory for the current browser session only."
        actions={<Link className="inno-link-button" to="/workflows/new">New Workflow</Link>}
      >
        <INNOState
          kind="empty"
          title="Session draft not found"
          description="The draft may have been cleared by a page refresh. Return to the workflow list or start a new session draft."
          action={<Link className="inno-link-button secondary" to="/workflows">Back to Workflows</Link>}
        />
      </INNOPage>
    );
  }

  const addNode = (kind: INNOWorkflowNodeKind) => {
    const id = nextNodeId(kind, nodes);
    const next: INNOWorkflowNode = {
      id,
      kind,
      label: nodeLabel(kind),
      description: kind === 'trigger' ? 'Choose a business event.' : undefined,
    };
    setNodes((current) => [...current, next]);
    setSelectedNodeId(id);
    setFeedback(nodeLabel(kind) + ' node added');
  };

  const keepSessionDraft = () => {
    if (!validSessionDraft) return;
    const payload = { name: name.trim(), nodes, edges };
    if (isNew) {
      const draft = createDraft(payload);
      setFeedback('Session draft created');
      navigate('/workflows/' + draft.id, { replace: true });
      return;
    }
    if (workflowId) {
      updateDraft(workflowId, payload);
      setFeedback('Session draft updated');
    }
  };

  return (
    <INNOPage
      eyebrow="Automation · Dynamic Workflows"
      title={isNew ? 'New Workflow' : name || 'Workflow Builder'}
      description="Build a branching workflow definition using the shared React Flow + ELK canvas."
      actions={
        <div className="workflow-builder-header-status">
          <INNOStatus tone="neutral">Session only</INNOStatus>
          <INNOStatus tone={errorCount ? 'danger' : warningCount ? 'warning' : 'success'}>
            {errorCount ? errorCount + ' errors' : warningCount ? warningCount + ' warnings' : 'Definition valid'}
          </INNOStatus>
        </div>
      }
    >
      <div className="workflow-product-boundary" role="status">
        <b>No server persistence or execution in Step 45B</b>
        <span>Keep in session stores this draft only in React memory. Refreshing the app clears it. Publishing, versions and run history are intentionally absent.</span>
      </div>

      <section className="workflow-builder-shell" aria-label="Dynamic workflow builder">
        <aside className="workflow-builder-palette" aria-label="Workflow node palette">
          <div className="workflow-builder-pane-head">
            <div><b>Node Palette</b><span>Add a workflow step</span></div>
          </div>
          <div className="workflow-builder-palette-items">
            {palette.map((item) => (
              <button key={item.kind} type="button" onClick={() => addNode(item.kind)}>
                <INNOIcon token="action.add" size={13} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="workflow-builder-canvas-pane">
          <div className="workflow-builder-pane-head">
            <div>
              <b>Workflow Canvas</b>
              <span>Drag, connect, select, pan and zoom</span>
            </div>
            <div className="workflow-builder-canvas-actions">
              <INNOButton
                type="button"
                variant={orientation === 'horizontal' ? 'secondary' : 'ghost'}
                onClick={() => setOrientation('horizontal')}
              >
                Horizontal
              </INNOButton>
              <INNOButton
                type="button"
                variant={orientation === 'vertical' ? 'secondary' : 'ghost'}
                onClick={() => setOrientation('vertical')}
              >
                Vertical
              </INNOButton>
              <INNOStatus>{nodes.length} nodes</INNOStatus>
            </div>
          </div>
          <INNOWorkflowCanvas
            ariaLabel="Dynamic workflow product builder"
            nodes={nodes}
            edges={edges}
            validation={validation}
            selectedNodeId={selectedNodeId}
            onSelectedNodeChange={setSelectedNodeId}
            onConnect={(edge) => {
              if (edges.some((current) => current.source === edge.source && current.target === edge.target)) return;
              setEdges((current) => [...current, {
                ...edge,
                id: 'edge_' + edge.source + '_' + edge.target + '_' + (current.length + 1),
              }]);
              setFeedback('Connection added');
            }}
            onDeleteNodes={(ids) => {
              setNodes((current) => current.filter((node) => !ids.includes(node.id)));
              setEdges((current) => current.filter((edge) => !ids.includes(edge.source) && !ids.includes(edge.target)));
              if (selectedNodeId && ids.includes(selectedNodeId)) setSelectedNodeId(null);
              setFeedback(ids.length === 1 ? 'Node removed' : ids.length + ' nodes removed');
            }}
            onDeleteEdges={(ids) => {
              setEdges((current) => current.filter((edge) => !ids.includes(edge.id)));
              setFeedback(ids.length === 1 ? 'Connection removed' : ids.length + ' connections removed');
            }}
            onLayoutChange={(layout) => {
              setNodes((current) => current.map((node) => (
                layout[node.id] ? { ...node, layout: layout[node.id] } : node
              )));
            }}
            orientation={orientation}
            height={500}
          />
        </div>

        <aside className="workflow-builder-properties" aria-label="Workflow properties">
          <div className="workflow-builder-pane-head">
            <div><b>Properties</b><span>Definition and selected node</span></div>
          </div>

          <label className="field-block">
            <span>Workflow name</span>
            <input
              data-autofocus
              value={name}
              maxLength={180}
              placeholder="e.g. Critical incident approval"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          {selectedNode ? (
            <div className="workflow-builder-node-properties">
              <div className="workflow-builder-properties-section">
                <span>Selected node</span>
                <b>{nodeLabel(selectedNode.kind)}</b>
                <code>{selectedNode.id}</code>
              </div>
              <label className="field-block">
                <span>Label</span>
                <input
                  value={selectedNode.label}
                  maxLength={160}
                  onChange={(event) => setNodes((current) => current.map((node) => (
                    node.id === selectedNode.id ? { ...node, label: event.target.value } : node
                  )))}
                />
              </label>
              <label className="field-block">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={selectedNode.description ?? ''}
                  onChange={(event) => setNodes((current) => current.map((node) => (
                    node.id === selectedNode.id ? { ...node, description: event.target.value || undefined } : node
                  )))}
                />
              </label>
            </div>
          ) : (
            <INNOState compact kind="empty" title="No node selected" description="Select a node on the canvas to edit its label and description." />
          )}

          <div className="workflow-builder-validation">
            <b>Definition checks</b>
            <span>{errorCount} errors · {warningCount} warnings</span>
            {validation.slice(0, 4).map((issue) => (
              <div key={issue.id} className={'workflow-builder-validation-item is-' + issue.severity}>
                <INNOIcon token={issue.severity === 'error' ? 'status.error' : 'status.warning'} size={13} />
                <span>{issue.message}</span>
              </div>
            ))}
            {!validation.length ? <small>No structural issues detected.</small> : null}
          </div>
        </aside>
      </section>

      <INNOEditorFooter>
        <INNOEditorFooterStart>
          <Link className="inno-link-button secondary" to="/workflows">Back to Workflows</Link>
          <INNOEditorFooterNote>
            {feedback || 'Session drafts are temporary. Step 45C adds persisted definitions and optimistic concurrency.'}
          </INNOEditorFooterNote>
        </INNOEditorFooterStart>
        <INNOEditorFooterEnd>
          <INNOButton
            type="button"
            disabled={!validSessionDraft}
            onClick={keepSessionDraft}
          >
            {isNew ? 'Keep in Session' : 'Update Session Draft'}
          </INNOButton>
        </INNOEditorFooterEnd>
      </INNOEditorFooter>
    </INNOPage>
  );
}
