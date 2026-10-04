import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElkNode } from 'elkjs';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import { cx } from '@inno/shared';

export type INNOWorkflowNodeKind =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'branch'
  | 'approval'
  | 'assignment'
  | 'wait'
  | 'notification'
  | 'ai'
  | 'subflow'
  | 'end';

export type INNOWorkflowValidationIssue = {
  id: string;
  severity: 'warning' | 'error';
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type INNOWorkflowNode = {
  id: string;
  kind: INNOWorkflowNodeKind;
  label: string;
  labelKey?: string;
  description?: string;
  descriptionKey?: string;
  catalogKey?: string;
  configuration?: Record<string, unknown>;
  disabled?: boolean;
  layout?: { x: number; y: number };
};

export type INNOWorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourcePort?: string;
  targetPort?: string;
};

export type INNOWorkflowDefinition = {
  schemaVersion: 1;
  id: string;
  version: number;
  name: string;
  nodes: INNOWorkflowNode[];
  edges: INNOWorkflowEdge[];
};

export type INNOWorkflowExecutionSnapshot = {
  workflowId: string;
  workflowVersion: number;
  runId: string;
  status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  activeNodeIds: string[];
  completedNodeIds: string[];
  failedNodeId?: string;
};

export type INNOWorkflowCanvasProps = {
  nodes: INNOWorkflowNode[];
  edges: INNOWorkflowEdge[];
  validation?: INNOWorkflowValidationIssue[];
  selectedNodeId?: string | null;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  onConnect?: (edge: Omit<INNOWorkflowEdge, 'id'>) => void;
  onDeleteNodes?: (nodeIds: string[]) => void;
  onDeleteEdges?: (edgeIds: string[]) => void;
  onLayoutChange?: (layout: Record<string, { x: number; y: number }>) => void;
  readOnly?: boolean;
  autoLayout?: boolean;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel: string;
  kindLabels?: Partial<Record<INNOWorkflowNodeKind, string>>;
  severityLabels?: Partial<Record<'warning' | 'error', string>>;
  className?: string;
  height?: number;
};

type WorkflowFlowData = Record<string, unknown> & {
  model: INNOWorkflowNode;
  validation: INNOWorkflowValidationIssue[];
  orientation: 'horizontal' | 'vertical';
  kindLabels: Partial<Record<INNOWorkflowNodeKind, string>>;
  severityLabels: Partial<Record<'warning' | 'error', string>>;
};

type WorkflowFlowNode = Node<WorkflowFlowData, 'innoWorkflowNode'>;
type WorkflowFlowEdge = Edge<Record<string, unknown>>;

const elk = new ELK();
const NODE_WIDTH = 196;
const NODE_HEIGHT = 78;

const NODE_KIND_LABELS: Record<INNOWorkflowNodeKind, string> = {
  trigger: 'Trigger',
  action: 'Action',
  condition: 'Condition',
  branch: 'Branch',
  approval: 'Approval',
  assignment: 'Assignment',
  wait: 'Wait',
  notification: 'Notification',
  ai: 'AI',
  subflow: 'Subflow',
  end: 'End',
};

function WorkflowNodeView({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const { model, validation, orientation, kindLabels } = data;
  const kindLabel = kindLabels[model.kind] ?? NODE_KIND_LABELS[model.kind];
  const hasTarget = model.kind !== 'trigger';
  const hasSource = model.kind !== 'end';
  const targetPosition = orientation === 'horizontal' ? Position.Left : Position.Top;
  const sourcePosition = orientation === 'horizontal' ? Position.Right : Position.Bottom;
  const highestIssue = validation.find((issue) => issue.severity === 'error') ?? validation[0];

  return (
    <div
      className={cx(
        'inno-workflow-node',
        'inno-workflow-node--' + model.kind,
        selected && 'is-selected',
        model.disabled && 'is-disabled',
        highestIssue && 'has-' + highestIssue.severity,
      )}
      data-workflow-node-kind={model.kind}
      aria-label={kindLabel + ': ' + model.label}
    >
      {hasTarget ? <Handle type="target" position={targetPosition} isConnectable={!model.disabled} /> : null}
      <div className="inno-workflow-node-topline">
        <span>{kindLabel}</span>
        {highestIssue ? <b>{data.severityLabels[highestIssue.severity] ?? highestIssue.severity}</b> : null}
      </div>
      <strong>{model.label}</strong>
      {model.description ? <small>{model.description}</small> : null}
      {hasSource ? <Handle type="source" position={sourcePosition} isConnectable={!model.disabled} /> : null}
    </div>
  );
}

const WORKFLOW_NODE_TYPES = { innoWorkflowNode: WorkflowNodeView };

function toFlowEdges(edges: INNOWorkflowEdge[]): WorkflowFlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourcePort,
    targetHandle: edge.targetPort,
    label: edge.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    type: 'smoothstep',
    data: {},
  }));
}

function toFlowNodes(
  nodes: INNOWorkflowNode[],
  validation: INNOWorkflowValidationIssue[],
  orientation: 'horizontal' | 'vertical',
  kindLabels: Partial<Record<INNOWorkflowNodeKind, string>> = {},
  severityLabels: Partial<Record<'warning' | 'error', string>> = {},
): WorkflowFlowNode[] {
  return nodes.map((node, index) => ({
    id: node.id,
    type: 'innoWorkflowNode',
    position: node.layout ?? (
      orientation === 'horizontal'
        ? { x: index * 250, y: 40 }
        : { x: 40, y: index * 130 }
    ),
    data: {
      model: node,
      validation: validation.filter((issue) => issue.nodeId === node.id),
      orientation,
      kindLabels,
      severityLabels,
    },
    draggable: !node.disabled,
    connectable: !node.disabled,
    selectable: true,
    focusable: true,
    ariaLabel: (kindLabels[node.kind] ?? NODE_KIND_LABELS[node.kind]) + ' ' + node.label,
  }));
}

async function layoutNodes(
  nodes: INNOWorkflowNode[],
  edges: INNOWorkflowEdge[],
  validation: INNOWorkflowValidationIssue[],
  orientation: 'horizontal' | 'vertical',
  kindLabels: Partial<Record<INNOWorkflowNodeKind, string>> = {},
  severityLabels: Partial<Record<'warning' | 'error', string>> = {},
): Promise<WorkflowFlowNode[]> {
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': orientation === 'horizontal' ? 'RIGHT' : 'DOWN',
      'elk.spacing.nodeNode': '36',
      'elk.layered.spacing.nodeNodeBetweenLayers': '72',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const result = await elk.layout(graph);
  const positions = new Map(
    (result.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]),
  );

  return toFlowNodes(nodes, validation, orientation, kindLabels, severityLabels).map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}

function INNOWorkflowCanvasInner({
  nodes,
  edges,
  validation = [],
  selectedNodeId = null,
  onSelectedNodeChange,
  onConnect,
  onDeleteNodes,
  onDeleteEdges,
  onLayoutChange,
  readOnly = false,
  autoLayout = true,
  orientation = 'horizontal',
  ariaLabel,
  kindLabels = {},
  severityLabels = {},
  className,
  height = 460,
}: INNOWorkflowCanvasProps) {
  const [flowNodes, setFlowNodes] = useState<WorkflowFlowNode[]>(() => toFlowNodes(nodes, validation, orientation, kindLabels, severityLabels));
  const [flowEdges, setFlowEdges] = useState<WorkflowFlowEdge[]>(() => toFlowEdges(edges));

  const graphSignature = useMemo(
    () => JSON.stringify({
      nodes: nodes.map((node) => [node.id, node.kind, node.disabled]),
      edges: edges.map((edge) => [edge.id, edge.source, edge.target]),
      orientation,
    }),
    [nodes, edges, orientation],
  );

  useEffect(() => {
    let cancelled = false;

    if (!autoLayout) {
      setFlowNodes(toFlowNodes(nodes, validation, orientation, kindLabels, severityLabels));
      return () => { cancelled = true; };
    }

    void layoutNodes(nodes, edges, validation, orientation, kindLabels, severityLabels).then((nextNodes) => {
      if (!cancelled) setFlowNodes(nextNodes);
    });

    return () => { cancelled = true; };
  }, [graphSignature, autoLayout, nodes, edges, validation, orientation, kindLabels, severityLabels]);

  useEffect(() => {
    setFlowEdges(toFlowEdges(edges));
  }, [edges]);

  useEffect(() => {
    setFlowNodes((current) => current.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
      data: {
        ...node.data,
        validation: validation.filter((issue) => issue.nodeId === node.id),
        kindLabels,
        severityLabels,
      },
    })));
  }, [selectedNodeId, validation, kindLabels, severityLabels]);

  const emitLayout = useCallback((nextNodes: WorkflowFlowNode[]) => {
    if (!onLayoutChange) return;
    onLayoutChange(Object.fromEntries(nextNodes.map((node) => [node.id, node.position])));
  }, [onLayoutChange]);

  const handleNodeChanges = useCallback((changes: NodeChange<WorkflowFlowNode>[]) => {
    if (readOnly) return;
    setFlowNodes((current) => {
      const next = applyNodeChanges(changes, current);
      if (changes.some((change) => change.type === 'position' && !change.dragging)) emitLayout(next);
      return next;
    });
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
    if (removed.length) onDeleteNodes?.(removed);
  }, [emitLayout, onDeleteNodes, readOnly]);

  const handleEdgeChanges = useCallback((changes: EdgeChange<WorkflowFlowEdge>[]) => {
    if (readOnly) return;
    setFlowEdges((current) => applyEdgeChanges(changes, current));
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
    if (removed.length) onDeleteEdges?.(removed);
  }, [onDeleteEdges, readOnly]);

  const handleConnect = useCallback((connection: Connection) => {
    if (readOnly || !onConnect || !connection.source || !connection.target) return;
    onConnect({
      source: connection.source,
      target: connection.target,
      sourcePort: connection.sourceHandle ?? undefined,
      targetPort: connection.targetHandle ?? undefined,
    });
  }, [onConnect, readOnly]);

  return (
    <section
      className={cx('inno-workflow-canvas', readOnly && 'is-read-only', className)}
      style={{ height }}
      aria-label={ariaLabel}
      data-inno-workflow-canvas
    >
      <ReactFlow<WorkflowFlowNode, WorkflowFlowEdge>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={WORKFLOW_NODE_TYPES}
        onNodesChange={handleNodeChanges}
        onEdgesChange={handleEdgeChanges}
        onConnect={handleConnect}
        onNodeClick={(_, node) => onSelectedNodeChange?.(node.id)}
        onPaneClick={() => onSelectedNodeChange?.(null)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly && Boolean(onConnect)}
        edgesReconnectable={false}
        elementsSelectable
        nodesFocusable
        edgesFocusable
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1 }}
        minZoom={0.35}
        maxZoom={1.6}
        panOnScroll
        selectionOnDrag={!readOnly}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={!readOnly} />
      </ReactFlow>
    </section>
  );
}

export function INNOWorkflowCanvas(props: INNOWorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <INNOWorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
