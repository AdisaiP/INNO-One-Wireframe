import { INNOPage, INNOState, type INNOStateKind } from '@inno/ui';

export function DeferredPage({
  name,
  kind = 'disabled',
}: {
  name: string;
  kind?: Extract<INNOStateKind, 'permission' | 'disabled' | 'no-results'>;
}) {
  const copy = kind === 'permission'
    ? {
        eyebrow: 'Access',
        title: 'Permission denied',
        description: 'Your account does not have permission to open this route.',
      }
    : kind === 'no-results'
      ? {
          eyebrow: 'Navigation',
          title: 'Page not found',
          description: 'The requested route does not exist in the current INNO.One production surface.',
        }
      : {
          eyebrow: 'Production implementation',
          title: 'Module not available yet',
          description: 'This route boundary is reserved by the production skeleton and stays out of normal navigation until its frozen UI job and runtime contract are implemented.',
        };

  return (
    <INNOPage eyebrow={copy.eyebrow} title={name}>
      <INNOState kind={kind} title={copy.title} description={copy.description} />
    </INNOPage>
  );
}
