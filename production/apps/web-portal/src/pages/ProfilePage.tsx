import { useState, type FormEvent } from 'react';
import { type Locale, useI18n } from '@inno/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton,
  INNOEditorFooter,
  INNOEditorFooterEnd,
  INNOEditorFooterStart,
  INNOPage,
  INNOPurposeNote,
  INNOStatus,
} from '@inno/ui';
import { updateCurrentProfile } from '../api/client';
import { useProfile } from '../app/ProfileContext';

function valueOrDash(value?: string | null) {
  return value?.trim() ? value : '—';
}

function localeLabel(locale: Locale, t: (key: string) => string) {
  return locale === 'th-TH'
    ? t('common.language.thai')
    : t('common.language.english');
}

type LanguageSelection = Locale | 'organization';

export function ProfilePage() {
  const profile = useProfile();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const roleSummary = profile.roles.join(', ') || t('common.user');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [office, setOffice] = useState(profile.office ?? '');
  const [selectedLocale, setSelectedLocale] = useState<LanguageSelection>(
    profile.preferredLocale ?? 'organization',
  );

  const mutation = useMutation({
    mutationFn: updateCurrentProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['platform', 'me'], updated);
      setPhone(updated.phone ?? '');
      setOffice(updated.office ?? '');
      setSelectedLocale(updated.preferredLocale ?? 'organization');
    },
  });

  const currentLanguageSelection: LanguageSelection = profile.preferredLocale ?? 'organization';
  const localeDirty = selectedLocale !== currentLanguageSelection;
  const dirty = phone !== (profile.phone ?? '')
    || office !== (profile.office ?? '')
    || localeDirty;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || mutation.isPending) return;
    mutation.mutate({
      phone,
      office,
      ...(localeDirty && selectedLocale === 'organization'
        ? { useOrganizationDefault: true }
        : {}),
      ...(localeDirty && selectedLocale !== 'organization'
        ? { preferredLocale: selectedLocale }
        : {}),
    });
  }

  function discardChanges() {
    setPhone(profile.phone ?? '');
    setOffice(profile.office ?? '');
    setSelectedLocale(profile.preferredLocale ?? 'organization');
  }

  return (
    <INNOPage
      eyebrow={t('profile.eyebrow')}
      title={t('profile.title')}
      description={t('profile.description')}
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
                  {profile.position?.name ?? t('common.employee')}
                  <span>·</span>
                  {roleSummary}
                </div>
              </div>
              <INNOStatus tone="success">{profile.status}</INNOStatus>
            </div>

            <div className="kv-grid production-kv-grid">
              <div className="kv-row"><span>{t('profile.email')}</span><b>{profile.email}</b></div>
              <div className="kv-row"><span>{t('profile.employeeId')}</span><b>{profile.employeeId}</b></div>
              <div className="kv-row"><span>{t('profile.organization')}</span><b>{valueOrDash(profile.organization?.name)}</b></div>
              <div className="kv-row"><span>{t('profile.location')}</span><b>{valueOrDash(profile.location?.name)}</b></div>
              <div className="kv-row"><span>{t('profile.timeZone')}</span><b>{profile.timeZone}</b></div>
              <div className="kv-row">
                <span>{t('profile.sso')}</span>
                <b><INNOStatus tone="success">{t('common.status.connected')}</INNOStatus></b>
              </div>
            </div>
          </section>

          <section className="prod-panel">
            <div className="prod-panel-head">
              <div>
                <h3>{t('profile.contact.title')}</h3>
                <p>{t('profile.contact.description')}</p>
              </div>
              <INNOStatus tone={dirty ? 'warning' : 'success'}>
                {dirty ? t('common.status.unsaved') : t('common.status.saved')}
              </INNOStatus>
            </div>

            <form className="profile-edit-form" onSubmit={submit}>
              <div className="profile-edit-grid">
                <label className="field-block">
                  <span>{t('profile.phone')}</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={64}
                    autoComplete="tel"
                    placeholder={t('profile.phone.placeholder')}
                  />
                  <small>{t('profile.phone.help')}</small>
                </label>

                <label className="field-block">
                  <span>{t('profile.office')}</span>
                  <input
                    value={office}
                    onChange={(event) => setOffice(event.target.value)}
                    maxLength={120}
                    placeholder={t('profile.office.placeholder')}
                  />
                  <small>{t('profile.office.help')}</small>
                </label>

                <label className="field-block">
                  <span>{t('profile.language')}</span>
                  <select
                    value={selectedLocale}
                    onChange={(event) => setSelectedLocale(event.target.value as LanguageSelection)}
                  >
                    <option value="organization">
                      {t('profile.language.default', {
                        locale: localeLabel(profile.organizationDefaultLocale, t),
                      })}
                    </option>
                    {profile.supportedLocales.map((locale) => (
                      <option key={locale} value={locale}>
                        {localeLabel(locale, t)}
                      </option>
                    ))}
                  </select>
                  <small>{t('profile.language.help')}</small>
                </label>
              </div>

              {mutation.isError ? (
                <div className="profile-save-error" role="alert">
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : t('profile.saveError')}
                </div>
              ) : null}

              {mutation.isSuccess && !dirty ? (
                <div className="profile-save-success" role="status">
                  {t('profile.saved')}
                </div>
              ) : null}

              <INNOEditorFooter>
                <INNOEditorFooterStart>
                  {dirty ? (
                    <INNOButton
                      type="button"
                      variant="secondary"
                      disabled={mutation.isPending}
                      onClick={discardChanges}
                    >
                      {t('common.actions.discard')}
                    </INNOButton>
                  ) : null}
                </INNOEditorFooterStart>
                <INNOEditorFooterEnd>
                  <INNOButton
                    type="submit"
                    busy={mutation.isPending}
                    disabled={!dirty || mutation.isPending}
                  >
                    {t('profile.save')}
                  </INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            </form>
          </section>
        </div>

        <section className="prod-panel">
          <div className="prod-panel-head">
            <div>
              <h3>{t('profile.security.title')}</h3>
              <p>{t('profile.security.description')}</p>
            </div>
            <INNOStatus tone="success">{t('common.status.healthy')}</INNOStatus>
          </div>
          <div className="settings-stack">
            <div className="settings-row">
              <div>
                <b>{t('profile.security.sso')}</b>
                <span>{t('profile.security.ssoDetail')}</span>
              </div>
              <INNOStatus tone="success">{t('common.status.connected')}</INNOStatus>
            </div>
            <div className="settings-row">
              <div>
                <b>{t('profile.security.authorization')}</b>
                <span>{t('profile.security.authorizationDetail')}</span>
              </div>
              <INNOStatus>{t('profile.security.permissions', { count: profile.permissions.length })}</INNOStatus>
            </div>
          </div>
          <INNOPurposeNote
            title={t('profile.managed.title')}
            description={t('profile.managed.description')}
          />
        </section>
      </div>
    </INNOPage>
  );
}
