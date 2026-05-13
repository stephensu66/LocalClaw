# Windows Release

This project can produce unsigned Windows installers on a Windows host.

## Host Requirements

- Windows 10 or newer
- Node.js 24.x
- `pnpm`
- Rust toolchain with `cargo tauri`
- Visual Studio C++ build tools / MSVC toolchain required by Rust and Tauri

## Bundle Types

The Windows-specific Tauri config is stored in:

- `apps/desktop/src-tauri/tauri.windows.conf.json`

It enables:

- `nsis` installer (`.exe`)
- `msi` installer (`.msi`)

It also sets WebView2 install mode to `downloadBootstrapper` with silent install.

## Build Commands

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release-desktop-windows.ps1
```

Or through pnpm:

```powershell
pnpm release:desktop:windows
```

Or from `apps/desktop`:

```powershell
pnpm release:windows
```

The PowerShell script will:

1. Ensure it is running on Windows.
2. Ensure `node`, `pnpm`, and `cargo` exist.
3. Require Node.js 24.x.
4. Run `pnpm install` automatically if the workspace dependencies are missing.
5. Execute `cargo tauri build --ci --bundles nsis,msi --no-sign`.

## Output Paths

- NSIS `.exe`: `apps/desktop/src-tauri/target/release/bundle/nsis/`
- MSI `.msi`: `apps/desktop/src-tauri/target/release/bundle/msi/`

## Notes

- This is an unsigned Windows build flow for personal testing, internal testing, and friend trial use.
- For broader distribution, add Windows code signing later.
- This flow must run on Windows. The current macOS host cannot directly produce the Windows installers in this repo setup.
