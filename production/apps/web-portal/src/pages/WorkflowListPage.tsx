import { Link } from 'react-router-dom';
import {
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOPage,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { RouterRowAction } from '../components/RouterRowAction';
import { useWorkflowDrafts } from '../app/WorkflowDraftContext';
import './WorkflowProductPages.css';

export function WorkflowListPage() {
  const { drafts } = useWorkflowDrafts();

  return (
    <INNOPage
      eyebrow="Automation"
      title="Dynamic Workflows"
      description="Design branching automation across INNO.One modules without changing the simple Helpdesk Automation rule editor."
      actions={<Link className="inno-link-button" to="/workflows/new">New Workflow</Link>}
    >
      <div className="workflow-product-boundary" role="status">
        <b>UI foundation preview</b>
        <span>Step 45B keeps drafts in this browser session only. Persistence, publishing and execution begin in later workflow steps.</span>
      </div>

      <INNOCollection className="workflow-list-collection">
        <INNOCollectionHeader
          title="Workflow definitions"
          description="Session drafts created while validating the Product IA and builder interaction."
          meta={<INNOStatus tone="neutral">{drafts.length} session drafts</INNOStatus>}
        />

        {drafts.length ? (
          <INNOTableWrap>
            <table>
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th className="numeric-column">Nodes</th>
                  <th className="numeric-column">Connections</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="action-column">Action</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td>
                      <b>{draft.name}</b>
                      <div className="table-meta">{draft.id}</div>
                    </td>
                    <td className="numeric-column">{draft.nodes.length}</td>
                    <td className="numeric-column">{draft.edges.length}</td>
                    <td><INNOStatus tone="neutral">Session draft</INNOStatus></td>
                    <td>{new Date(draft.updatedAt).toLocaleString()}</td>
                    <td className="action-column">
                      <RouterRowAction
                        to={'/workflows/' + draft.id}
                        ariaLabel={'Open ' + draft.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <INNOCollectionState
            kind="empty"
            title="No session workflow drafts"
            description="Create a workflow to validate the branching builder. Nothing is persisted to the server in Step 45B."
            action={<Link className="inno-link-button" to="/workflows/new">New Workflow</Link>}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
