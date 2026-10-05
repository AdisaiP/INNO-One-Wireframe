import { useState } from 'react';
import { useI18n } from '@inno/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOPage,
  INNOPagination,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  downloadReportRun,
  getReport,
  getReportRuns,
  startReportRun,
} from '../api/client';
import { usePermission } from '../app/ProfileContext';
import {
  CollectionErrorState,
  CollectionLoadingState,
  ErrorState,
  LoadingState,
} from '../components/Feedback';
import './WorkflowProductPages.css';

function statusTone(status: string): 'neutral' | 'success' | 'danger' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export function ReportRunsPage() {
  const { t, formatDateTime } = useI18n();
  const { reportId = '' } = useParams();
  const queryClient = useQueryClient();
  const canGenerate = usePermission('reports.create');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState('');

  const report = useQuery({
    queryKey: ['reports', 'definition', reportId],
    queryFn: () => getReport(reportId),
    enabled: Boolean(reportId),
  });

  const runs = useQuery({
    queryKey: ['reports', 'runs', reportId, page],
    queryFn: () => getReportRuns(reportId, { page, pageSize: 25 }),
    enabled: Boolean(reportId),
  });

  const generate = useMutation({
    mutationFn: () => startReportRun(reportId),
    onSuccess: async (result) => {
      setFeedback(result.status === 'completed'
        ? t('reports.toast.generated')
        : result.errorDetail || result.errorCode || t('reports.run.failed'));
      await queryClient.invalidateQueries({ queryKey: ['reports', 'runs', reportId] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const download = useMutation({
    mutationFn: (input: { runId: string; fileName?: string | null }) =>
      downloadReportRun(reportId, input.runId, input.fileName ?? 'report.csv'),
    onError: (error: Error) => setFeedback(error.message),
  });

  if (report.isPending) {
    return <div className="page-loading-wrap"><LoadingState /></div>;
  }
  if (report.isError) {
    return <div className="page-error-wrap"><ErrorState error={report.error} retry={() => void report.refetch()} /></div>;
  }

  return (
    <INNOPage
      eyebrow={t('reports.runs.eyebrow')}
      title={t('reports.runs.title')}
      description={report.data.name + ' · ' + t('reports.runs.description')}
      actions={(
        <div className="page-header-actions">
          <Link className="inno-link-button secondary" to="/reports">
            {t('reports.runs.back')}
          </Link>
          {canGenerate ? (
            <INNOButton busy={generate.isPending} onClick={() => generate.mutate()}>
              {t('reports.action.generate')}
            </INNOButton>
          ) : null}
        </div>
      )}
    >
      {feedback ? <div className="workflow-product-boundary" role="status">{feedback}</div> : null}

      <INNOCollection>
        <INNOCollectionHeader
          title={t('reports.runs.title')}
          description={t('reports.runs.description')}
          meta={runs.data ? <INNOStatus>{runs.data.totalItems}</INNOStatus> : undefined}
        />

        {runs.isPending ? (
          <CollectionLoadingState />
        ) : runs.isError ? (
          <CollectionErrorState error={runs.error} retry={() => void runs.refetch()} />
        ) : runs.data.items.length ? (
          <>
            <INNOTableWrap stickyAction>
              <table>
                <thead>
                  <tr>
                    <th>{t('reports.runs.created')}</th>
                    <th>{t('reports.runs.version')}</th>
                    <th>{t('reports.runs.trigger')}</th>
                    <th>{t('reports.runs.status')}</th>
                    <th className="numeric-column">{t('reports.runs.rows')}</th>
                    <th className="action-column">{t('reports.runs.output')}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.items.map((run) => (
                    <tr key={run.id}>
                      <td>{formatDateTime(run.createdAt)}</td>
                      <td>v{run.reportVersion}</td>
                      <td>{t('reports.trigger.' + run.trigger)}</td>
                      <td>
                        <INNOStatus tone={statusTone(run.status)}>
                          {t('reports.run.' + run.status)}
                        </INNOStatus>
                        {run.errorCode ? <div className="table-meta">{run.errorCode}</div> : null}
                      </td>
                      <td className="numeric-column">{run.rowCount}</td>
                      <td className="action-column">
                        {run.status === 'completed' ? (
                          <INNOButton
                            variant="secondary"
                            busy={download.isPending}
                            onClick={() => download.mutate({
                              runId: run.id,
                              fileName: run.outputFileName,
                            })}
                          >
                            {t('reports.action.download')}
                          </INNOButton>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={runs.data.page}
              pageSize={runs.data.pageSize}
              totalItems={runs.data.totalItems}
              totalPages={runs.data.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <INNOCollectionState
            kind="empty"
            title={t('reports.runs.empty.title')}
            description={t('reports.runs.empty.description')}
            action={canGenerate ? (
              <INNOButton busy={generate.isPending} onClick={() => generate.mutate()}>
                {t('reports.action.generate')}
              </INNOButton>
            ) : undefined}
          />
        )}
      </INNOCollection>
    </INNOPage>
  );
}
