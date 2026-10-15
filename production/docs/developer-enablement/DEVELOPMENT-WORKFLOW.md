# Development Workflow

## 1. Start from current main

```bash
git switch main
git pull --ff-only
git status
```

## 2. Create a focused branch

Examples: `feat/devices-remote-consent`, `feat/assets-license-management`, `feat/helpdesk-sla-escalation`.

Do not develop directly on protected `main`.

## 3. Read contracts before code

Read this kit, `../architecture/MODULE-DEVELOPMENT-CONTRACT.md`, relevant permission/data/API/event contracts, UX contracts for user-facing work, and current module tests.

## 4. Define the change

Document owner module, primary user job, surface, permissions/scope, data owner, cross-module dependency, audit/events, and acceptance evidence.

## 5. Implement inside the owner boundary

Avoid opportunistic edits in other modules. Make shared-contract changes explicit.

## 6. Validate

```bash
corepack pnpm run check
git diff --check
```

For UX changes, inspect affected states and responsive behavior.

## 7. Commit and push

Keep commits coherent. Do not mix unrelated cleanup with a feature.

## 8. PR requirements

Explain what changed, why the module owns it, contract changes, schema/migration impact, permissions/scope, audit/events, tests, and screenshots for meaningful UI changes.

## 9. Merge only with green checks

Do not bypass protected CORE checks.

## 10. Keep docs current

If implementation changes an architectural rule, update the relevant contract/guide in the same PR.
