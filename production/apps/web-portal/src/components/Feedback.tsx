import type { ReactNode } from 'react';
import { useI18n } from '@inno/i18n';
import { INNOButton, INNOCollectionState, INNOState } from '@inno/ui';
import { ApiError } from '../api/client';

export function LoadingState({
  label,
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <INNOState
      kind="loading"
      compact={compact}
      title={label ?? t('feedback.loading.title')}
      description={t('feedback.loading.description')}
    />
  );
}

export function PermissionState({
  action,
  compact = false,
}: {
  action?: ReactNode;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <INNOState
      kind="permission"
      compact={compact}
      title={t('feedback.permission.title')}
      description={t('feedback.permission.description')}
      action={action}
    />
  );
}

export function ModuleDisabledState({
  action,
  compact = false,
}: {
  action?: ReactNode;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <INNOState
      kind="disabled"
      compact={compact}
      title={t('feedback.moduleDisabled.title')}
      description={t('feedback.moduleDisabled.description')}
      action={action}
    />
  );
}

export function CollectionLoadingState({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <INNOCollectionState
      kind="loading"
      title={label ?? t('feedback.loading.title')}
      description={t('feedback.loading.description')}
    />
  );
}

export function CollectionErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { t } = useI18n();
  const isForbidden = error instanceof ApiError && error.status === 403;
  const isUnauthorized = error instanceof ApiError && error.status === 401;

  return (
    <INNOCollectionState
      kind={isForbidden ? 'permission' : 'error'}
      title={isForbidden
        ? t('feedback.permission.title')
        : isUnauthorized
          ? t('feedback.signIn.title')
          : t('feedback.error.title')}
      description={isForbidden
        ? t('feedback.permission.collectionDescription')
        : isUnauthorized
          ? t('feedback.signIn.description')
          : t('feedback.error.collectionDescription')}
      action={retry && !isForbidden ? (
        <INNOButton variant="secondary" onClick={retry}>
          {t('common.actions.retry')}
        </INNOButton>
      ) : undefined}
    />
  );
}

export function ErrorState({
  error,
  retry,
  compact = false,
}: {
  error: unknown;
  retry?: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const isForbidden = error instanceof ApiError && error.status === 403;
  const isUnauthorized = error instanceof ApiError && error.status === 401;

  if (isForbidden) {
    return <PermissionState compact={compact} />;
  }

  return (
    <INNOState
      kind="error"
      compact={compact}
      title={isUnauthorized ? t('feedback.signIn.title') : t('feedback.error.title')}
      description={isUnauthorized
        ? t('feedback.signIn.description')
        : t('feedback.error.description')}
      action={retry ? (
        <INNOButton variant="secondary" onClick={retry}>
          {t('common.actions.retry')}
        </INNOButton>
      ) : undefined}
    />
  );
}
