import { useEffect, useState, type FormEvent } from 'react';
import { type Locale, useI18n } from '@inno/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INNOButton,
  INNOCollection,
  INNOCollectionHeader,
  INNOEditorFooter,
  INNOEditorFooterEnd,
  INNOPage,
  INNOPurposeNote,
  INNOStatus,
  INNOTableWrap,
} from '@inno/ui';
import {
  getAdminPlatformSettings,
  updateAdminPlatformLocalization,
} from '../api/client';
import type { AdminPlatformSettingsResponse } from '../api/types';
import { ErrorState, LoadingState } from '../components/Feedback';
import { useI18n as useStep45NI18n } from '@inno/i18n';

function localeLabel(locale: Locale, t: (key: string) => string) {
  return locale === 'th-TH'
    ? t('common.language.thai')
    : t('common.language.english');
}

export function AdminPlatformSettingsPage() {
  const { t: t45n } = useStep45NI18n();
  const { t, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: getAdminPlatformSettings,
    refetchOnWindowFocus: false,
  });
  const [defaultLocale, setDefaultLocale] = useState<Locale>('en-US');

  useEffect(() => {
    if (query.data) {
      setDefaultLocale(query.data.localization.defaultLocale);
    }
  }, [query.data]);

  const localizationMutation = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error(t45n('admin.step45n.adminPlatformSettings.platformSettingsAreNotLoaded'));
      return updateAdminPlatformLocalization(
        defaultLocale,
        query.data.localization.eTag,
      );
    },
    onSuccess: (localization) => {
      queryClient.setQueryData<AdminPlatformSettingsResponse>(
        ['admin', 'platform-settings'],
        (current) => current ? { ...current, localization } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['platform', 'me'] });
    },
  });

  const localizationDirty = Boolean(
    query.data && defaultLocale !== query.data.localization.defaultLocale,
  );

  function saveLocalization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!localizationDirty || localizationMutation.isPending) return;
    localizationMutation.mutate();
  }

  return (
    <INNOPage
      eyebrow={t('admin.settings.eyebrow')}
      title={t('admin.settings.title')}
      description={t('admin.settings.description')}
      actions={(
        <INNOButton
          type="button"
          variant="secondary"
          busy={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('common.actions.refresh')}
        </INNOButton>
      )}
    >
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      {query.data ? (
        <>
          <INNOPurposeNote
            title={t('admin.settings.scope.title')}
            description={t('admin.settings.scope.description')}
          />

          <div className="platform-settings-layout">
          <section className="prod-panel platform-settings-defaults">
            <div className="prod-panel-head">
              <div>
                <h3>{t('admin.settings.defaults.title')}</h3>
                <p>{t('admin.settings.defaults.description')}</p>
              </div>
              <INNOStatus tone={localizationDirty ? 'warning' : 'success'}>
                {localizationDirty
                  ? t('common.status.unsaved')
                  : t('common.status.saved')}
              </INNOStatus>
            </div>

            <form onSubmit={saveLocalization}>
              <div className="profile-edit-grid">
                <label className="field-block">
                  <span>{t('admin.settings.language.default')}</span>
                  <select
                    value={defaultLocale}
                    onChange={(event) => setDefaultLocale(event.target.value as Locale)}
                  >
                    {query.data.localization.supportedLocales.map((locale) => (
                      <option key={locale} value={locale}>
                        {localeLabel(locale, t)}
                      </option>
                    ))}
                  </select>
                  <small>{t('admin.settings.language.help')}</small>
                </label>
              </div>

              {localizationMutation.isError ? (
                <div className="profile-save-error" role="alert">
                  {localizationMutation.error instanceof Error
                    ? localizationMutation.error.message
                    : t('feedback.error.title')}
                </div>
              ) : null}

              {localizationMutation.isSuccess && !localizationDirty ? (
                <div className="profile-save-success" role="status">
                  {t('admin.settings.language.saved')}
                </div>
              ) : null}

              <INNOEditorFooter>
                <INNOEditorFooterEnd>
                  <INNOButton
                    type="submit"
                    busy={localizationMutation.isPending}
                    disabled={!localizationDirty || localizationMutation.isPending}
                  >
                    {t('admin.settings.language.save')}
                  </INNOButton>
                </INNOEditorFooterEnd>
              </INNOEditorFooter>
            </form>
          </section>

          <section className="prod-panel platform-settings-summary">
            <div className="prod-panel-head">
              <div>
                <h3>{t('admin.settings.runtime.title')}</h3>
                <p>{t('admin.settings.runtime.description')}</p>
              </div>
              <INNOStatus>{t('admin.settings.runtime.readOnly')}</INNOStatus>
            </div>
            <div className="platform-settings-facts">
              <div>
                <span>{t('admin.settings.environment')}</span>
                <b>{query.data.environment}</b>
                <small>{t45n('admin.step45n.adminPlatformSettings.currentHostingEnvironment')}</small>
              </div>
              <div>
                <span>{t('admin.settings.groups')}</span>
                <b>{query.data.groups.length}</b>
                <small>{t45n('admin.step45n.adminPlatformSettings.effectiveSettingsGroups')}</small>
              </div>
              <div>
                <span>{t('admin.settings.settings')}</span>
                <b>{query.data.items.length}</b>
                <small>{t45n('admin.step45n.adminPlatformSettings.safeValuesExposed')}</small>
              </div>
              <div>
                <span>{t('admin.settings.mode')}</span>
                <b>{t('admin.settings.readOnly')}</b>
                <small>{query.data.configurationMode}</small>
              </div>
            </div>
          </section>
          </div>

          <INNOCollection>
            <INNOCollectionHeader
              title={t('admin.settings.effective.title')}
              description={t('admin.settings.lastChecked', {
                value: formatDateTime(query.data.checkedAt),
              })}
              meta={(
                <INNOStatus tone="success" dot>
                  {t('admin.settings.contractAligned')}
                </INNOStatus>
              )}
            />

            <INNOTableWrap width="xwide">
              <table>
                <thead>
                  <tr>
                    <th>{t('admin.settings.table.group')}</th>
                    <th>{t('admin.settings.table.setting')}</th>
                    <th>{t('admin.settings.table.value')}</th>
                    <th>{t('admin.settings.table.source')}</th>
                    <th>{t('admin.settings.table.status')}</th>
                    <th>{t('admin.settings.table.detail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.group}</td>
                      <td>
                        <b>{item.name}</b>
                        <div className="table-meta">{item.id}</div>
                      </td>
                      <td>
                        <code className="platform-setting-value">{item.value}</code>
                      </td>
                      <td>{item.source}</td>
                      <td>
                        <INNOStatus
                          tone={item.status === 'frozen' ? 'success' : 'neutral'}
                          dot
                        >
                          {item.status === 'frozen'
                            ? t('common.status.frozen')
                            : t('common.status.effective')}
                        </INNOStatus>
                      </td>
                      <td>{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </INNOTableWrap>
          </INNOCollection>
        </>
      ) : null}
    </INNOPage>
  );
}
