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
