import type { ReactNode } from 'react';
import { INNOButton, INNOCollectionState, INNOState } from '@inno/ui';
import { ApiError } from '../api/client';

export function LoadingState({
  label = 'Loading content',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <INNOState
      kind="loading"
      compact={compact}
      title={label}
      description="Please wait while INNO.One loads the latest available data."
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
  return (
    <INNOState
      kind="permission"
      compact={compact}
      title="You do not have access"
      description="Your current role does not include permission to view this resource."
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
  return (
    <INNOState
      kind="disabled"
      compact={compact}
      title="Module is not available"
      description="An administrator must enable this module before it can be used."
      action={action}
    />
  );
}

export function CollectionLoadingState({ label = 'Loading content' }: { label?: string }) {
  return (
    <INNOCollectionState
      kind="loading"
      title={label}
      description="Please wait while INNO.One loads the latest available data."
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
  const isForbidden = error instanceof ApiError && error.status === 403;
  const isUnauthorized = error instanceof ApiError && error.status === 401;

  return (
    <INNOCollectionState
      kind={isForbidden ? 'permission' : 'error'}
      title={isForbidden ? 'You do not have access' : isUnauthorized ? 'Sign in required' : 'Unable to load content'}
      description={isForbidden
        ? 'Your current role does not include permission to view this collection.'
        : isUnauthorized
          ? 'Your current session cannot complete this request. Sign in again, then retry.'
          : 'INNO.One could not load this collection. Try again when the service is available.'}
      action={retry && !isForbidden ? <INNOButton variant="secondary" onClick={retry}>Try again</INNOButton> : undefined}
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
  const isForbidden = error instanceof ApiError && error.status === 403;
  const isUnauthorized = error instanceof ApiError && error.status === 401;

  if (isForbidden) {
    return <PermissionState compact={compact} />;
  }

  return (
    <INNOState
      kind="error"
      compact={compact}
      title={isUnauthorized ? 'Sign in required' : 'Unable to load content'}
      description={isUnauthorized
        ? 'Your current session cannot complete this request. Sign in again, then retry.'
        : 'INNO.One could not load this content. Try again when the service is available.'}
      action={retry ? <INNOButton variant="secondary" onClick={retry}>Try again</INNOButton> : undefined}
    />
  );
}
