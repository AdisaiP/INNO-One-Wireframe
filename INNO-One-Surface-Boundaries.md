# INNO.One — Surface Boundaries

Last updated: 2026-09-24

## 1. Why this document exists

INNO.One has multiple user surfaces that share identity, permissions and data, but they are not the same application shell.

The primary rule is:

> Share contracts, not navigation.

A Web Portal screen should not become the place where an Endpoint Agent or Android feature is rendered merely because the TOR mentions that feature.

## 2. Canonical surface model

```text
                         INNO.One Platform
                               │
             ┌─────────────────┼──────────────────┐
             │                 │                  │
        Web Portal        Endpoint Agent       Mobile App
             │                 │                  │
 Workspace / Apps       Managed endpoint      Android Asset
 Devices / Assets       user interactions       Scanner
 Helpdesk / Meeting           │                  │
 Reports / Admin              │                  │
             └─────────────────┼──────────────────┘
                               │
                     Shared Platform APIs
              Identity / RBAC / Events / Audit
```

## 3. Web Portal boundary

Web Portal owns:
- Workspace and App Launcher.
- Devices administration and operations.
- Assets administration.
- Helpdesk operator console.
- Meeting web workspace.
- Reports.
- Admin Center.
- Policy/configuration screens for other surfaces.

Web Portal may contain a **preview** of an Agent/Mobile experience when that preview helps an administrator configure a policy, but the preview must be clearly labeled as a preview.

Examples:
- Remote Consent policy can preview the prompt that an Endpoint Agent will show.
- QR Labels can state that labels are compatible with the Android scanner.

Web Portal must not:
- expose Android Scanner as a normal Assets navigation route,
- expose Endpoint Request Help as a Helpdesk operator navigation item,
- embed the real endpoint ownership form as an Assets-admin form.

## 4. Endpoint Agent boundary

Endpoint Agent owns user-facing interactions that happen on the managed computer.

### TOR 7.12
The user/ownership confirmation form belongs to the Endpoint Agent. Step45L Production renders the Agent interaction in Thai or English from the shared runtime locale model; the historical TOR/prototype wording remains Thai-first.

Agent flow:
```text
Agent
  ↓
Ownership / User Confirmation
  ↓
Thai / English runtime form
  ↓
Submit user + ownership state
  ↓
Assets API
```

Web Assets owns:
- user profile administration,
- custom-field administration,
- ownership assignment/history,
- received submission status.

### TOR 10.1
Request Help from the managed endpoint belongs to Endpoint Agent.

Agent flow:
```text
Agent
  ↓
Request Help
  ↓
Subject / Category / Urgency / Description
  ↓
Attach endpoint context
  ↓
Helpdesk API
  ↓
Ticket ID / status
```

Web Helpdesk owns:
- central Create Ticket,
- ticket queue,
- assignment,
- SLA,
- resolution,
- reporting and configuration.

### TOR 4.7
The real user consent prompt belongs to Endpoint Agent.

Web Devices owns:
- consent policy,
- editable prompt text,
- bypass rules,
- preview,
- audit view.

Agent owns:
- displaying prompt,
- approve/decline action,
- terminating/indicating the live remote session.

## 5. Mobile App boundary

### TOR 7.13
Android Mobile owns:
- camera permission,
- QR scanning,
- token validation result,
- mobile Hardware/Software view,
- scan history if product requires it.

Web Assets owns:
- select assets,
- generate QR labels,
- label settings,
- print,
- label/token administration.

Correct integration:

```text
Web Assets
  Select Assets
      ↓
  Generate QR Token
      ↓
  Print Label
      │
      │ physical label
      ▼
Android Assets Mobile
  Scan QR
      ↓
Authenticated Asset Lookup
      ↓
Hardware / Software
```

The Web QR page may display a short integration note. It should not contain the Android app's operational UI.

## 6. Shared contracts across surfaces

All surfaces may share:
- Keycloak / SSO identity.
- RBAC and resource scopes.
- module/application permissions.
- API conventions.
- event naming.
- audit event format.
- design tokens.
- icon vocabulary where appropriate.
- error/status semantics.

Surface-specific shells remain separate.

## 7. Prototype file ownership

| File | Surface | Web navigation? |
| --- | --- | --- |
| `asset-qr.html` | Web Assets | Yes |
| `asset-mobile.html` | Android Mobile prototype | No |
| `asset-ownership.html` | Web Assets | Yes |
| `agent-ownership-confirmation.html` | Endpoint Agent prototype | No |
| `helpdesk.html` / `ticket-new.html` | Web Helpdesk | Yes |
| `helpdesk-agent-request.html` | Endpoint Agent prototype | No |
| `remote-consent.html` | Web Devices policy/config | Yes |
| Endpoint consent dialog | Endpoint Agent runtime | No Web route |

## 8. Navigation rules

1. `inno-navigation.js` only owns Web Portal routes.
2. Agent pages do not load `platform-shell.js` or Web sidebar navigation.
3. Mobile pages do not load `platform-shell.js` or Web sidebar navigation.
4. App Launcher lists Web apps/modules, not secondary Agent/Mobile clients.
5. Cross-surface handoff should be documentation/API driven rather than direct Web navigation.

## 9. TOR wording vs surface ownership

A TOR clause may describe one capability spanning multiple surfaces.

Do not translate:
```text
one TOR clause = one Web page
```

Instead use:
```text
TOR capability
   ↓
Which actor?
   ↓
Which device?
   ↓
Which surface owns the interaction?
```

This rule should be applied before creating any new prototype screen.
