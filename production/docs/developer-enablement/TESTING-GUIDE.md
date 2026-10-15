# Testing Guide

## Principle

Test the important boundary at the lowest useful level, then add higher-level coverage for critical journeys.

## Unit tests

Business rules, value objects, deterministic state transitions, mapping/formatting, and isolated validation.

## Integration tests

DbContext/migrations, API host behavior, authorization/scope, audit/events, persistence concurrency, and realistic adapters.

## Contract tests

Module manifest validity, project-reference boundaries, namespace boundaries, schema ownership, no cross-schema foreign keys, and deployment/configuration invariants.

## E2E tests

Critical browser/auth/API journeys such as:

```text
Sign in -> Workspace -> Module -> critical business action
```

Do not replace all integration tests with E2E.

## Standard validation

From `production/`:

```bash
corepack pnpm run check
```

Also run relevant module tests and `git diff --check`.

## Required CI baseline

Protected `main` requires:

- `CORE baseline`
- `Web golden path`

## Failure rule

Do not weaken/delete an architecture test merely to make a feature pass. If architecture genuinely changes, update the documented contract and tests deliberately.
