import { INNOButton, INNOState } from '@inno/ui';
import { ApiError } from '../api/client';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="production-loading" role="status" aria-live="polite">
      <span className="production-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
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
      title={title}
      description={
        error instanceof Error
          ? error.message
          : 'The request could not be completed.'
      }
      action={
        retry ? (
          <div className="state-action">
            <INNOButton variant="secondary" onClick={retry}>Try again</INNOButton>
          </div>
        ) : undefined
      }
    />
  );
}
