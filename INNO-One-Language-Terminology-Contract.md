# INNO.One — Language & Terminology Contract

> [!IMPORTANT]
> **Current Production runtime override — Step 45E (2026-10-04)**
>
> INNO.One Production is bilingual at runtime. Supported locales are `en-US` and `th-TH` across Web Portal, Endpoint Agent and Android Mobile as each surface is migrated. Locale resolution is: explicit user preference -> organization/platform default -> browser/device locale -> `en-US` fallback. UI translation keys are stable identifiers; API fields, enum/status codes, permissions, event names and audit action codes remain language-neutral. User-authored business content is preserved as entered and is never silently translated.
>
> The historical fixed-language rules below remain the regression baseline for the frozen HTML prototype only. They no longer define the language ownership of Production React. `language-terminology-audit.py` continues to protect that frozen prototype. Production bilingual behavior is guarded by `step45e-bilingual-foundation-audit.py` and runtime/browser QA.
>
> Profile & Settings owns the personal language preference. Admin Center -> Platform Settings owns the organization/platform default. A user may explicitly return to the organization default. The active runtime locale must update `document.documentElement.lang`, preserve route/resource context, and must not alter authorization.
>
> **Step45L Agent runtime override — 2026-10-05:** Endpoint Agent now implements the same `en-US` / `th-TH` preference model in its real React runtime. Request Help, ownership confirmation, remote-consent state, offline/error state and Agent prompt chrome are bilingual. Prompt/business content remains explicitly bilingual or user-authored; permissions, statuses, event names and audit codes remain language-neutral. Endpoint Agent remains a separate native/client surface and is not added to Web Portal navigation.

**Status:** Historical prototype baseline — UX/UI final polish Step 3; superseded for Production runtime by Step 45E
**Date:** 2026-09-25
**UI Contract:** 1.15.0
**Documentation:** Design System V1.21
**Scope:** 97 canonical pages
**Backend:** Not in scope

## 1. Language ownership

INNO.One uses surface-specific language ownership rather than mixing languages inside one UI.

### Web Portal
- Primary UI language: **English**
- `<html lang="en">`
- Includes Workspace, Devices, Assets, Reports, Helpdesk, Meeting and Admin Center.

### Design System
- Primary UI language: **English**
- `<html lang="en">`

### Endpoint Agent
- Primary UI language: **Thai**
- `<html lang="th">`
- End-user prompts and ownership confirmation remain Thai.

### Android Assets Mobile
- Primary UI language: **Thai**
- `<html lang="th">`

This is a surface contract, not a claim that every business record must be English.

## 2. Localized business/sample content

English product pages may display Thai business content such as:
- ticket conversation,
- meeting transcript,
- meeting summary,
- knowledge-base article,
- localized notification template,
- localized remote-consent message,
- localized restart notification.

That content must declare its language explicitly with `lang="th"` on the nearest owning element.

Example:

```html
<div class="thread-body" lang="th">...</div>
```

Do not change the entire page to Thai just because one record contains Thai content.

## 3. UI chrome rule

Navigation, headings, helper text, field labels, buttons, state labels and configuration descriptions on the Web Portal are English.

Do not mix Thai and English in the same helper sentence.

Bad:
- `จัดการ Ticket lifecycle โดยแยก Status list...`

Good:
- `Manage the ticket lifecycle with status definitions and transition rules separated from other configuration.`

## 4. Canonical navigation terminology

### Workspace
- Home
- Apps
- Continue Working
- Needs Attention
- Recent
- Notifications
- Profile & Settings

### Devices
- Overview
- Devices
- Discovery
- Device Groups
- Remote Operations
- Remote Consent
- Inventory Query
- Deployment Jobs
- Agent Maintenance
- Policies
- Alerts
- Reports

### Assets
- Overview
- Asset Inventory
- Software Licenses
- Contracts & Warranty
- QR Labels
- Ownership & Users
- Reports

### Helpdesk
- Overview
- Tickets
- Assigned to Me
- Team Queue
- SLA & Escalation
- Knowledge Base
- Configuration
- Notifications
- Reports

### Meeting
- Overview
- Upcoming
- Record / Upload
- My Meetings
- Reports

### Admin Center
- Overview
- Roles & Permissions
- Access Scopes
- Apps & Modules
- Design System

## 5. Canonical product nouns

### App vs Module

**App**
- user-facing product experience visible in the launcher.

**Module**
- installable/enableable product package and technical contract.

Use **Apps & Modules** for the administration surface because it manages both concepts.

Do not label the same Admin route only as `Modules` on some pages and `Apps & Modules` on others.

### Device
Managed endpoint represented by INNO.One.

### Agent
Endpoint software installed on a Device.

Do not use Agent as a synonym for Device.

### User
Platform person/account.

### Requester
The User who initiated a Helpdesk Ticket.

### Policy
A reusable configuration/default behavior.

### Rule
A conditional decision or detection definition.

### Job
A queued/running long-lived operation.

### History
Chronological completed/past events.

## 6. Canonical action vocabulary

Prefer:
- Create
- Add
- Save
- Cancel
- Edit
- Delete
- Apply
- Assign
- Reassign
- Resolve
- Retry
- Acknowledge
- Upload
- Download
- Export
- Schedule
- Start
- Stop

Use a task-specific noun where useful:
- Save Policy
- Save Rule
- Create Ticket
- Schedule Restart

Do not alternate between synonyms for the same action inside one workflow.

## 7. Canonical spelling and casing

Use:
- Email — not E-mail
- Wi-Fi — not WiFi
- Sign in — not Log in
- QR code in descriptive prose
- QR Labels for the Assets navigation feature
- Device ID
- Asset ID
- Endpoint Agent
- Admin Center
- Design System

Existing branded/vendor terms keep their official spelling.

## 8. Page heading vs navigation label

A page heading may be more specific than its navigation label when the hierarchy remains clear.

Allowed examples:
- navigation `Overview` → heading `Fleet Overview`
- navigation `Devices` → heading `All Devices`
- navigation `Overview` → heading `Service Desk`
- navigation `Overview` → heading `Meeting Workspace`
- navigation `Reports` → heading `Reporting Center`

This is not a terminology mismatch because the navigation noun still identifies the correct destination.

## 9. Query-state navigation

A single canonical route may expose different labels for true filter/view states.

Allowed:
- Apps → All Apps / Pinned / Recently Used / Available Modules
- Reports → Hardware / Software / Assets

The route remains canonical; the label describes the active filtered view.

## 10. Regression gates

### `language-terminology-audit.py`

Fails when:
- a Web page or Design System page is not `lang=en`,
- Endpoint Agent or Mobile is not `lang=th`,
- Thai content exists on an English page without a nested `lang=th`,
- Helpdesk root navigation uses `Home` instead of `Overview`,
- `modules.html` uses a sidebar label other than `Apps & Modules`,
- `profile.html` uses a sidebar label other than `Profile & Settings`,
- forbidden spelling variants reappear.

### `qa-ux-input-browser.py`

Rendered-DOM route QA additionally checks:
- document language,
- visible unscoped Thai text,
- canonical sidebar labels after JavaScript initialization.

## 11. Step 3 baseline

As of 2026-09-26:

- Web routes: **93**
- English Web + Design System surfaces: **94 / 94**
- Thai Agent/Mobile surfaces: **3 / 3**
- unscoped Thai fragments on English surfaces: **0**
- terminology mismatches: **0**
- browser UX regression: **114 / 114 checks**
- all 93 Web routes pass at 1366 / 1024 / 768

## 12. Out of scope

Step 3 does not:
- translate business records into English,
- remove multilingual content support,
- define backend localization storage,
- add a runtime language switcher,
- begin backend implementation.

Localized content remains valid when its language is declared explicitly.
