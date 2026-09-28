import { INNOButton, INNOState } from '@inno/ui';
import { ApiError } from '../api/client';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <INNOState
      kind="loading"
      compact
      title={label}
      description="Please wait while INNO.One loads the latest available data."
    />
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const isForbidden = error instanceof ApiError && error.status === 403;
  const isUnauthorized = error instanceof ApiError && error.status === 401;
  const title = isForbidden
    ? 'Permission denied'
    : isUnauthorized
      ? 'Sign in required'
      : 'Unable to load data';

  return (
    <INNOState
      kind={isForbidden || isUnauthorized ? 'permission' : 'error'}
      title={title}
      description={
        error instanceof Error
          ? error.message
          : 'The request could not be completed.'
      }
      action={retry ? <INNOButton variant="secondary" onClick={retry}>Try again</INNOButton> : undefined}
    />
  );
}
