import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  INNOState,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  createAgentRollout,
  createDeploymentJob,
  createRestartJob,
  createSoftwareMaintenanceJob,
  getAgentRollouts,
  getDeploymentJob,
  getDeploymentJobs,
  getDeviceGroups,
  getMaintenanceHistory,
  getRestartJobs,
  getSoftwareMaintenanceJobs,
} from '../api/client';
import type {
  AgentRolloutJob,
  DeploymentJob,
  DeviceJobStatus,
  MaintenanceHistoryItem,
  MaintenanceJob,
} from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';

function tone(status: DeviceJobStatus) {
  if (status === 'completed') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (status === 'partial') return 'warning' as const;
  if (status === 'running' || status === 'queued' || status === 'scheduled') return 'info' as const;
  return 'neutral' as const;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function progress(completed: number, failed: number, total: number) {
  if (total <= 0) return '0 / 0';
  return (completed + failed) + ' / ' + total;
}

function GroupTargetPicker(props: {
  groupId: string;
  setGroupId: (value: string) => void;
  allowAll?: boolean;
  allManaged: boolean;
  setAllManaged: (value: boolean) => void;
}) {
  const groups = useQuery({
    queryKey: ['device-groups', 'step45w-picker'],
    queryFn: () => getDeviceGroups({ page: 1, pageSize: 100, status: 'active', type: 'static' }),
  });

  if (groups.isPending) return <LoadingState label="Loading device groups…" />;
  if (groups.isError) return <ErrorState error={groups.error} retry={() => void groups.refetch()} />;

  return (
    <div className="editor-grid">
      {props.allowAll ? (
        <label className="field-block">
          <span>Target scope</span>
          <select
            value={props.allManaged ? 'all_managed' : 'device_group'}
            onChange={(event) => props.setAllManaged(event.target.value === 'all_managed')}
          >
            <option value="device_group">Device Group</option>
            <option value="all_managed">All managed devices</option>
          </select>
        </label>
      ) : null}
      {!props.allManaged ? (
        <label className="field-block">
          <span>Device Group</span>
          <select required value={props.groupId} onChange={(event) => props.setGroupId(event.target.value)}>
            <option value="">Select a group</option>
            {groups.data.items.map((group) => (
              <option key={group.id} value={group.id}>{group.name} · {group.members} devices</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function CollectionLoading({ label }: { label: string }) {
  return <div className="collection-state"><LoadingState label={label} /></div>;
}

export function DeploymentJobsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['devices', 'deployments', page],
    queryFn: () => getDeploymentJobs(page, 25),
  });

  return (
    <main className="inno-page">
      <INNOResourceHeader
        icon={<INNOIcon token="section.deployment" size={20} />}
        title="Deployment Jobs"
        meta={<span>Track Agent, Software, and File distribution jobs from one operations view.</span>}
        actions={<Link to="/devices/deployments/new"><INNOButton variant="primary">New Deployment</INNOButton></Link>}
      />
      {query.isPending ? <CollectionLoading label="Loading deployment jobs…" /> : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <INNOCollectionState
          kind="empty"
          title="No deployment jobs yet"
          description="Create a deployment to distribute an Agent, approved software package, or files."
        />
      ) : (
        <INNOCollection>
          <INNOCollectionHeader title="Jobs" description="Canonical INNO.One deployment lifecycle. Execution is never marked complete without endpoint evidence." />
          <INNOTableWrap width="wide">
            <table>
              <thead><tr><th>Job</th><th>Type</th><th>Targets</th><th>Progress</th><th>Schedule</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{query.data.items.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.jobNumber}</b><div className="table-meta">{item.payloadName}</div></td>
                  <td>{item.deploymentType}</td>
                  <td>{item.targetLabel}<div className="table-meta">{item.targetCount} devices</div></td>
                  <td>{progress(item.completedCount, item.failedCount, item.targetCount)}</td>
                  <td>{item.scheduleMode === 'scheduled' ? formatDate(item.scheduledAt) : 'Run now'}</td>
                  <td><INNOStatus tone={tone(item.status)}>{item.status}</INNOStatus></td>
                  <td><Link to={'/devices/deployments/' + item.id}>View</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </INNOTableWrap>
          <INNOPagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} totalPages={query.data.totalPages} onPageChange={setPage} />
        </INNOCollection>
      )}
    </main>
  );
}

export function DeploymentCreatePage() {
  const navigate = useNavigate();
  const [deploymentType, setDeploymentType] = useState<'agent' | 'software' | 'files'>('agent');
  const [groupId, setGroupId] = useState('');
  const [allManaged, setAllManaged] = useState(false);
  const [payloadName, setPayloadName] = useState('INNO.One Agent 1.8.4');
  const [profile, setProfile] = useState('standard');
  const [scheduleMode, setScheduleMode] = useState<'run_now' | 'scheduled'>('run_now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [maintenanceWindow, setMaintenanceWindow] = useState('Any time');
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [restartPolicy, setRestartPolicy] = useState('notify_and_defer');

  const mutation = useMutation({
    mutationFn: () => createDeploymentJob({
      deploymentType,
      targetScopeType: allManaged ? 'all_managed' : 'device_group',
      targetScopeId: allManaged ? undefined : groupId,
      payloadName,
      profileOrDestination: profile,
      scheduleMode,
      scheduledAt: scheduleMode === 'scheduled' ? new Date(scheduledAt).toISOString() : undefined,
      maintenanceWindow,
      retryAttempts,
      restartPolicy,
    }),
    onSuccess: (result) => navigate('/devices/deployments/' + result.resourceId),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if ((!allManaged && !groupId) || !payloadName || (scheduleMode === 'scheduled' && !scheduledAt)) return;
    mutation.mutate();
  }

  return (
    <INNOPage
      eyebrow="Devices · Deployment"
      title="New Deployment"
      description="Create a deployment step by step instead of exposing Agent, Software, and File forms together."
    >
      <form className="editor-form" onSubmit={submit}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Choose deployment type</h3><p>Select the payload class this job owns.</p></div></div>
          <div className="editor-grid">
            <label className="field-block"><span>Deployment type</span><select value={deploymentType} onChange={(e) => setDeploymentType(e.target.value as typeof deploymentType)}>
              <option value="agent">Agent</option><option value="software">Software</option><option value="files">Files</option>
            </select></label>
            <label className="field-block"><span>Package / source</span><input required value={payloadName} onChange={(e) => setPayloadName(e.target.value)} /></label>
            <label className="field-block"><span>Install profile / destination</span><input value={profile} onChange={(e) => setProfile(e.target.value)} /></label>
          </div>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Select targets</h3><p>The reusable target definition is resolved again when execution begins.</p></div></div>
          <GroupTargetPicker groupId={groupId} setGroupId={setGroupId} allowAll allManaged={allManaged} setAllManaged={setAllManaged} />
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Schedule & safeguards</h3><p>Keep timing, retry and restart handling explicit before the job is queued.</p></div></div>
          <div className="editor-grid">
            <label className="field-block"><span>Start</span><select value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as typeof scheduleMode)}>
              <option value="run_now">Run now</option><option value="scheduled">Schedule date/time</option>
            </select></label>
            {scheduleMode === 'scheduled' ? <label className="field-block"><span>Schedule date/time</span><input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label> : null}
            <label className="field-block"><span>Maintenance window</span><select value={maintenanceWindow} onChange={(e) => setMaintenanceWindow(e.target.value)}>
              <option>Any time</option><option>18:00–22:00</option>
            </select></label>
            <label className="field-block"><span>Retry</span><select value={retryAttempts} onChange={(e) => setRetryAttempts(Number(e.target.value))}>
              <option value={3}>3 attempts</option><option value={5}>5 attempts</option>
            </select></label>
            <label className="field-block"><span>On restart required</span><select value={restartPolicy} onChange={(e) => setRestartPolicy(e.target.value)}>
              <option value="notify_and_defer">Notify user and defer</option><option value="maintenance_window">Restart in maintenance window</option>
            </select></label>
          </div>
        </section>

        {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        <INNOEditorFooter>
          <Link to="/devices/deployments"><INNOButton type="button" variant="secondary">Cancel</INNOButton></Link>
          <INNOButton type="submit" busy={mutation.isPending}>Create Deployment</INNOButton>
        </INNOEditorFooter>
      </form>
    </INNOPage>
  );
}

export function DeploymentJobDetailPage() {
  const { deploymentId = '' } = useParams();
  const query = useQuery({
    queryKey: ['devices', 'deployment', deploymentId],
    queryFn: () => getDeploymentJob(deploymentId),
    enabled: Boolean(deploymentId),
  });
  if (query.isPending) return <main className="inno-page"><LoadingState label="Loading deployment…" /></main>;
  if (query.isError) return <main className="inno-page"><ErrorState error={query.error} retry={() => void query.refetch()} /></main>;

  const item = query.data;
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb"><Link to="/devices/deployments">Deployment Jobs</Link><span>›</span><span>{item.jobNumber}</span></div>
      <INNOResourceHeader
        icon={<INNOIcon token="section.deployment" size={20} />}
        title={item.jobNumber}
        status={<INNOStatus tone={tone(item.status)}>{item.status}</INNOStatus>}
        meta={<><span>{item.deploymentType}</span><span>·</span><span>{item.payloadName}</span></>}
      />
      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Targets" value={String(item.targetCount)} detail={item.targetLabel} />
        <INNOResourceSummaryItem label="Completed" value={String(item.completedCount)} detail="Confirmed endpoint results" />
        <INNOResourceSummaryItem label="Failed" value={String(item.failedCount)} detail={item.failedCount > 0 ? 'Retry may be required' : 'No failures reported'} />
        <INNOResourceSummaryItem label="Schedule" value={item.scheduleMode === 'scheduled' ? formatDate(item.scheduledAt) : 'Run now'} detail={item.maintenanceWindow ?? 'Any time'} />
      </INNOResourceSummary>
      <section className="prod-panel">
        <div className="prod-panel-head"><div><h3>Job Summary</h3><p>INNO.One owns the canonical lifecycle and only advances progress from execution evidence.</p></div></div>
        <div className="kv-grid production-kv-grid">
          <div className="kv-row"><span>Payload</span><b>{item.payloadName}</b></div>
          <div className="kv-row"><span>Target</span><b>{item.targetLabel}</b></div>
          <div className="kv-row"><span>Retry</span><b>{item.retryAttempts} attempts</b></div>
          <div className="kv-row"><span>Restart policy</span><b>{item.restartPolicy ?? '—'}</b></div>
          <div className="kv-row"><span>Created</span><b>{formatDate(item.createdAt)}</b></div>
          <div className="kv-row"><span>Started</span><b>{formatDate(item.startedAt)}</b></div>
        </div>
      </section>
      <INNOState
        banner
        kind="partial"
        title="Execution evidence required"
        description="Queued or scheduled jobs are not presented as completed until an endpoint execution channel reports a result."
      />
    </main>
  );
}

export function AgentMaintenancePage() {
  const rollouts = useQuery({ queryKey: ['devices', 'maintenance', 'rollouts', 'summary'], queryFn: () => getAgentRollouts(1, 5) });
  const software = useQuery({ queryKey: ['devices', 'maintenance', 'software', 'summary'], queryFn: () => getSoftwareMaintenanceJobs(1, 5) });
  const restarts = useQuery({ queryKey: ['devices', 'maintenance', 'restart', 'summary'], queryFn: () => getRestartJobs(1, 5) });

  const failed = useMemo(() => {
    const items = [
      ...(rollouts.data?.items ?? []),
      ...(software.data?.items ?? []),
      ...(restarts.data?.items ?? []),
    ];
    return items.filter((x) => x.status === 'failed' || x.status === 'partial').length;
  }, [rollouts.data, software.data, restarts.data]);

  return (
    <main className="inno-page">
      <INNOResourceHeader
        icon={<INNOIcon token="section.settings" size={20} />}
        title="Agent Maintenance"
        meta={<span>Review Agent Updates, Software, Restart, and History as separate operational tasks.</span>}
      />
      <INNOResourceSummary>
        <INNOResourceSummaryItem label="Needs Attention" value={String(failed)} detail="Failed or partial maintenance jobs" />
        <INNOResourceSummaryItem label="Agent Rollouts" value={String(rollouts.data?.totalItems ?? 0)} detail="Version rollout jobs" />
        <INNOResourceSummaryItem label="Software Jobs" value={String(software.data?.totalItems ?? 0)} detail="Install/update/uninstall" />
        <INNOResourceSummaryItem label="Restart Windows" value={String(restarts.data?.totalItems ?? 0)} detail="Scheduled restart operations" />
      </INNOResourceSummary>

      <div className="device-overview-grid">
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Agent Updates</h3><p>Versions, rollout progress and staged update jobs.</p></div><Link to="/devices/maintenance/agent-updates">Open</Link></div>
        </section>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Software Maintenance</h3><p>Install, update and uninstall approved packages.</p></div><Link to="/devices/maintenance/software">Open</Link></div>
        </section>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Restart Operations</h3><p>Scheduled restarts, user notice and offline-device handling.</p></div><Link to="/devices/maintenance/restarts">Open</Link></div>
        </section>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Maintenance History</h3><p>Agent, software and restart operations in one history.</p></div><Link to="/devices/maintenance/history">Open</Link></div>
        </section>
      </div>
    </main>
  );
}

export function AgentUpdatesPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['devices', 'agent-rollouts', page], queryFn: () => getAgentRollouts(page, 25) });
  return (
    <JobListShell title="Agent Updates" description="Track Agent versions and rollouts separately from Software and Restart workflows." action={<Link to="/devices/maintenance/agent-rollouts/new"><INNOButton>New Agent Rollout</INNOButton></Link>}>
      {query.isPending ? <CollectionLoading label="Loading Agent rollouts…" /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <INNOCollectionState kind="empty" title="No Agent rollouts" description="Create a staged rollout when an Agent release is ready." />
      ) : (
        <INNOCollection><INNOCollectionHeader title="Rollouts" description="Staged and completed Agent update jobs." />
          <INNOTableWrap width="wide"><table><thead><tr><th>Rollout</th><th>Version</th><th>Target</th><th>Progress</th><th>Failure rate</th><th>Status</th></tr></thead>
            <tbody>{query.data.items.map((x) => <tr key={x.id}><td><b>{x.rolloutNumber}</b></td><td>{x.releaseVersion}</td><td>{x.targetLabel}</td><td>{progress(x.completedCount, x.failedCount, x.targetCount)}</td><td>{x.targetCount ? Math.round((x.failedCount / x.targetCount) * 100) : 0}%</td><td><INNOStatus tone={tone(x.status)}>{x.status}</INNOStatus></td></tr>)}</tbody></table></INNOTableWrap>
          <INNOPagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} totalPages={query.data.totalPages} onPageChange={setPage} />
        </INNOCollection>
      )}
    </JobListShell>
  );
}

export function AgentRolloutCreatePage() {
  const navigate = useNavigate();
  const [releaseVersion, setReleaseVersion] = useState('1.8.4');
  const [groupId, setGroupId] = useState('');
  const [allManaged, setAllManaged] = useState(false);
  const [maintenanceWindow, setMaintenanceWindow] = useState('18:00–22:00');
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [threshold, setThreshold] = useState(10);
  const mutation = useMutation({
    mutationFn: () => createAgentRollout({
      releaseVersion,
      targetScopeType: allManaged ? 'all_managed' : 'device_group',
      targetScopeId: allManaged ? undefined : groupId,
      maintenanceWindow,
      retryAttempts,
      pauseFailureThresholdPercent: threshold,
    }),
    onSuccess: () => navigate('/devices/maintenance/agent-updates'),
  });
  return (
    <INNOPage eyebrow="Devices · Maintenance · Agent Updates" title="New Agent Rollout" description="Dedicated rollout form with only Agent update options.">
      <form className="editor-form" onSubmit={(e) => { e.preventDefault(); if (allManaged || groupId) mutation.mutate(); }}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Rollout configuration</h3><p>Select a release, target and staged safety policy.</p></div></div>
          <div className="editor-grid">
            <label className="field-block"><span>Release version</span><select value={releaseVersion} onChange={(e) => setReleaseVersion(e.target.value)}><option value="1.8.4">1.8.4 · Stable</option><option value="1.8.5-rc1">1.8.5-rc1 · Preview</option></select></label>
            <label className="field-block"><span>Maintenance window</span><select value={maintenanceWindow} onChange={(e) => setMaintenanceWindow(e.target.value)}><option>18:00–22:00</option><option>Any time</option></select></label>
            <label className="field-block"><span>Retry policy</span><select value={retryAttempts} onChange={(e) => setRetryAttempts(Number(e.target.value))}><option value={3}>3 attempts</option><option value={5}>5 attempts</option></select></label>
            <label className="field-block"><span>Pause failure threshold</span><input type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label>
          </div>
          <GroupTargetPicker groupId={groupId} setGroupId={setGroupId} allowAll allManaged={allManaged} setAllManaged={setAllManaged} />
        </section>
        <INNOPurposeNote title="Staged rollout safety" description={'The Product records a ' + threshold + '% automatic-pause threshold; execution must report endpoint results before progress advances.'} />
        {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        <INNOEditorFooter><Link to="/devices/maintenance/agent-updates"><INNOButton type="button" variant="secondary">Cancel</INNOButton></Link><INNOButton type="submit" busy={mutation.isPending}>Start Staged Rollout</INNOButton></INNOEditorFooter>
      </form>
    </INNOPage>
  );
}

export function SoftwareMaintenancePage() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['devices', 'software-maintenance', page], queryFn: () => getSoftwareMaintenanceJobs(page, 25) });
  return (
    <JobListShell title="Software Maintenance" description="Manage software install, update and uninstall jobs separately from Agent rollouts and Restart operations." action={<Link to="/devices/maintenance/software/new"><INNOButton>New Maintenance Job</INNOButton></Link>}>
      {query.isPending ? <CollectionLoading label="Loading software jobs…" /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <INNOCollectionState kind="empty" title="No software maintenance jobs" description="Create a job to install, update or uninstall an approved package." />
      ) : (
        <MaintenanceTable items={query.data.items} page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} totalPages={query.data.totalPages} onPageChange={setPage} />
      )}
    </JobListShell>
  );
}

export function SoftwareMaintenanceCreatePage() {
  const navigate = useNavigate();
  const [action, setAction] = useState<'install' | 'update' | 'uninstall'>('update');
  const [packageName, setPackageName] = useState('7-Zip 25.01');
  const [groupId, setGroupId] = useState('');
  const [allManaged, setAllManaged] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'run_now' | 'scheduled'>('run_now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [maintenanceWindow, setMaintenanceWindow] = useState('Next maintenance window');
  const [restartPolicy, setRestartPolicy] = useState('defer_to_restart_operations');
  const mutation = useMutation({
    mutationFn: () => createSoftwareMaintenanceJob({
      action,
      packageName,
      targetScopeType: allManaged ? 'all_managed' : 'device_group',
      targetScopeId: allManaged ? undefined : groupId,
      scheduleMode,
      scheduledAt: scheduleMode === 'scheduled' ? new Date(scheduledAt).toISOString() : undefined,
      maintenanceWindow,
      retryAttempts: 3,
      restartPolicy,
    }),
    onSuccess: () => navigate('/devices/maintenance/software'),
  });

  return (
    <INNOPage eyebrow="Devices · Maintenance · Software" title="New Software Maintenance Job" description="Choose the software action, target devices and execution policy as one maintenance job.">
      <form className="editor-form" onSubmit={(e) => { e.preventDefault(); if ((allManaged || groupId) && (scheduleMode === 'run_now' || scheduledAt)) mutation.mutate(); }}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Software action</h3><p>Choose what to do and which approved package this job owns.</p></div></div>
          <div className="editor-grid">
            <label className="field-block"><span>Action</span><select value={action} onChange={(e) => setAction(e.target.value as typeof action)}><option value="install">Install</option><option value="update">Install / Update</option><option value="uninstall">Uninstall</option></select></label>
            <label className="field-block"><span>Package</span><input required value={packageName} onChange={(e) => setPackageName(e.target.value)} /></label>
          </div>
        </section>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Targets & timing</h3><p>Target a reusable scope and decide when the maintenance queue may run.</p></div></div>
          <GroupTargetPicker groupId={groupId} setGroupId={setGroupId} allowAll allManaged={allManaged} setAllManaged={setAllManaged} />
          <div className="editor-grid">
            <label className="field-block"><span>Schedule</span><select value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as typeof scheduleMode)}><option value="run_now">Run now</option><option value="scheduled">Schedule date/time</option></select></label>
            {scheduleMode === 'scheduled' ? <label className="field-block"><span>Date/time</span><input type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label> : null}
            <label className="field-block"><span>Maintenance window</span><select value={maintenanceWindow} onChange={(e) => setMaintenanceWindow(e.target.value)}><option>Next maintenance window</option><option>Any time</option></select></label>
            <label className="field-block"><span>On restart required</span><select value={restartPolicy} onChange={(e) => setRestartPolicy(e.target.value)}><option value="defer_to_restart_operations">Defer to Restart Operations</option><option value="prompt_user">Prompt user</option></select></label>
          </div>
        </section>
        {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        <INNOEditorFooter><Link to="/devices/maintenance/software"><INNOButton type="button" variant="secondary">Cancel</INNOButton></Link><INNOButton type="submit" busy={mutation.isPending}>Create Job</INNOButton></INNOEditorFooter>
      </form>
    </INNOPage>
  );
}

export function RestartOperationsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['devices', 'restart-jobs', page], queryFn: () => getRestartJobs(page, 25) });
  return (
    <JobListShell title="Restart Operations" description="Manage scheduled restarts and user grace periods in a dedicated workspace." action={<Link to="/devices/maintenance/restarts/new"><INNOButton>Schedule Restart</INNOButton></Link>}>
      {query.isPending ? <CollectionLoading label="Loading restart windows…" /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <INNOCollectionState kind="empty" title="No restart windows" description="Schedule a restart window for a managed Device Group." />
      ) : (
        <INNOCollection><INNOCollectionHeader title="Upcoming Restart Windows" description="Scheduled operations only." />
          <INNOTableWrap width="wide"><table><thead><tr><th>Window</th><th>Target</th><th>Schedule</th><th>Notice</th><th>Grace</th><th>Status</th></tr></thead>
            <tbody>{query.data.items.map((x) => <tr key={x.id}><td><b>{x.jobNumber}</b></td><td>{x.targetLabel}</td><td>{formatDate(x.scheduledAt)}</td><td>{x.userMessage ? 'Configured' : 'Default'}</td><td>{x.graceMinutes ?? 0} min</td><td><INNOStatus tone={tone(x.status)}>{x.status}</INNOStatus></td></tr>)}</tbody></table></INNOTableWrap>
          <INNOPagination page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} totalPages={query.data.totalPages} onPageChange={setPage} />
        </INNOCollection>
      )}
    </JobListShell>
  );
}

export function RestartSchedulePage() {
  const navigate = useNavigate();
  const [groupId, setGroupId] = useState('');
  const [allManaged, setAllManaged] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [graceMinutes, setGraceMinutes] = useState(10);
  const [message, setMessage] = useState('Your computer will restart for system maintenance. Please save your work before the scheduled time.');
  const [offlinePolicy, setOfflinePolicy] = useState<'next_check_in_24h' | 'skip'>('next_check_in_24h');
  const mutation = useMutation({
    mutationFn: () => createRestartJob({
      targetScopeType: allManaged ? 'all_managed' : 'device_group',
      targetScopeId: allManaged ? undefined : groupId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      graceMinutes,
      userMessage: message,
      offlinePolicy,
    }),
    onSuccess: () => navigate('/devices/maintenance/restarts'),
  });
  return (
    <INNOPage eyebrow="Devices · Maintenance · Restart" title="Schedule Restart" description="Choose who is affected, when the restart happens, and what users will see before it runs.">
      <form className="editor-form" onSubmit={(e) => { e.preventDefault(); if ((allManaged || groupId) && scheduledAt) mutation.mutate(); }}>
        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>Target devices</h3><p>Schedule against a reusable target scope rather than ad-hoc device selection.</p></div></div>
          <GroupTargetPicker groupId={groupId} setGroupId={setGroupId} allowAll allManaged={allManaged} setAllManaged={setAllManaged} />
          <div className="editor-grid">
            <label className="field-block"><span>Restart time</span><input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
            <label className="field-block"><span>Grace period</span><select value={graceMinutes} onChange={(e) => setGraceMinutes(Number(e.target.value))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option></select></label>
            <label className="field-block"><span>If a device is offline</span><select value={offlinePolicy} onChange={(e) => setOfflinePolicy(e.target.value as typeof offlinePolicy)}><option value="next_check_in_24h">Run at next check-in within 24 hours</option><option value="skip">Skip</option></select></label>
          </div>
          <label className="field-block"><span>User notification message</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} /></label>
        </section>
        <INNOState banner kind="partial" title="Restart remains an audited operational job" description="Scheduling does not claim that the endpoint restarted. Execution and completion require endpoint evidence." />
        {mutation.isError ? <ErrorState error={mutation.error} /> : null}
        <INNOEditorFooter><Link to="/devices/maintenance/restarts"><INNOButton type="button" variant="secondary">Cancel</INNOButton></Link><INNOButton type="submit" busy={mutation.isPending}>Schedule Restart</INNOButton></INNOEditorFooter>
      </form>
    </INNOPage>
  );
}

export function MaintenanceHistoryPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['devices', 'maintenance-history', page], queryFn: () => getMaintenanceHistory(page, 25) });
  return (
    <JobListShell title="Maintenance History" description="Review Agent Updates, Software Maintenance, and Restart history without creation forms.">
      {query.isPending ? <CollectionLoading label="Loading maintenance history…" /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <INNOCollectionState kind="empty" title="No maintenance history" description="Agent, software and restart operations will appear here." />
      ) : (
        <HistoryTable items={query.data.items} page={query.data.page} pageSize={query.data.pageSize} totalItems={query.data.totalItems} totalPages={query.data.totalPages} onPageChange={setPage} />
      )}
    </JobListShell>
  );
}

function JobListShell(props: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="inno-page">
      <div className="resource-breadcrumb"><Link to="/devices/maintenance">Agent Maintenance</Link><span>›</span><span>{props.title}</span></div>
      <INNOResourceHeader icon={<INNOIcon token="section.settings" size={20} />} title={props.title} meta={<span>{props.description}</span>} actions={props.action} />
      {props.children}
    </main>
  );
}

function MaintenanceTable(props: {
  items: MaintenanceJob[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <INNOCollection><INNOCollectionHeader title="Software Jobs" description="Maintenance-specific package operations." />
      <INNOTableWrap width="wide"><table><thead><tr><th>Job</th><th>Action</th><th>Package</th><th>Target</th><th>Completed</th><th>Failed</th><th>Status</th></tr></thead>
        <tbody>{props.items.map((x) => <tr key={x.id}><td><b>{x.jobNumber}</b></td><td>{x.action ?? '—'}</td><td>{x.packageName ?? '—'}</td><td>{x.targetLabel}</td><td>{x.completedCount}</td><td>{x.failedCount}</td><td><INNOStatus tone={tone(x.status)}>{x.status}</INNOStatus></td></tr>)}</tbody></table></INNOTableWrap>
      <INNOPagination page={props.page} pageSize={props.pageSize} totalItems={props.totalItems} totalPages={props.totalPages} onPageChange={props.onPageChange} />
    </INNOCollection>
  );
}

function HistoryTable(props: {
  items: MaintenanceHistoryItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <INNOCollection><INNOCollectionHeader title="Maintenance activity" description="Agent, software and restart operations in one history." />
      <INNOTableWrap width="wide"><table><thead><tr><th>Time</th><th>Job</th><th>Type</th><th>Target</th><th>Succeeded</th><th>Failed</th><th>Result</th></tr></thead>
        <tbody>{props.items.map((x) => <tr key={x.id}><td>{formatDate(x.completedAt ?? x.createdAt)}</td><td><b>{x.jobNumber}</b><div className="table-meta">{x.summary}</div></td><td>{x.type}</td><td>{x.targetLabel}</td><td>{x.succeeded}</td><td>{x.failed}</td><td><INNOStatus tone={tone(x.status)}>{x.status}</INNOStatus></td></tr>)}</tbody></table></INNOTableWrap>
      <INNOPagination page={props.page} pageSize={props.pageSize} totalItems={props.totalItems} totalPages={props.totalPages} onPageChange={props.onPageChange} />
    </INNOCollection>
  );
}
