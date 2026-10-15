# INNO.One Developer Enablement Kit

This folder is the onboarding entry point for engineers who extend INNO.One.

## Read in this order

1. [DEVELOPER-HANDBOOK.md](DEVELOPER-HANDBOOK.md)
2. [TECH-STACK.md](TECH-STACK.md)
3. [PLATFORM-ARCHITECTURE.md](PLATFORM-ARCHITECTURE.md)
4. [DEVELOPMENT-WORKFLOW.md](DEVELOPMENT-WORKFLOW.md)
5. [BACKEND-GUIDE.md](BACKEND-GUIDE.md) or [FRONTEND-GUIDE.md](FRONTEND-GUIDE.md)
6. [MODULE-INTEGRATION-GUIDE.md](MODULE-INTEGRATION-GUIDE.md)
7. [UX-UI-DEVELOPMENT-GUIDE.md](UX-UI-DEVELOPMENT-GUIDE.md)
8. [TESTING-GUIDE.md](TESTING-GUIDE.md)
9. [NEW-MODULE-CHECKLIST.md](NEW-MODULE-CHECKLIST.md)
10. [TEAM-SKILLS-MATRIX.md](TEAM-SKILLS-MATRIX.md)
11. [AI-AGENT-GUIDE.md](AI-AGENT-GUIDE.md) when using ChatGPT, Codex, Cursor, or another coding agent.

## Source of truth

The repository is the source of truth. If this kit conflicts with current code or a frozen contract, follow the current repository and update this kit in the same PR.

Important existing contracts:

- `../architecture/MODULE-DEVELOPMENT-CONTRACT.md`
- `../contracts/INNO-One-Implementation-Architecture-Contract.md`
- `../contracts/INNO-One-Data-Ownership-Database-Contract.md`
- `../contracts/INNO-One-Permission-Scope-Contract.md`
- `../contracts/INNO-One-API-Contract.md`
- `../contracts/INNO-One-Event-Audit-Contract.md`
- `../ux/INNO-One-Design-System-V1-Frozen.md`
- `../ux/INNO-One-Surface-Boundaries.md`

## Golden rule

A product module owns its domain and data. Cross-module collaboration must use approved contracts, stable identifiers, providers/readers, events, or read models. Never create hidden coupling through direct project references, namespace imports, or cross-schema foreign keys.
