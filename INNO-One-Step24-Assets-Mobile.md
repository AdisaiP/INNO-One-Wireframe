# INNO.One — Step 24 Android Assets Mobile Scanner

**Status:** implementation-in-progress
**Branch:** `implementation/step24-assets-mobile`
**Implementation Contract:** 0.15.0

## Scope

Step 24 implements the Android Assets Mobile runtime while preserving the frozen mobile boundary.

### Runtime surface

- Expo / React Native Android application under `production/apps/assets-mobile`.
- Thai mobile UI.
- No Web Portal route and no Web shell/navigation reuse.

### Frozen API reuse

- Reuses `POST /api/v1/assets/qr/resolve` (`assets.qr_resolve`).
- Requires `assets.qr.scan`.
- Does not add an unfrozen scan-history API.
- Recent scan history is device-local and contains only resolved display metadata, never QR tokens.

### Authentication

- Public OIDC client `inno-one-assets-mobile`.
- Authorization Code + PKCE S256.
- Access/refresh tokens are stored with Expo SecureStore.
- QR tokens are never persisted after resolution.

### Mobile tasks

1. Organization sign-in.
2. Camera permission.
3. QR camera scan.
4. Server-side opaque token resolution.
5. Resolved Asset overview.
6. Linked endpoint summary.
7. Owner/location/organization summary.
8. Warranty date.
9. Device-local recent scan history.
10. Invalid/expired QR recovery and scan-again flow.

## Security boundaries

- No raw mutable Asset identifier is encoded by the Mobile app.
- Mobile sends only the opaque QR value to the frozen resolve endpoint.
- Invalid/revoked/expired labels use the server 404 response.
- Effective Assets scope remains server-authoritative.
- QR values are not written to SecureStore or scan history.

## Completion gates

- Mobile TypeScript typecheck PASS.
- Expo configuration validation PASS under Node 20.19.4+.
- Android/Expo export or bundle validation PASS where supported.
- Existing .NET/Web build remains PASS.
- Step 24 static audit 0 issues.
- Mobile visual QA at 430 / 390 / 360.
- Frozen Web browser regression remains 124 / 124.
- `git diff --check` PASS.

**Software Baselines remain deferred until a standalone frozen API/route contract exists.**

**Step 16 fresh re-validation remains deferred by explicit user request and is required before merge/release.**
