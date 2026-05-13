# Apple Silicon macOS Release

This project now supports a repeatable Apple Silicon macOS release flow that produces a signed and notarized `.dmg`.

## Prerequisites

- Build host: Apple Silicon Mac (`Darwin arm64`)
- `Node.js 24.x`
- Rust toolchain with `cargo tauri`
- Apple signing identity available in the keychain or imported through environment variables
- Apple notarization credentials

## Required Environment Variables

### Signing

- `APPLE_SIGNING_IDENTITY`
  - Example: `Developer ID Application: Your Name (TEAMID1234)`

### Notarization

Choose one of the following authentication modes.

1. Apple ID mode

- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

2. App Store Connect API key mode

- `APPLE_API_KEY`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_PATH`

### Optional Sharing Hook

- `LOCALCLAW_SHARE_COMMAND`
  - Optional command that uploads the final `.dmg` and prints a public download URL to stdout.
  - If the command contains `{file}`, the script replaces it with the quoted DMG path.
  - If `{file}` is omitted, the DMG path is appended as the last argument.

Example:

```bash
export LOCALCLAW_SHARE_COMMAND='your-upload-tool put {file}'
```

## Build Command

From the repository root:

```bash
pnpm release:desktop:macos
```

Or from `apps/desktop`:

```bash
pnpm release:macos
```

The wrapper script will try to switch to `Node 24` through `nvm` automatically when the current shell is on another major version.

If your default shell still uses an older Node version and cannot even start `pnpm`, use the shell entrypoint directly:

```bash
bash ./scripts/release-desktop-macos.sh
```

The release script performs these steps:

1. Verify the host is `Darwin arm64`.
2. Verify the current Node major version is `24`.
3. Verify required signing and notarization environment variables exist.
4. Run `cargo tauri build --ci --bundles app,dmg`.
5. Verify the resulting `.app` with `codesign` and `spctl`.
6. Validate stapling on both the `.app` and `.dmg`.
7. Compute the DMG SHA-256 checksum.
8. Optionally upload the DMG if `LOCALCLAW_SHARE_COMMAND` is configured.
9. Write `apps/desktop/src-tauri/target/release/bundle/macos-release-manifest.json`.

## Release Outputs

- `.app`: `apps/desktop/src-tauri/target/release/bundle/macos/*.app`
- `.dmg`: `apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg`
- manifest: `apps/desktop/src-tauri/target/release/bundle/macos-release-manifest.json`

Always distribute the notarized `.dmg`, not `target/release/LocalClaw` and not `*.d`.

## Clean-Machine Verification

On a clean Apple Silicon Mac:

1. Remove any old LocalClaw install from `/Applications`.
2. Remove old app data if you want a true first-run test:
   - `~/Library/Application Support/com.guodongsu.localclaw`
   - `~/Library/Logs/com.guodongsu.localclaw`
3. Download the `.dmg` from the generated public link.
4. Open the `.dmg`.
5. Drag `LocalClaw.app` into `/Applications`.
6. Launch `LocalClaw` from `/Applications`.
7. Confirm the app reaches Onboarding or Settings instead of getting stuck on the startup screen.
8. Save the minimum required configuration and confirm the app enters the main UI.

## Troubleshooting

- local-service log:
  - `~/Library/Logs/com.guodongsu.localclaw/local-service.log`
- app data:
  - `~/Library/Application Support/com.guodongsu.localclaw`

Common failure cases:

- Node is not `24.x` on the build host.
- Apple signing identity is missing from the keychain.
- Notarization credentials are incomplete.
- The sharing command uploads the wrong file or does not print a URL.
