import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOCollectionState,
  INNOEditorFooter,
  INNOIcon,
  INNOPage,
  INNOPagination,
  INNOPurposeNote,
  INNOResourceHeader,
  INNOResourceSummary,
  INNOResourceSummaryItem,
  INNOSelectField,
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  getEndpointPolicies,
  getEndpointPolicy,
  getPolicyCompliance,
  updateEndpointPolicy,
} from '../api/client';
import type { EndpointPolicyDetail, EndpointPolicySummary } from '../api/types';
import { usePermission } from '../app/ProfileContext';
import { ErrorState, LoadingState } from '../components/Feedback';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value));
}

function policyTone(status: EndpointPolicySummary['status']) {
  if (status === 'enabled') return 'success' as const;
  if (status === 'draft') return 'warning' as const;
  return 'neutral' as const;
}

function assignmentLabel(policy: EndpointPolicySummary) {
  if (policy.assignments.length === 0) return 'Not assigned';
  return policy.assignments.map((assignment) => assignment.scopeLabel).join(', ');
}

export function EndpointPoliciesPage() {
  const query = useQuery({
    queryKey: ['devices', 'endpoint-policies'],
    queryFn: getEndpointPolicies,
  });

  return (
    <INNOPage
      eyebrow="Devices · Operations"
      title="Endpoint Policies"
      description="Define endpoint controls and review evidence-backed compliance inside your effective Device scope."
    >
      <INNOPurposeNote
        title="Compliance is evidence-based"
        description="A configured policy is not automatically compliant. Policies stay Pending for a device until the Endpoint Agent or another trusted Product source reports the evidence required by that policy."
      />

      {query.isPending ? (
        <LoadingState label="Loading endpoint policies…" />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <INNOCollectionState
          kind="empty"
          title="No endpoint policies"
          description="Endpoint policies appear after the Devices governance defaults are initialized."
        />
      ) : (
        <INNOCollection>
          <INNOCollectionHeader
            title="Policies"
            description="Policy definitions, assignment coverage, and current configuration state."
          />
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>Policy</th><th>Type</th><th>Assigned to</th><th>Devices</th><th>Updated</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {query.data.items.map((policy) => (
                  <tr key={policy.id}>
                    <td><b>{policy.name}</b><div className="table-meta">{policy.description ?? policy.code}</div></td>
                    <td>{policy.policyType.replaceAll('_', ' ')}</td>
                    <td>{assignmentLabel(policy)}</td>
                    <td>{policy.assignedDeviceCount}</td>
                    <td>{formatDate(policy.updatedAt)}</td>
                    <td><INNOStatus tone={policyTone(policy.status)}>{policy.status}</INNOStatus></td>
                    <td className="action-column"><Link to={'/devices/policies/' + policy.id}>View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </INNOTableWrap>
        </INNOCollection>
      )}
    </INNOPage>
  );
}

function readString(configuration: Record<string, unknown>, key: string, fallback = '') {
  const value = configuration[key];
  return typeof value === 'string' ? value : fallback;
}

export function EndpointPolicyDetailPage() {
  const { policyId = '' } = useParams();
  const canManage = usePermission('devices.policy.manage');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['devices', 'endpoint-policy', policyId],
    queryFn: () => getEndpointPolicy(policyId),
    enabled: Boolean(policyId),
  });

  const [status, setStatus] = useState<'enabled' | 'disabled' | 'draft'>('enabled');
  const [mode, setMode] = useState('');
  const [targetVersion, setTargetVersion] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setStatus(query.data.status);
    setMode(readString(query.data.configuration, 'mode'));
    setTargetVersion(readString(query.data.configuration, 'targetVersion'));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const policy = query.data!;
      const configuration: Record<string, unknown> = { ...policy.configuration };
      if (policy.policyType === 'agent_update') {
        configuration.targetVersion = targetVersion;
      } else {
        configuration.mode = mode;
      }
      return updateEndpointPolicy(policy.id, { status, configuration });
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(['devices', 'endpoint-policy', policyId], updated);
      await queryClient.invalidateQueries({ queryKey: ['devices', 'endpoint-policies'] });
      await queryClient.invalidateQueries({ queryKey: ['devices', 'policy-compliance', policyId] });
    },
  });

  if (query.isPending) return <main className="inno-page"><LoadingState label="Loading endpoint policy…" /></main>;
  if (query.isError) return <main className="inno-page"><ErrorState error={query.error} retry={() => void query.refetch()} /></main>;

  const policy = query.data;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (policy.policyType === 'agent_update' && !targetVersion.trim()) return;
    mutation.mutate();
  }

  return (
    <main className="inno-page">
      <div className="resource-breadcrumb"><Link to="/devices/policies">Endpoint Policies</Link><span>›</span><span>{policy.name}</span></div>
      <INNOResourceHeader
        icon={<INNOIcon token="section.policies" size={20} />}
        title={policy.name}
        status={<INNOStatus tone={policyTone(policy.status)}>{policy.status}</INNOStatus>}
        meta={<><span>{policy.policyType.replaceAll('_', ' ')}</span><span>·</span><span>{policy.code}</span></>}
        actions={<Link to={'/devices/policies/' + policy.id + '/compliance'}><INNOButton variant="secondary">View Compliance</INNOButton></Link>}
      />
      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Assigned devices" value={String(policy.assignedDeviceCount)} detail={assignmentLabel(policy)} />
        <INNOResourceSummaryItem label="Status" value={policy.status} detail="Policy configuration state" />
        <INNOResourceSummaryItem label="Updated" value={formatDate(policy.updatedAt)} detail="Last Product configuration update" />
      </INNOResourceSummary>

      <form className="editor-form" onSubmit={submit}>
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>Policy configuration</h3><p>{policy.description ?? 'Endpoint policy configuration.'}</p></div>
          </div>
          <div className="editor-grid">
            <label className="field-block">
              <span>Status</span>
              <select value={status} disabled={!canManage} onChange={(event) => setStatus(event.target.value as typeof status)}>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
                <option value="draft">Draft</option>
              </select>
            </label>

            {policy.policyType === 'agent_update' ? (
              <label className="field-block">
                <span>Target Endpoint Agent version</span>
                <input value={targetVersion} disabled={!canManage} onChange={(event) => setTargetVersion(event.target.value)} />
              </label>
            ) : policy.policyType === 'usb_storage' ? (
              <label className="field-block">
                <span>USB storage mode</span>
                <select value={mode} disabled={!canManage} onChange={(event) => setMode(event.target.value)}>
                  <option value="registered_only">Registered devices only</option>
                  <option value="read_only">Read only</option>
                  <option value="blocked">Blocked</option>
                  <option value="allow_all">Allow all</option>
                </select>
              </label>
            ) : policy.policyType === 'remote_consent' ? (
              <label className="field-block">
                <span>Remote consent mode</span>
                <select value={mode} disabled={!canManage} onChange={(event) => setMode(event.target.value)}>
                  <option value="always_prompt">Always prompt</option>
                </select>
              </label>
            ) : (
              <label className="field-block">
                <span>Screen capture mode</span>
                <select value={mode} disabled={!canManage} onChange={(event) => setMode(event.target.value)}>
                  <option value="blocked">Blocked</option>
                  <option value="allow">Allow</option>
                </select>
              </label>
            )}
          </div>
        </section>

        <INNOState
          banner
          kind="partial"
          title="Configuration and compliance are separate"
          description="Saving this policy changes the Product configuration. Device compliance changes only when trusted endpoint evidence is evaluated."
        />
        {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        {canManage ? (
          <INNOEditorFooter>
            <INNOButton type="submit" busy={mutation.isPending}>Save Policy</INNOButton>
          </INNOEditorFooter>
        ) : null}
      </form>
    </main>
  );
}

export function EndpointPolicyCompliancePage() {
  const { policyId = '' } = useParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const policy = useQuery({
    queryKey: ['devices', 'endpoint-policy', policyId],
    queryFn: () => getEndpointPolicy(policyId),
    enabled: Boolean(policyId),
  });
  const compliance = useQuery({
    queryKey: ['devices', 'policy-compliance', policyId, page, status],
    queryFn: () => getPolicyCompliance(policyId, page, 25, status),
    enabled: Boolean(policyId),
    refetchInterval: 30_000,
  });

  if (policy.isPending || compliance.isPending) return <main className="inno-page"><LoadingState label="Loading policy compliance…" /></main>;
  if (policy.isError) return <main className="inno-page"><ErrorState error={policy.error} retry={() => void policy.refetch()} /></main>;
  if (compliance.isError) return <main className="inno-page"><ErrorState error={compliance.error} retry={() => void compliance.refetch()} /></main>;

  const counts = compliance.data.items.reduce((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1;
    return result;
  }, {} as Record<string, number>);

  return (
    <INNOPage
      eyebrow="Devices · Policies"
      title={policy.data.name + ' Compliance'}
      description="Evidence-backed results for devices inside your effective scope."
      actions={<Link className="inno-link-button secondary" to={'/devices/policies/' + policy.data.id}>Back to Policy</Link>}
    >
      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Rows in view" value={String(compliance.data.totalItems)} detail="Current effective scope" />
        <INNOResourceSummaryItem label="Compliant" value={String(counts.compliant ?? 0)} detail="Evidence matches expected state" />
        <INNOResourceSummaryItem label="Non-compliant" value={String(counts.non_compliant ?? 0)} detail="Evidence differs from expected state" />
        <INNOResourceSummaryItem label="Pending" value={String(counts.pending ?? 0)} detail="Required endpoint evidence not reported" />
      </INNOResourceSummary>

      <INNOCollection>
        <INNOCollectionHeader
          title="Device compliance"
          description="Expected and observed values remain visible so Pending is not mistaken for Compliant."
        />
        <div className="data-toolbar">
          <INNOSelectField label="Result" value={status} onChange={(value) => { setStatus(value); setPage(1); }}>
            <option value="all">All</option>
            <option value="compliant">Compliant</option>
            <option value="non_compliant">Non-compliant</option>
            <option value="pending">Pending</option>
          </INNOSelectField>
        </div>
        {compliance.data.items.length === 0 ? (
          <INNOCollectionState kind="empty" title="No compliance rows" description="No evaluated devices match the selected result." />
        ) : (
          <>
            <INNOTableWrap width="wide">
              <table>
                <thead><tr><th>Device</th><th>Expected</th><th>Observed</th><th>Evidence</th><th>Evaluated</th><th>Result</th></tr></thead>
                <tbody>
                  {compliance.data.items.map((item) => (
                    <tr key={item.id}>
                      <td><Link to={'/devices/' + item.deviceId}><b>{item.deviceName}</b></Link></td>
                      <td>{item.expected}</td>
                      <td>{item.actual}</td>
                      <td>{item.evidenceSource}</td>
                      <td>{formatDate(item.evaluatedAt)}</td>
                      <td><INNOStatus tone={item.status === 'compliant' ? 'success' : item.status === 'non_compliant' ? 'danger' : 'warning'}>{item.status.replace('_', '-')}</INNOStatus></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
            <INNOPagination
              page={compliance.data.page}
              pageSize={compliance.data.pageSize}
              totalItems={compliance.data.totalItems}
              totalPages={compliance.data.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </INNOCollection>
    </INNOPage>
  );
}

export type { EndpointPolicyDetail };
