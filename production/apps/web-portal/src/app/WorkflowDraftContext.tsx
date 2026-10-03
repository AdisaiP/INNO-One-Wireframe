import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { INNOWorkflowEdge, INNOWorkflowNode } from '@inno/ui/workflow';

export type SessionWorkflowDraft = {
  id: string;
  name: string;
  nodes: INNOWorkflowNode[];
  edges: INNOWorkflowEdge[];
  updatedAt: string;
};

type WorkflowDraftContextValue = {
  drafts: SessionWorkflowDraft[];
  createDraft: (draft: Omit<SessionWorkflowDraft, 'id' | 'updatedAt'>) => SessionWorkflowDraft;
  updateDraft: (id: string, draft: Omit<SessionWorkflowDraft, 'id' | 'updatedAt'>) => SessionWorkflowDraft | null;
  removeDraft: (id: string) => void;
  getDraft: (id: string) => SessionWorkflowDraft | null;
};

const WorkflowDraftContext = createContext<WorkflowDraftContextValue | null>(null);

function newDraftId() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return 'session_' + random;
}

export function WorkflowDraftProvider({ children }: PropsWithChildren) {
  const [drafts, setDrafts] = useState<SessionWorkflowDraft[]>([]);

  const value = useMemo<WorkflowDraftContextValue>(() => ({
    drafts,
    createDraft: (draft) => {
      const next: SessionWorkflowDraft = {
        ...draft,
        id: newDraftId(),
        updatedAt: new Date().toISOString(),
      };
      setDrafts((current) => [next, ...current]);
      return next;
    },
    updateDraft: (id, draft) => {
      let updated: SessionWorkflowDraft | null = null;
      setDrafts((current) => current.map((item) => {
        if (item.id !== id) return item;
        updated = {
          ...draft,
          id,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }));
      return updated;
    },
    removeDraft: (id) => {
      setDrafts((current) => current.filter((item) => item.id !== id));
    },
    getDraft: (id) => drafts.find((item) => item.id === id) ?? null,
  }), [drafts]);

  return <WorkflowDraftContext.Provider value={value}>{children}</WorkflowDraftContext.Provider>;
}

export function useWorkflowDrafts(): WorkflowDraftContextValue {
  const value = useContext(WorkflowDraftContext);
  if (!value) throw new Error('WorkflowDraftProvider is missing');
  return value;
}
