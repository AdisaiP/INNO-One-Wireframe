import { INNOPage } from '@inno/ui';
import { useProfile } from '../app/ProfileContext';

function valueOrDash(value?: string | null) {
  return value?.trim() ? value : '—';
}

export function ProfilePage() {
  const profile = useProfile();
  const roleSummary = profile.roles.join(', ') || 'User';

  return (
    <INNOPage eyebrow="Account" title="Profile & Settings">
      <p className="page-helper">Your workspace profile and organization-managed sign-in.</p>

      <div className="profile-layout">
        <section className="prod-panel">
          <div className="profile-summary">
            <div className="profile-avatar-lg">
              {profile.fullName.split(/\s+/).slice(0, 2).map((x) => x[0]).join('')}
            </div>
            <div>
              <h2>{profile.fullName}</h2>
              <div className="muted-line">
                {profile.position?.name ?? 'Employee'}
                <span>·</span>
                {roleSummary}
              </div>
            </div>
            <span className="prod-tag success">{profile.status}</span>
          </div>

          <div className="kv-grid production-kv-grid">
            <div className="kv-row"><span>Email</span><b>{profile.email}</b></div>
            <div className="kv-row"><span>Employee ID</span><b>{profile.employeeId}</b></div>
            <div className="kv-row"><span>Organization</span><b>{profile.organization?.name ?? '—'}</b></div>
            <div className="kv-row"><span>Location</span><b>{profile.location?.name ?? '—'}</b></div>
            <div className="kv-row"><span>Office</span><b>{valueOrDash(profile.office)}</b></div>
            <div className="kv-row"><span>Phone</span><b>{valueOrDash(profile.phone)}</b></div>
            <div className="kv-row"><span>Time zone</span><b>{profile.timeZone}</b></div>
            <div className="kv-row">
              <span>SSO</span>
              <b><span className="prod-tag success">Connected</span></b>
            </div>
          </div>
        </section>

        <section className="prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>Security & sessions</h3>
              <p>Identity and sign-in are managed by your organization.</p>
            </div>
            <span className="prod-tag success">Healthy</span>
          </div>
          <div className="settings-stack">
            <div className="settings-row">
              <div>
                <b>Single Sign-On</b>
                <span>Keycloak · Authorization Code + PKCE</span>
              </div>
              <span className="prod-tag success">Connected</span>
            </div>
            <div className="settings-row">
              <div>
                <b>Business authorization</b>
                <span>Resolved from INNO.One roles and resource scopes</span>
              </div>
              <span className="prod-tag">{profile.permissions.length} permissions</span>
            </div>
          </div>
          <div className="purpose-note">
            <b>Sign-in and authorization are separate.</b>
            <span>Keycloak establishes identity. INNO.One resolves role, permission and resource scope server-side.</span>
          </div>
        </section>
      </div>
    </INNOPage>
  );
}
