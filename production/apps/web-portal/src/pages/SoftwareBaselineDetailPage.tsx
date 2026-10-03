import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOResourceHeader,
  INNOResourceSummary,
  INNOResourceSummaryItem,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  evaluateSoftwareBaseline,
  getSoftwareBaseline,
  getSoftwareBaselineResults,
} from '../api/client';
import { CollectionErrorState, CollectionLoadingState, ErrorState, LoadingState } from '../components/Feedback';
import { usePermission } from '../app/ProfileContext';

function evaluationTone(value: string) {
  if (value === 'current') return 'success' as const;
  if (value === 'stale') return 'warning' as const;
  return 'neutral' as const;
}

export function SoftwareBaselineDetailPage() {
  const { baselineId = '' } = useParams();
  const canManage = usePermission('assets.baseline.manage');
  const queryClient = useQueryClient();

  const baseline = useQuery({
    queryKey: ['assets', 'software-baseline', baselineId],
    queryFn: () => getSoftwareBaseline(baselineId),
    enabled: Boolean(baselineId),
  });

  const results = useQuery({
    queryKey: ['assets', 'software-baselines', baselineId, 'results'],
    queryFn: () => getSoftwareBaselineResults(baselineId),
    enabled: Boolean(baselineId),
  });

  const evaluate = useMutation({
    mutationFn: () => evaluateSoftwareBaseline(baselineId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assets', 'software-baseline', baselineId] }),
        queryClient.invalidateQueries({ queryKey: ['assets', 'software-baselines'] }),
        queryClient.invalidateQueries({ queryKey: ['assets', 'software-baselines', baselineId, 'results'] }),
      ]);
    },
  });

  if (baseline.isPending) {
    return <div className="page-loading-wrap"><LoadingState label="Loading software baseline…" /></div>;
  }
  if (baseline.isError) {
    return <div className="page-error-wrap"><ErrorState error={baseline.error} retry={() => void baseline.refetch()} /></div>;
  }

  const item = baseline.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/software-baselines">Software Baselines</Link><span>›</span><span>{item.name}</span>
      </div>

      <INNOResourceHeader
        title={item.name}
        status={<INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus>}
        meta={<><span>{item.code}</span><span>·</span><span>{item.targetCategory || 'All Asset categories'}</span></>}
        actions={canManage ? (
          <Link className="inno-link-button secondary" to={'/assets/software-baselines/' + item.id + '/edit'}>
            Edit Baseline
          </Link>
        ) : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Required software" value={item.requiredPackages.length} detail="Package names in policy" />
        <INNOResourceSummaryItem label="Target category" value={item.targetCategory || 'All'} detail="Asset scope" />
        <INNOResourceSummaryItem label="Evaluation" value={item.evaluationStatus.replaceAll('_', ' ')} detail="Evidence status" />
        <INNOResourceSummaryItem label="Updated" value={new Date(item.updatedAt).toLocaleDateString()} detail={new Date(item.updatedAt).toLocaleTimeString()} />
      </INNOResourceSummary>

      <INNOCollection className="baseline-definition-card">
        <INNOCollectionHeader
          title="Baseline definition"
          description="Required software policy for this Asset scope."
          meta={<INNOStatus tone={evaluationTone(item.evaluationStatus)}>{item.evaluationStatus.replaceAll('_', ' ')}</INNOStatus>}
        />
        <div className="production-kv-grid baseline-definition-grid">
          <div className="kv-row"><span>Code</span><b>{item.code}</b></div>
          <div className="kv-row"><span>Status</span><b>{item.status}</b></div>
          <div className="kv-row"><span>Target category</span><b>{item.targetCategory || 'All Asset categories'}</b></div>
          <div className="kv-row"><span>Required packages</span><b>{item.requiredPackages.join(', ')}</b></div>
        </div>
      </INNOCollection>

      <INNOCollection>
        <INNOCollectionHeader
          title="Evaluation results"
          description="Latest evidence-backed compliance for Assets in this baseline scope."
          meta={canManage && item.status === 'active' ? (
            <INNOButton busy={evaluate.isPending} onClick={() => evaluate.mutate()}>Evaluate Now</INNOButton>
          ) : undefined}
        />
        {evaluate.isError ? <div className="collection-state"><ErrorState error={evaluate.error} /></div> : null}
        {results.isPending ? (
          <CollectionLoadingState label="Loading baseline results…" />
        ) : results.isError ? (
          <CollectionErrorState error={results.error} retry={() => void results.refetch()} />
        ) : (
          <>
            <div className="baseline-result-summary">
              <div><span>Compliant</span><b>{results.data.compliantCount}</b></div>
              <div><span>Missing</span><b>{results.data.missingCount}</b></div>
              <div><span>Unknown</span><b>{results.data.unknownCount}</b></div>
            </div>
            {results.data.items.length ? (
              <INNOTableWrap width="xwide">
                <table>
                  <thead><tr><th>Asset</th><th>Category</th><th>Result</th><th>Evidence</th><th>Missing software</th></tr></thead>
                  <tbody>
                    {results.data.items.map((result) => (
                      <tr key={result.id}>
                        <td><b>{result.assetTag}</b><div className="table-meta">{result.assetName}</div></td>
                        <td>{result.category}</td>
                        <td><INNOStatus tone={result.status === 'compliant' ? 'success' : result.status === 'missing' ? 'danger' : 'warning'}>{result.status}</INNOStatus></td>
                        <td>{result.reasonCode.replaceAll('_', ' ')}</td>
                        <td>{result.missingPackages.length ? result.missingPackages.join(', ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </INNOTableWrap>
            ) : (
              <INNOCollectionState
                kind="empty"
                title="No evaluation results yet"
                description="Activate the baseline and run evaluation when evidence is available."
              />
            )}
          </>
        )}
      </INNOCollection>
    </main>
  );
}
