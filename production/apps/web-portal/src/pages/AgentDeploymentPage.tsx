import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { INNOButton, INNOPage, INNOState } from '@inno/ui';
import { createAgentInstaller, getDeviceGroups } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';

export function AgentDeploymentPage() {
  const groups = useQuery({
    queryKey: ['device-groups', 'installer'],
    queryFn: () => getDeviceGroups({ page: 1, pageSize: 100, status: 'active', type: 'static' }),
  });

  const [groupId, setGroupId] = useState('');
  const [operatingSystem, setOperatingSystem] = useState('windows');
  const [profile, setProfile] = useState('standard');

  const generate = useMutation({
    mutationFn: () => createAgentInstaller({
      groupId,
      operatingSystem,
      profile,
      expiresHours: 24,
    }),
  });

  return (
    <INNOPage eyebrow="Devices" title="Agent Deployment">
      <p className="page-helper">
        Generate a time-limited enrollment link for installing the managed endpoint agent into a Device Group.
      </p>

      <div className="deployment-layout">
        <section className="prod-panel">
          <div className="prod-panel-head">
            <div><h3>Enrollment package</h3><p>The remote engine stays behind the Devices API boundary.</p></div>
          </div>
          {groups.isPending ? (
            <div className="collection-state"><LoadingState label="Loading device groups…" /></div>
          ) : groups.isError ? (
            <div className="collection-state"><ErrorState error={groups.error} retry={() => void groups.refetch()} /></div>
          ) : groups.data.items.length === 0 ? (
            <div className="collection-state"><INNOState title="No active groups available" description="Create a Device Group before generating an enrollment link." /></div>
          ) : (
            <form
              className="editor-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (groupId && !generate.isPending) generate.mutate();
              }}
            >
              <div className="editor-grid">
                <label className="field-block">
                  <span>Device group</span>
                  <select required value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                    <option value="">Select a group…</option>
                    {groups.data.items.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field-block">
                  <span>Operating system</span>
                  <select value={operatingSystem} onChange={(event) => setOperatingSystem(event.target.value)}>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                    <option value="linux">Linux</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>Installer profile</span>
                  <select value={profile} onChange={(event) => setProfile(event.target.value)}>
                    <option value="standard">Standard</option>
                    <option value="unattended">Unattended support</option>
                  </select>
                </label>
              </div>
              {generate.isError ? <ErrorState error={generate.error} /> : null}
              <div className="editor-footer">
                <INNOButton type="submit" disabled={!groupId || generate.isPending}>
                  {generate.isPending ? 'Generating…' : 'Generate Enrollment'}
                </INNOButton>
              </div>
            </form>
          )}
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head"><div><h3>How enrollment works</h3><p>Canonical device identity is created only after the engine reports the endpoint.</p></div></div>
          <div className="enrollment-steps">
            <div><b>1</b><span>Generate enrollment</span></div>
            <div><b>2</b><span>Install agent on target device</span></div>
            <div><b>3</b><span>Agent connects to MeshCentral</span></div>
            <div><b>4</b><span>INNO.One synchronization creates or updates the canonical Device</span></div>
          </div>
        </section>
      </div>

      {generate.data ? (
        <section className="prod-panel enrollment-result">
          <div className="prod-panel-head">
            <div><h3>Enrollment ready</h3><p>{generate.data.groupName} · {generate.data.operatingSystem} · expires {generate.data.expiresAt ? new Date(generate.data.expiresAt).toLocaleString() : 'according to provider policy'}</p></div>
            <span className="prod-tag success">{generate.data.status}</span>
          </div>
          <div className="enrollment-link-row">
            <div>
              <span>Enrollment link</span>
              <code>{generate.data.enrollmentUrl}</code>
            </div>
            <a className="inno-link-button" href={generate.data.enrollmentUrl} target="_blank" rel="noreferrer">Open Enrollment</a>
          </div>
          <div className="purpose-note">
            <b>Vendor IDs stay private.</b>
            <span>This authorized link is time-limited. INNO.One public resource identifiers never expose the MeshCentral group or node ID.</span>
          </div>
        </section>
      ) : null}
    </INNOPage>
  );
}
