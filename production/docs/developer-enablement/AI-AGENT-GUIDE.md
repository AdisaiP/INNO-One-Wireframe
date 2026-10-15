# AI Coding Agent Guide

Use this when ChatGPT, Codex, Cursor, or another coding agent changes INNO.One.

## Source of truth

Repository code and current contracts are authoritative. The agent must inspect the current branch and relevant files before editing.

## Required pre-flight

Identify owning module, target surface, relevant frozen contracts, permission/scope, data ownership, cross-module integration method, required tests, and current working-tree state.

## Never do silently

An agent must not:

- add a product-module ProjectReference to another product module,
- import another product module namespace,
- query another module schema directly,
- create cross-schema foreign keys,
- bypass server-side permission/scope evaluation,
- expose secrets in health/log/audit payloads,
- invent a new UI component system when `@inno/ui` or a shared pattern exists,
- add a microservice without deployment/runtime justification,
- weaken architecture tests to make a feature pass,
- merge directly to `main` unless explicitly authorized.

## Preferred flow

```text
Inspect repo
  -> read contracts
  -> identify owner/boundary
  -> create focused branch
  -> implement
  -> add/update tests
  -> run check + contract tests
  -> review diff
  -> push
  -> PR
```

## Architecture escalation

If a feature cannot be implemented without breaking a boundary: propose the architecture change, update contracts/tests, review impact, then implement.

## Skill recommendation

A reusable AI Skill named `inno-one-module-development` can automate this checklist. The Skill is a workflow layer; repository documentation remains the source of truth.
