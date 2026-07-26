# Mobile signing, rotation and distribution

No keystore, private key, certificate, provisioning profile, password or recovery material belongs in Git, `.env.example`, CI logs or readiness evidence. Store them in the approved organizational secret manager with separate owner and recovery access.

## Android

1. Generate or import the upload key in an approved offline/managed workstation; record alias, algorithm, expiry and public SHA-256 certificate fingerprint without recording the private material.
2. Back up the encrypted keystore twice in separate approved vault locations and verify recovery with a non-publishing signature check.
3. Inject `CAPATAZ_ANDROID_KEYSTORE_PATH`, password, alias and key password only into the protected release job. The Gradle release graph fails if any input is absent.
4. Configure the public fingerprint for App Links, run the release guard, build the AAB, create the checksum manifest and verify the signing certificate before upload.
5. For rotation, prepare the successor, verify store-supported key upgrade, overlap association fingerprints where allowed, publish through a manual gate, then revoke old job access. Never overwrite the only recovery copy.

## iOS

1. Keep the distribution certificate/private key and provisioning profile in the approved signing service or protected keychain, with Apple team ownership documented outside the repository.
2. Inject team, signing identity and provisioning profile into a protected macOS release job. Release uses manual signing; no personal automatic-signing account is assumed.
3. Verify Associated Domains, archive, export through the approved method, create the checksum manifest and inspect the signed bundle ID/team before upload.
4. Rotate certificate/profile before expiry, test on a non-production build, update the protected job and revoke expired material after the accepted release.

## Common release gate

Pin the exact Git SHA, semantic version and monotonically increasing build number. Run typecheck, build, F10 validation, dependency/secret scans and device E2E. Upload only after manual environment/store approval. Record artifact name, SHA-256, size, release SHA and review result; never record secret values. Rollback means stopping rollout or reverting to an already accepted store version, not mutating production data.
