import { INNOPage, INNOState } from '@inno/ui';

export function DeferredPage({ name }: { name: string }) {
  return (
    <INNOPage eyebrow="Production implementation" title={name}>
      <INNOState
        title="Not in the current vertical slice"
        description="This route boundary is reserved by the production skeleton and is not exposed in normal navigation until its frozen UI job is implemented."
      />
    </INNOPage>
  );
}
