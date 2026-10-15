# Module Integration Guide

Modules share contracts, not persistence.

## 1. Contract / Reader / Provider

Use when a module needs current information synchronously.

Example:

```text
Helpdesk -> IDeviceReader -> Devices-owned implementation
```

The consumer depends on the approved contract, not the Devices project or schema.

## 2. Stable identifier

Store an opaque/stable identifier for a resource owned by another module.

```text
Ticket.DeviceId = "dev_12345"
```

Do not store another module's domain entity.

## 3. Event

Use when another module can react asynchronously.

Examples: `device.offline`, `ticket.resolved`, `asset.changed`.

Event rules: owner-defined, stable/versionable name and payload, minimal payload, no persistence entities, documented idempotency/retry where side effects matter.

## 4. Read model

Use for dashboards, reports, and aggregate views spanning modules. Prefer projections fed from approved contracts/events over cross-schema joins.

## Decision rule

- Fresh synchronous data -> reader/provider contract.
- Relationship only -> stable ID.
- Asynchronous reaction -> event.
- Aggregate/reporting projection -> read model.

## Prohibited shortcuts

Never add a product-module ProjectReference to another product module, import another module namespace, query another schema directly, create cross-schema foreign keys, or expose persistence entities as shared contracts.

## Changing a shared contract

Document the capability, update the contract, review consumers, adjust architecture/contract tests, then implement producers and consumers.
