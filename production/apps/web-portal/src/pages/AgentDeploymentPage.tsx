import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { INNOButton, INNOEditorFooter, INNOPage, INNOPurposeNote, INNOState, INNOStatus } from '@inno/ui';
import { createAgentInstaller, getDeviceGroups } from '../api/client';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

export function AgentDeploymentPage() {
  const { t: t45n } = useStep45NI18n();
  const groups = useQuery({
    queryKey: ['device-groups', 'installer'],
    queryFn: () => getDeviceGroups({ page: 1, pageSize: 100, status: 'active', type: 'static' }),
  });

  const [groupId, setGroupId] = useState('');
  const [operatingSystem, setOperatingSystem] = useState('windows');
  const [profile, setProfile] = useState('standard');
  const [copied, setCopied] = useState(false);

  const generate = useMutation({
    mutationFn: () => createAgentInstaller({
      groupId,
      operatingSystem,
      profile,
      expiresHours: 24,
    }),
    onSuccess: () => setCopied(false),
  });

  const endpointInstallCommand = generate.data?.endpointInstallerUrl
    && generate.data.endpointEnrollmentToken
    ? [
        "$dir=Join-Path $env:ProgramData 'INNO.One'",
        "New-Item -ItemType Directory -Force -Path $dir | Out-Null",
        "Set-Content -Path (Join-Path $dir 'enrollment-token.txt') -Value '" + generate.data.endpointEnrollmentToken + "' -NoNewline",
        "$msi=Join-Path $env:TEMP 'INNO.One-Agent.msi'",
        "Invoke-WebRequest -UseBasicParsing '" + generate.data.endpointInstallerUrl + "' -OutFile $msi",
        "Start-Process msiexec.exe -ArgumentList @('/i',$msi,'/qn') -Wait",
      ].join('; ')
    : null;

  const copyInstallCommand = async () => {
    if (!endpointInstallCommand) return;
    await navigator.clipboard.writeText(endpointInstallCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <INNOPage
      eyebrow={t45n('navigation.devices')}
      title={t45n('navigation.agentDeployment')}
      description={t45n('devices.step45n.agentDeployment.generateATimeLimitedEnrollmentLinkForInstalling')}
      illustration={<img src="/illustrations/device-setup.svg" alt="" />}
    >

      <div className="deployment-layout">
        <section className="prod-panel deployment-card">
          {groups.isPending ? (
            <div className="collection-state"><LoadingState label={t45n('devices.step45n.agentDeployment.loadingDeviceGroups')} /></div>
          ) : groups.isError ? (
            <div className="collection-state"><ErrorState error={groups.error} retry={() => void groups.refetch()} /></div>
          ) : groups.data.items.length === 0 ? (
            <div className="collection-state"><INNOState title={t45n('devices.step45n.agentDeployment.noActiveGroupsAvailable')} description={t45n('devices.step45n.agentDeployment.createADeviceGroupBeforeGeneratingAnEnrollment')} /></div>
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
                  <span>{t45n('devices.shared.field.deviceGroup')}</span>
                  <select required value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                    <option value="">{t45n('devices.step45n.agentDeployment.selectAGroup')}</option>
                    {groups.data.items.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field-block">
                  <span>{t45n('devices.shared.field.operatingSystem')}</span>
                  <select value={operatingSystem} onChange={(event) => setOperatingSystem(event.target.value)}>
                    <option value="windows">{t45n('devices.step45n.agentDeployment.windows')}</option>
                    <option value="macos">{t45n('devices.step45n.agentDeployment.macos')}</option>
                    <option value="linux">{t45n('devices.step45n.agentDeployment.linux')}</option>
                  </select>
                </label>
                <label className="field-block">
                  <span>{t45n('devices.step45n.agentDeployment.installerProfile')}</span>
                  <select value={profile} onChange={(event) => setProfile(event.target.value)}>
                    <option value="standard">{t45n('devices.step45n.agentDeployment.standard')}</option>
                    <option value="unattended">{t45n('devices.step45n.agentDeployment.unattendedSupport')}</option>
                  </select>
                </label>
              </div>
              {generate.isError ? <ErrorState error={generate.error} /> : null}
              <INNOEditorFooter>
                <INNOButton type="submit" busy={generate.isPending} disabled={!groupId}>{t45n('devices.step45n.agentDeployment.generateInstaller')}</INNOButton>
              </INNOEditorFooter>
            </form>
          )}
        </section>

        <section className="prod-panel deployment-card">
          <div className="deployment-section-title"><h3>{t45n('devices.step45n.agentDeployment.howEnrollmentWorks')}</h3></div>
          <div className="enrollment-steps">
            <div><b>1</b><span>{t45n('devices.step45n.agentDeployment.generateInstaller2')}</span></div>
            <div><b>2</b><span>{t45n('devices.step45n.agentDeployment.installAgentOnTargetDevice')}</span></div>
            <div><b>3</b><span>{t45n('devices.step45n.agentDeployment.agentConnectsToMeshcentral')}</span></div>
            <div><b>4</b><span>{t45n('devices.step45n.agentDeployment.innoOneSynchronizationCreatesOrUpdatesTheCanonical')}</span></div>
          </div>
        </section>
      </div>

      {generate.data ? (
        <section className="prod-panel enrollment-result">
          <div className="prod-panel-head">
            <div><h3>{t45n('devices.step45n.agentDeployment.enrollmentReady')}</h3><p>{generate.data.groupName} · {generate.data.operatingSystem} {t45n('devices.step45n.agentDeployment.expires')}{' '}{generate.data.expiresAt ? new Date(generate.data.expiresAt).toLocaleString() : t45n('devices.step45n.agentDeployment.accordingToProviderPolicy')}</p></div>
            <INNOStatus tone="success">{generate.data.status}</INNOStatus>
          </div>
          <div className="enrollment-link-row">
            <div>
              <span>{t45n('devices.step45n.agentDeployment.enrollmentLink')}</span>
              <code>{generate.data.enrollmentUrl}</code>
            </div>
            <a className="inno-link-button" href={generate.data.enrollmentUrl} target="_blank" rel="noreferrer">{t45n('devices.step45n.agentDeployment.openEnrollment')}</a>
          </div>
          {endpointInstallCommand ? (
            <div className="enrollment-link-row">
              <div>
                <span>INNO.One Endpoint Agent · Windows PowerShell (Run as Administrator)</span>
                <code>{endpointInstallCommand}</code>
                <small>
                  One-time machine enrollment
                  {generate.data.endpointEnrollmentExpiresAt
                    ? ' · expires ' + new Date(generate.data.endpointEnrollmentExpiresAt).toLocaleString()
                    : ''}
                </small>
              </div>
              <INNOButton variant="secondary" type="button" onClick={() => void copyInstallCommand()}>
                {copied ? 'Copied' : 'Copy install command'}
              </INNOButton>
            </div>
          ) : null}
          <INNOPurposeNote
            title={t45n('devices.step45n.agentDeployment.vendorIdsStayPrivate')}
            description={t45n('devices.step45n.agentDeployment.thisAuthorizedLinkIsTimeLimitedInnoOne')}
          />
        </section>
      ) : null}
    </INNOPage>
  );
}
