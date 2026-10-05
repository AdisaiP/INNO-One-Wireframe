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
import { useI18n as useStep45NI18n } from '@inno/i18n';

function evaluationTone(value: string) {
  if (value === 'current') return 'success' as const;
  if (value === 'stale') return 'warning' as const;
  return 'neutral' as const;
}

export function SoftwareBaselineDetailPage() {
  const { t: t45n } = useStep45NI18n();
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
    return <div className="page-loading-wrap"><LoadingState label={t45n('devices.step45n.softwareBaselineDetail.loadingSoftwareBaseline')} /></div>;
  }
  if (baseline.isError) {
    return <div className="page-error-wrap"><ErrorState error={baseline.error} retry={() => void baseline.refetch()} /></div>;
  }

  const item = baseline.data;

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb">
        <Link to="/assets/software-baselines">{t45n('navigation.softwareBaselines')}</Link><span>›</span><span>{item.name}</span>
      </div>

      <INNOResourceHeader
        title={item.name}
        status={<INNOStatus tone={item.status === 'active' ? 'success' : 'neutral'}>{item.status}</INNOStatus>}
        meta={<><span>{item.code}</span><span>·</span><span>{item.targetCategory || t45n('devices.step45n.softwareBaselineDetail.allAssetCategories')}</span></>}
        actions={canManage ? (
          <Link className="inno-link-button secondary" to={'/assets/software-baselines/' + item.id + '/edit'}>
            {t45n('devices.step45n.softwareBaselineDetail.editBaseline')}</Link>
        ) : undefined}
      />

      <INNOResourceSummary>
        <INNOResourceSummaryItem label={t45n('devices.step45n.softwareBaselineDetail.requiredSoftware')} value={item.requiredPackages.length} detail="Package names in policy" />
        <INNOResourceSummaryItem label={t45n('devices.step45n.softwareBaselineDetail.targetCategory')} value={item.targetCategory || 'All'} detail="Asset scope" />
        <INNOResourceSummaryItem label={t45n('devices.step45n.softwareBaselineDetail.evaluation')} value={item.evaluationStatus.replaceAll('_', ' ')} detail="Evidence status" />
        <INNOResourceSummaryItem label={t45n('reports.table.updated')} value={new Date(item.updatedAt).toLocaleDateString()} detail={new Date(item.updatedAt).toLocaleTimeString()} />
      </INNOResourceSummary>

      <INNOCollection className="baseline-definition-card">
        <INNOCollectionHeader
          title={t45n('devices.step45n.softwareBaselineDetail.baselineDefinition')}
          description={t45n('devices.step45n.softwareBaselineDetail.requiredSoftwarePolicyForThisAssetScope')}
          meta={<INNOStatus tone={evaluationTone(item.evaluationStatus)}>{item.evaluationStatus.replaceAll('_', ' ')}</INNOStatus>}
        />
        <div className="production-kv-grid baseline-definition-grid">
          <div className="kv-row"><span>{t45n('admin.step45n.adminHierarchy.code')}</span><b>{item.code}</b></div>
          <div className="kv-row"><span>{t45n('reports.runs.status')}</span><b>{item.status}</b></div>
          <div className="kv-row"><span>{t45n('devices.step45n.softwareBaselineDetail.targetCategory')}</span><b>{item.targetCategory || t45n('devices.step45n.softwareBaselineDetail.allAssetCategories')}</b></div>
          <div className="kv-row"><span>{t45n('devices.step45n.softwareBaselineDetail.requiredPackages')}</span><b>{item.requiredPackages.join(', ')}</b></div>
        </div>
      </INNOCollection>

      <INNOCollection>
        <INNOCollectionHeader
          title={t45n('devices.step45n.softwareBaselineDetail.evaluationResults')}
          description={t45n('devices.step45n.softwareBaselineDetail.latestEvidenceBackedComplianceForAssetsInThis')}
          meta={canManage && item.status === 'active' ? (
            <INNOButton busy={evaluate.isPending} onClick={() => evaluate.mutate()}>{t45n('devices.step45n.softwareBaselineDetail.evaluateNow')}</INNOButton>
          ) : undefined}
        />
        {evaluate.isError ? <div className="collection-state"><ErrorState error={evaluate.error} /></div> : null}
        {results.isPending ? (
          <CollectionLoadingState label={t45n('devices.step45n.softwareBaselineDetail.loadingBaselineResults')} />
        ) : results.isError ? (
          <CollectionErrorState error={results.error} retry={() => void results.refetch()} />
        ) : (
          <>
            <div className="baseline-result-summary">
              <div><span>{t45n('assets.automation.editor.compliance.compliant')}</span><b>{results.data.compliantCount}</b></div>
              <div><span>{t45n('devices.step45n.softwareBaselineDetail.missing')}</span><b>{results.data.missingCount}</b></div>
              <div><span>{t45n('devices.step45n.softwareBaselineDetail.unknown')}</span><b>{results.data.unknownCount}</b></div>
            </div>
            {results.data.items.length ? (
              <INNOTableWrap width="xwide">
                <table>
                  <thead><tr><th>{t45n('reports.column.name')}</th><th>{t45n('reports.column.category')}</th><th>{t45n('devices.step45n.softwareBaselineDetail.result')}</th><th>{t45n('devices.step45n.deviceDetail.evidence')}</th><th>{t45n('devices.step45n.softwareBaselineDetail.missingSoftware')}</th></tr></thead>
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
                title={t45n('devices.step45n.softwareBaselineDetail.noEvaluationResultsYet')}
                description={t45n('devices.step45n.softwareBaselineDetail.activateTheBaselineAndRunEvaluationWhenEvidence')}
              />
            )}
          </>
        )}
      </INNOCollection>
    </main>
  );
}
