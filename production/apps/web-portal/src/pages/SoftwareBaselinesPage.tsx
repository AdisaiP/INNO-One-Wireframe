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
  INNOSelectField,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import { getSoftwareBaselines } from '../api/client';
import { CollectionErrorState, CollectionLoadingState } from '../components/Feedback';
import { RouterRowAction } from '../components/RouterRowAction';
import { usePermission } from '../app/ProfileContext';

export function SoftwareBaselinesPage() {
  const canManage = usePermission('assets.baseline.manage');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('all');

  const query = useQuery({
    queryKey: ['assets', 'software-baselines', deferredSearch, status],
    queryFn: () => getSoftwareBaselines({ search: deferredSearch, status }),
  });

  const items = query.data?.items ?? [];

  return (
    <INNOPage
      eyebrow="Assets · Management"
      title="Software Baselines"
      description="Define required software and review evidence-backed compliance for linked Assets."
      actions={canManage ? (
        <Link className="inno-link-button" to="/assets/software-baselines/new">New Baseline</Link>
      ) : undefined}
    >
      <div className="baseline-info" role="status">
        Evaluation uses Devices observations from the last 24 hours. Missing, stale or partial inventory remains Unknown.
      </div>

      <INNOCollection>
        <INNOCollectionHeader
          title="Baseline definitions"
          description={query.data ? query.data.totalItems + ' matching definitions' : 'Required software policies'}
          meta={query.data ? <INNOStatus>{query.data.totalItems} baselines</INNOStatus> : undefined}
        />
        <INNOCollectionToolbar>
          <INNOSearchField label="Search baselines" value={search} onChange={setSearch} placeholder="Search code or name" />
          <INNOSelectField label="Status filter" value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </INNOSelectField>
        </INNOCollectionToolbar>

        {query.isPending ? (
          <CollectionLoadingState label="Loading software baselines…" />
        ) : query.isError ? (
          <CollectionErrorState error={query.error} retry={() => void query.refetch()} />
        ) : items.length ? (
          <INNOTableWrap width="wide">
            <table>
              <thead>
                <tr>
                  <th>Baseline</th>
                  <th>Target category</th>
                  <th>Required software</th>
                  <th>Status</th>
                  <th>Evaluation</th>
                  <th>Updated</th>
                  <th className="action-column">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><b>{item.name}</b><div className="table-meta">{item.code}</div></td>
                    <td>{item.targetCategory || 'All Asset categories'}</td>
                    <td>{item.requiredPackages.length}</td>
                    <td><INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus></td>
                    <td><INNOStatus tone={item.evaluationStatus === 'current' ? 'success' : item.evaluationStatus === 'stale' ? 'warning' : 'neutral'}>{item.evaluationStatus.replaceAll('_', ' ')}</INNOStatus></td>
                    <td>{new Date(item.updatedAt).toLocaleString()}</td>
                    <td className="action-column">
                      <RouterRowAction
                        to={'/assets/software-baselines/' + item.id}
                        ariaLabel={'Open ' + item.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        ) : (
          <INNOCollectionState
            kind={search || status !== 'all' ? 'no-results' : 'empty'}
            title={search || status !== 'all' ? 'No matching baselines' : 'No software baselines yet'}
            description={search || status !== 'all'
              ? 'Try another search or clear the filters.'
              : 'Create the first baseline when required software policy is ready.'}
            action={search || status !== 'all'
              ? <INNOButton variant="secondary" onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</INNOButton>
              : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
