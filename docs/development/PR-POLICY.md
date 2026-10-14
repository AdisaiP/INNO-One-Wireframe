# Pull Request Policy

This policy applies to changes targeting the main branch.

## Required merge path

- Changes to main must go through a pull request.
- Direct pushes to main are blocked.
- Administrators follow the same protection rules.
- The branch must be up to date with main before merge.

## Required checks

A pull request cannot merge unless both checks pass:

- CORE baseline
- Web golden path

If either check fails, fix the branch and let CI run again. Do not bypass failed checks.

## Review policy

The repository currently requires a pull request but does not require an approving review because the repository is primarily maintained by a single developer.

When another reviewer is available for a material change, request review before merge.

All review conversations must be resolved before merge.

## Merge policy

- Keep linear history.
- Use Squash and merge or Rebase and merge.
- Do not create merge commits.
- Do not force-push main.
- Do not delete main.

## Pull request scope

Prefer one coherent change per pull request.

A pull request should explain:

- what changed,
- why it changed,
- affected CORE/module boundaries,
- validation performed,
- migration/deployment impact when relevant,
- any follow-up work that remains.

## Architecture checks

Changes to product modules must continue to satisfy the INNO.One Module Development Contract.

In particular:

- no direct project reference to another product module,
- no import of another product module namespace,
- no cross-module database foreign key,
- module-owned persistence schema,
- valid module manifest and permission declarations.

## Definition of merge-ready

A pull request targeting main is merge-ready when:

- CORE baseline is green,
- Web golden path is green,
- required contract/integration tests pass,
- review conversations are resolved,
- the branch is up to date with main,
- the working tree contains no accidental generated artifacts or secrets.
