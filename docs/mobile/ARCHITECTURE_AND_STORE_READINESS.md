# Mobile architecture and store readiness

Status: `PREPARED_NOT_SUBMITTED`. This repository does not claim an App Store or Play Store publication.

The public promise is versioned in
`contracts/mobile/v1/capability-matrix.json`: responsive web and an installable
PWA are RC capabilities; native wrappers are prepared but not submitted;
signed builds, universal links on a controlled domain and store publication
need external evidence. Offline mutations and native push notifications are
not supported.

## Official architecture

The Capacitor wrapper is a native client of the configured Orqena web backend. The backend remains the only source of truth for authentication, authorization, tenant context, business data, files and side effects. The wrapper contains no embedded production database, provider credential, customer data or offline mutation queue.

Development, staging and release are selected with `CAPATAZ_MOBILE_MODE`. Every mode requires an explicit `CAPATAZ_MOBILE_SERVER_URL`. Development accepts loopback/private HTTP for local devices; staging requires non-local HTTPS; release requires non-local HTTPS and rejects staging hosts. `CAPATAZ_MOBILE_APP_LINK_HOST` must equal the backend host. App ID, name and URL scheme are build configuration, not forks.

## Auth, sessions and links

The WebView uses the same opaque, server-side session as the web application. The browser cookie is HttpOnly, Secure in HTTPS environments and SameSite; rotation/revocation remain server-owned. The native layer never receives or persists the session token and does not use Capacitor Preferences for credentials.

Only `https://<configured-host>/auth/mobile/callback`, `/open/*` and the matching `<scheme>://auth/callback` route are accepted. Android App Links and iOS Universal Links are declared, while the `.well-known` responses remain 404 until the matching package certificate fingerprint or Apple team ID is configured. A production domain and device-level verification are external release gates.

## Files and permissions

Android declares only `INTERNET`; iOS declares no camera, microphone, location, contacts or photo-library usage key. User-selected uploads use the system file picker. Temporary shares use the app-scoped `cache/downloads` path; broad external-storage paths are forbidden. PDFs and downloads remain same-origin, authorized web resources. A future camera, microphone or background feature requires a new privacy review and a separately justified permission.

## Crash and release mapping

The provider-neutral crash contract accepts only platform, environment, exact release SHA, bounded code, event ID, timestamp, deterministic fingerprint and a synthetic flag. Message, stack, URL, route, user, company, contact, payload, token, prompt and secret fields are rejected. A fake transport proves the synthetic flow without contacting a provider. A live native crash provider/project and release upload remain external.

## Store metadata and status

`contracts/mobile/v1/store-privacy.json` is derived from the processing catalog and covers account, business, financial, user-content, identifier and optional diagnostic data. It declares no advertising, tracking or sale. `contracts/mobile/v1/distribution.json` keeps publication state `NOT_SUBMITTED`. Store-console answers must be compared with these versioned contracts immediately before submission; screenshots or approvals are not fabricated here.
