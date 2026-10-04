import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOCollectionToolbar,
  INNOPage,
  INNOSearchField,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getWorkflowDefinitions } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { usePermission } from '../app/ProfileContext';
import './WorkflowProductPages.css';

export function WorkflowListPage() {
  const canManage = usePermission('workflows.manage');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ['workflows', deferredSearch],
    queryFn: () => getWorkflowDefinitions({ search: deferredSearch }),
  });

  const items = query.data?.items ?? [];

  return (
    <INNOPage
      eyebrow="Automation"
      title="Dynamic Workflows"
      description="Design and persist branching automation definitions across INNO.One modules. Execution remains a separate runtime concern."
      actions={canManage ? <Link className="inno-link-button" to="/workflows/new">New Workflow</Link> : undefined}
    >
      <div className="workflow-product-boundary" role="status">
        <b>Persisted definitions</b>
        <span>Step 45C stores workflow definitions and immutable versions on the server with optimistic concurrency. Run history and execution are still reserved for Step 45D.</span>
      </div>

      <INNOCollection className="workflow-list-collection">
        <INNOCollectionHeader
          title="Workflow definitions"
          description={query.data ? query.data.totalItems + ' matching definitions' : 'Persisted branching workflow definitions'}
          meta={query.data ? <INNOStatus tone="neutral">{query.data.totalItems} workflows</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField
            label="Search workflows"
            value={search}
            onChange={setSearch}
            placeholder="Search workflow name"
          />
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label="Loading workflow definitions…" />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : items.length ? (
          <INNOTableWrap>
            <table>
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th className="numeric-column">Version</th>
                  <th className="numeric-column">Nodes</th>
                  <th className="numeric-column">Connections</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="action-column">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.name}</b><div className="table-meta">{item.id}</div></td>
                    <td className="numeric-column">v{item.version}</td>
                    <td className="numeric-column">{item.nodeCount}</td>
                    <td className="numeric-column">{item.edgeCount}</td>
                    <td><INNOStatus tone="neutral">{item.status}</INNOStatus></td>
                    <td>{new Date(item.updatedAt).toLocaleString()}</td>
                    <td className="action-column">
                      <RouterRowAction to={'/workflows/' + item.id} ariaLabel={'Open ' + item.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <INNOCollectionState
            kind={search ? 'no-results' : 'empty'}
            title={search ? 'No matching workflows' : 'No workflow definitions yet'}
            description={search
              ? 'Try another workflow name.'
              : 'Create the first persisted branching workflow definition.'}
            action={search
              ? <INNOButton variant="secondary" onClick={() => setSearch('')}>Clear search</INNOButton>
              : canManage ? <Link className="inno-link-button" to="/workflows/new">New Workflow</Link> : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
