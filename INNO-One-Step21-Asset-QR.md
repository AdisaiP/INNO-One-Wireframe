# INNO.One — Step 21 Asset QR Labels & Resolve

**Status:** completed
**Branch:** `implementation/step21-asset-qr`
**Implementation Contract:** 0.12.0

## Scope

Step 21 implements secure physical QR labels for Assets and the API used by the separate Android Assets Mobile scanner.

### Web route

- `/assets/qr-labels`

The Web Portal owns label selection, label setup, preview and printing. Android scanning remains a separate surface and does not become normal Web navigation.

### API operations

- `assets.qr_label.create` — `POST /assets/{assetId}/qr-label`
- `assets.qr_resolve` — `POST /assets/qr/resolve`

### Security model

- QR values are opaque 256-bit random tokens with the `inno1_qr_` prefix.
- The raw QR token is returned only when a label is generated.
- Only a SHA-256 token fingerprint is persisted.
- Raw QR tokens are never written to audit metadata.
- Regenerating a label revokes any previous active label for that Asset.
- Resolve returns a generic not-found response for unknown, revoked or expired tokens.
- Successful scans are permission/scope checked before returning Asset data.
- The QR value never embeds mutable Asset JSON, owner data, serial numbers or privileged business data.

### Persistence

- `assets.qr_labels` — active/revoked label metadata and token fingerprint.
- `assets.qr_scans` — successful scan history with scanner user ID as a logical cross-module reference only.
- No cross-module database foreign key is introduced.

### Audit

- Label generation: `assets.qr.generated` / internal.
- Successful scan: `assets.qr.scanned` / restricted.

### Web UX

The QR Labels page follows the frozen four-step task flow:

1. Select assets.
2. Label setup.
3. Generate and verify preview.
4. Print selected labels.

Label size, copy count and visible label content are print-layout settings only. They are not encoded in the QR token.

## Deferred

- Android camera/scanner UI runtime.
- Mobile scan history UI.
- Hardware/software detail expansion in Android.
- Software baselines and licenses.
- Contracts / Warranty.

## Completion gates

- Web typecheck/build PASS.
- .NET build 0 warnings / 0 errors.
- Assets + Platform EF pending-model checks PASS.
- Step 21 runtime smoke PASS.
- Step 21 audit 0 issues.
- Frozen static audit chain 0 issues.
- Production visual QA at 1366 / 1024 / 768.
- Frozen browser regression 124 / 124.
- `git diff --check` PASS.

**Step 16 fresh re-validation remains deferred and is still required before merge/release.**


## Final QA

- Step 21 runtime smoke: **PASS**
- Step 21 audit: **0 issues**
- Web typecheck/build: **PASS**
- .NET build: **0 warnings / 0 errors**
- EF pending-model checks for Assets / Platform / Devices / Helpdesk: **PASS**
- contract/static audit chains: **0 issues**
- production QR Labels visual QA: **4 / 4 screens**, failures 0
  - Web: 1366 / 1024 / 768
  - Print media: physical QR-label output
- frozen browser regression: **124 / 124**, failures 0
- `git diff --check`: **PASS**
- remote DB security guards:
  - observed `assets.qr.generated` audits: 3
  - observed `assets.qr.scanned` audits: 3
  - persisted fingerprints were 64-character SHA-256 values
  - raw token found in fingerprint column: 0
  - raw token found in QR audit metadata: 0
  - cross-module DB foreign keys: 0
  - QR permissions seeded: 2
- migration `Step21AssetQr` applied to PostgreSQL on `172.10.1.58`
- QR label / scan QA rows were removed after verification; audit records were retained.

**Step 16 fresh re-validation remains deferred by explicit user request and must be rerun before merge/release.**

**Do not merge `main` without explicit user instruction. No Step 22 work has been started.**
