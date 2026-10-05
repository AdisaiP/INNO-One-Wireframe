# INNO.One - Step45M Android Mobile Bilingual Completion

**Status:** IMPLEMENTATION COMPLETE / ANDROID DEVICE VISUAL QA PENDING
**Branch:** `implementation/step45m-android-mobile-bilingual`
**Base:** Step45L native packaging checkpoint `c921191`

## Scope

Step45M migrates the existing Assets Mobile Product to the Production bilingual runtime without changing surface ownership.

Assets Mobile remains responsible for:
- camera permission;
- QR scanning;
- QR token validation result;
- local scan history;
- mobile Asset result;
- busy/task state;
- sign-in, error and offline states.

Web Assets remains responsible for QR generation/printing and label administration. Endpoint Agent remains separate.

## Runtime locale model

Supported locales:

```text
th-TH
en-US
```

Resolution:

```text
before authentication:
device locale -> en-US fallback

after authentication:
explicit user preference -> organization default
via GET /api/v1/platform/me -> data.locale
```

The Mobile TH/EN action persists an explicit preference through:

```text
PATCH /api/v1/platform/me/profile
{ "preferredLocale": "th-TH" | "en-US" }
```

The app keeps the current/device locale and shows localized warning copy when the profile endpoint is temporarily unavailable.

## Bilingual surfaces

The runtime catalog now owns:
- boot;
- sign-in;
- scanner guidance;
- camera permission guidance;
- scan busy/task state;
- recent scans;
- scan history;
- Asset result headings/labels;
- Managed Endpoint empty state;
- latest-data summary;
- QR errors;
- session errors;
- offline/network errors;
- profile/language errors;
- bottom navigation;
- date and relative-time formatting.

Asset names, raw status values, custom-field labels/values and other business content are preserved as data and are not silently translated.

The Expo camera plugin no longer hard-codes a Thai camera-permission description in app configuration.

## API/runtime changes

Assets Mobile now reads:
- `GET /api/v1/platform/me`
- `PATCH /api/v1/platform/me/profile`
- existing `POST /api/v1/assets/qr/resolve`

QR security/ownership boundaries are unchanged.

A shared profile-contract mismatch discovered during Step45M was also corrected in Endpoint Agent: the Platform profile response field is `locale`, not `effectiveLocale`.

## QA completed

```text
Step45M static audit          38/38
Assets Mobile TypeScript     PASS
Android Expo export          PASS
Android Metro modules        624
Android bundle               ~1.6 MB HBC
Step45E browser runtime      62/62
Step45L static regression   159/159
Step45L Agent browser        54/54
Agent screenshots                 9
Agent TypeScript             PASS
```

The shared Step45E browser runtime test also verified:
- explicit Thai preference;
- explicit English behavior;
- organization-default inheritance;
- permission set unchanged by locale;
- original organization/user locale restored after QA.

The Agent regression verified the corrected `profile.locale` contract across Thai/English, Request Help, ownership, Remote Consent, Agent Prompt and offline state.

## Remaining QA gate

This Windows machine currently has no Android SDK tooling available through the development session:

```text
adb      not available
emulator not available
```

React Native Web is not a valid substitute for the authenticated Android runtime here because Expo SecureStore's Web implementation is empty and the Keycloak Mobile client only allows the native `innoone-assets` redirect scheme.

Therefore Step45M must not claim Android device/emulator visual QA yet.

Required before marking Step45M fully COMPLETE:
1. attach an Android device or install/configure Android SDK + emulator;
2. run the real Assets Mobile app;
3. verify sign-in and profile locale inheritance;
4. verify TH/EN switch;
5. visually inspect scanner/history/result/error/offline states;
6. verify camera permission and QR scan flow on Android;
7. rerun the final audit chain.

Do not start Step45N until this device/emulator visual gate is green.

Do not merge to `main` unless explicitly requested.
