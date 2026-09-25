# INNO.One — Interaction & Feedback Contract

**Status:** UX/UI final polish — Step 4  
**Date:** 2026-09-25  
**UI Contract:** 1.16.0  
**Documentation:** Design System V1.22  
**Scope:** 87 canonical pages  
**Backend:** Not in scope

## 1. Goal

Every user action must answer three questions consistently:

1. Did the system accept the action?
2. Is work still in progress?
3. What should the user do next if it failed?

The prototype must not mix browser-native dialogs, silent state changes, arbitrary toast intent, and inconsistent save behavior.

## 2. Feedback levels

### Inline state

Use inline state when feedback belongs to the edited resource or field.

Examples:
- field validation,
- Unsaved changes,
- Saving…,
- Saved,
- Save failed,
- job status,
- partial failure.

### Toast

Use toast for short-lived confirmation that does not require a decision.

Types:
- `success` — command completed or queued successfully,
- `info` — mode changed, panel/tool opened, selection changed,
- `warning` — attention required but no blocking failure,
- `error` — operation failed or validation blocked submission.

Rules:
- one concise sentence,
- describe the result, not the button,
- no generic “Done”,
- error toasts use assertive announcement,
- success/info/warning use polite announcement.

### Confirmation dialog

Use a confirmation dialog only when the action can:
- delete/remove data,
- interrupt a user/session/process,
- shut down/restart/disconnect a resource,
- make a high-impact operational change.

Do not confirm ordinary Save/Create/Apply actions.

## 3. Confirmation severity

### Warning

Use `data-inno-variant="warning"` for interruptive but reversible/expected operations.

Examples:
- restart service,
- stop process/service,
- disconnect remote session,
- restart device,
- Wake-on-LAN request.

### Danger

Use `data-inno-variant="danger"` when the action is destructive or makes a resource unavailable.

Examples:
- delete,
- remove from management,
- shut down endpoint.

Every `data-inno-confirm` action must declare:
- title,
- description,
- confirm label,
- variant,
- success feedback.

## 4. Save / submit behavior

Canonical save controls use `data-inno-save`.

Required metadata:
- `data-inno-saving-label`,
- `data-inno-saved-label`,
- `data-inno-success`.

Runtime states:

```
Idle
  ↓ click
Saving…  [disabled, aria-busy=true]
  ├─ success → Saved → Idle
  └─ error   → Try again → Idle
```

Rules:
- prevent double-submit while saving,
- keep button width visually stable where practical,
- expose `aria-busy=true` while processing,
- clear dirty state only after success,
- preserve dirty state on failure,
- navigation after create happens only after success.

## 5. Validation

Required fields validate before a save simulation begins.

Invalid field behavior:
- `aria-invalid=true`,
- owning field receives invalid styling,
- visible error appears directly below the field,
- error uses `role=alert`,
- control receives `aria-describedby` pointing to the error,
- first invalid control receives focus,
- one error toast summarizes the blocked submission.

Canonical summary:
- title: `Validation error`
- message: `Check the highlighted fields and try again.`

Do not show one toast per invalid field.

## 6. Dialog / drawer behavior

Dialogs and drawers:
- expose dialog semantics,
- restore focus to the trigger when closed,
- close on Escape,
- modal dialogs trap Tab focus,
- generated filter drawers have a labelled close button,
- backdrop click may close non-destructive editors where appropriate.

Unsaved editor cancellation/navigation:
- intercept leaving the dirty scope,
- show `Discard unsaved changes?`,
- keep editing on Cancel,
- clear dirty state only after confirmed discard.

## 7. Menu and row actions

Row/menu actions:
- open from the same menu pattern,
- return focus to the trigger on Escape,
- destructive menu items use Danger styling and confirmation,
- non-destructive commands return result feedback through toast or navigation.

Menus must not trigger browser-native confirm dialogs.

## 8. Search / filters

Search:
- Escape clears a non-empty search and returns an Info toast: `Search cleared`.

Filters:
- Apply closes the drawer and reports the number of active filters,
- Reset restores default selections and reports `Filters reset`,
- zero active filters reports `Showing all results`.

## 9. Retry / partial failure

Partial completion preserves successful work.

Retry:
- retries only failed items,
- button shows `Retrying...`,
- success reports `Failed items were retried`,
- resolved retry control becomes unavailable after success.

## 10. Forbidden patterns

Do not use:
- `window.alert()`,
- browser-native `confirm()`,
- browser-native `prompt()`,
- silent destructive actions,
- Save buttons without progress/success metadata,
- confirmation controls without explicit severity,
- unassociated field-error text,
- duplicate submits while a command is already processing.

## 11. Regression gates

### `interaction-feedback-audit.py`

Fails on:
- native browser dialogs,
- incomplete confirmation metadata,
- invalid confirm severity,
- incomplete save-state metadata,
- missing validation semantics,
- missing save `aria-busy` behavior,
- missing duplicate-submit guard.

### Browser regression

Rendered QA verifies:
- save enters busy/disabled state,
- save completes and returns to idle,
- warning confirmation uses normal primary confirm button,
- danger confirmation uses Danger confirm button,
- validation focuses and associates the invalid field,
- Escape closes confirmation and restores focus,
- existing route/input/accessibility/language regressions remain green.

## 12. Step 4 baseline

As of 2026-09-25:

- canonical pages: **87**
- confirmation actions: **12**
- save actions: **25**
- native browser dialogs: **0**
- interaction-feedback audit issues: **0**

This contract covers prototype interaction consistency only. Backend network timing, server errors, optimistic concurrency, and production retry policies remain future implementation concerns.
