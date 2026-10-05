# INNO.One Assets Mobile

Android mobile runtime for QR-based Asset lookup.

## Toolchain

- Expo SDK 57
- React Native 0.86
- Node.js 20.19.4 or newer
- Android is the product target.

The repository Web toolchain can still run on its existing Node baseline. Use Node 20.19.4+ when running this app because React Native 0.86 requires it.

## Configure

Copy `.env.example` to `.env.local` and point the app to the reachable INNO.One API and Keycloak host.

```env
EXPO_PUBLIC_API_BASE_URL=http://<server>:5080/api/v1
EXPO_PUBLIC_KEYCLOAK_URL=http://<server>:8080
EXPO_PUBLIC_KEYCLOAK_REALM=inno-one
EXPO_PUBLIC_KEYCLOAK_CLIENT_ID=inno-one-assets-mobile
```

## Run

```bash
pnpm install
pnpm --filter @inno/assets-mobile typecheck
pnpm --filter @inno/assets-mobile android
```

A development build is preferred for OIDC custom-scheme redirects.

## Language runtime

Assets Mobile supports `th-TH` and `en-US`.

Locale resolution follows the Production language contract:

```text
explicit user preference
  -> organization/platform default
  -> device locale before authentication
  -> en-US fallback
```

After sign-in the app reads `GET /api/v1/platform/me` and applies the returned effective `locale`. The TH/EN control writes the explicit preference through `PATCH /api/v1/platform/me/profile`. Scanner, history, result, camera-permission guidance, task/busy state, sign-in errors, QR errors and offline copy all use the same runtime catalog. Asset names, status codes and custom-field values remain business data and are not silently translated.

If the profile endpoint is temporarily unreachable, the app keeps the device-derived locale and shows a localized warning instead of blocking the scanner shell.

## Security

- Sign-in uses OIDC Authorization Code + PKCE S256.
- Access and refresh tokens are stored with Expo SecureStore.
- Camera permission is requested by Android at runtime.
- The QR payload is sent only to `POST /api/v1/assets/qr/resolve`.
- QR payloads are never written to local history or SecureStore.
- Recent scan history stores only Asset display metadata and remains device-local.
- Invalid, expired and revoked labels are rejected by the server.

## Scope boundary

This app owns camera permission, scanning, QR token validation result and the mobile Asset result/history experience. Web Assets continues to own QR generation, printing and label administration.

The current frozen QR Resolve response exposes Asset identity, owner/org/location, linked endpoint summary, warranty end date and custom fields. Step 24 does not invent new Hardware/Software or scan-history APIs beyond that contract.
