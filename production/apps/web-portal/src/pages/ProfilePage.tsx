import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { INNOButton, INNOPage, INNOStatus } from '@inno/ui';
import { updateCurrentProfile } from '../api/client';
import { useProfile } from '../app/ProfileContext';

function valueOrDash(value?: string | null) {
  return value?.trim() ? value : '—';
}

export function ProfilePage() {
  const profile = useProfile();
  const queryClient = useQueryClient();
  const roleSummary = profile.roles.join(', ') || 'User';
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [office, setOffice] = useState(profile.office ?? '');

  const mutation = useMutation({
    mutationFn: updateCurrentProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform', 'me'], updated);
      setPhone(updated.phone ?? '');
      setOffice(updated.office ?? '');
    },
  });

  const dirty = phone !== (profile.phone ?? '') || office !== (profile.office ?? '');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || mutation.isPending) return;
    mutation.mutate({ phone, office });
  }

  return (
    <INNOPage
      eyebrow="Account"
      title="Profile & Settings"
      description="Your workspace profile and organization-managed sign-in."
    >
      <div className="profile-layout">
        <div className="panel-stack">
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
              <INNOStatus tone="success">{profile.status}</INNOStatus>
            </div>

            <div className="kv-grid production-kv-grid">
              <div className="kv-row"><span>Email</span><b>{profile.email}</b></div>
              <div className="kv-row"><span>Employee ID</span><b>{profile.employeeId}</b></div>
              <div className="kv-row"><span>Organization</span><b>{profile.organization?.name ?? '—'}</b></div>
              <div className="kv-row"><span>Location</span><b>{profile.location?.name ?? '—'}</b></div>
              <div className="kv-row"><span>Time zone</span><b>{profile.timeZone}</b></div>
              <div className="kv-row">
                <span>SSO</span>
                <b><INNOStatus tone="success">Connected</INNOStatus></b>
              </div>
            </div>
          </section>

          <section className="prod-panel">
            <div className="prod-panel-head">
              <div>
                <h3>Personal contact details</h3>
                <p>These two business-profile fields are self-managed in INNO.One.</p>
              </div>
              <INNOStatus tone={dirty ? 'warning' : 'success'}>{dirty ? 'Unsaved' : 'Saved'}</INNOStatus>
            </div>

            <form className="profile-edit-form" onSubmit={submit}>
              <div className="profile-edit-grid">
                <label className="field-block">
                  <span>Phone</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={64}
                    autoComplete="tel"
                    placeholder="Optional phone number"
                  />
                  <small>Visible as part of your INNO.One business profile.</small>
                </label>

                <label className="field-block">
                  <span>Office</span>
                  <input
                    value={office}
                    onChange={(event) => setOffice(event.target.value)}
                    maxLength={120}
                    placeholder="Optional office or workspace"
                  />
                  <small>Examples: HQ 4F, Remote, Branch A.</small>
                </label>
              </div>

              {mutation.isError ? (
                <div className="profile-save-error" role="alert">
                  {mutation.error instanceof Error ? mutation.error.message : 'Unable to save profile.'}
                </div>
              ) : null}

              {mutation.isSuccess && !dirty ? (
                <div className="profile-save-success" role="status">Profile saved.</div>
              ) : null}

              <div className="profile-edit-actions">
                <INNOButton
                  type="submit"
                  busy={mutation.isPending}
                  disabled={!dirty || mutation.isPending}
                >
                  Save profile
                </INNOButton>
              </div>
            </form>
          </section>
        </div>

        <section className="prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>Security & sessions</h3>
              <p>Identity and sign-in are managed by your organization.</p>
            </div>
            <INNOStatus tone="success">Healthy</INNOStatus>
          </div>
          <div className="settings-stack">
            <div className="settings-row">
              <div>
                <b>Single Sign-On</b>
                <span>Keycloak · Authorization Code + PKCE</span>
              </div>
              <INNOStatus tone="success">Connected</INNOStatus>
            </div>
            <div className="settings-row">
              <div>
                <b>Business authorization</b>
                <span>Resolved from INNO.One roles and resource scopes</span>
              </div>
              <INNOStatus>{profile.permissions.length} permissions</INNOStatus>
            </div>
          </div>
          <div className="purpose-note">
            <b>Organization-managed fields stay read only.</b>
            <span>
              Name, email, employee ID, organization, position, location, roles and sign-in state are not editable from this page.
            </span>
          </div>
          <div className="purpose-note">
            <b>Personal preferences are not exposed in this production slice.</b>
            <span>
              Notification read state is persisted. Email, desktop, density and language preferences remain unavailable until their persistence contract is defined.
            </span>
          </div>
        </section>
      </div>
    </INNOPage>
  );
}
