# OpenClaw MVP Security Notes

## API Key Local Encryption
- API keys are encrypted at rest with AES-256-GCM.
- The encryption key is stored in the app data directory with file mode `0600`.
- Rotate the key by regenerating `secret.key` and re-saving the config.

## Local Service Access Control
- Bind to localhost only; do not expose on public network.
- Explicitly configure `ALLOWED_ORIGINS` to prevent cross-site access.
- Keep the service behind the desktop shell when distributing.

## CORS / Localhost Security
- CORS is restricted to the local web UI origin by default.
- Do not allow wildcard origins in production builds.

## Permission Boundaries
- Default permissions are denied.
- Permissions must be explicitly granted via UI before task execution.
- Permissions changes apply immediately.

## Command Execution Safety
- Command execution is disabled by default.
- Restrict to allow-list commands in production.
- Log all command invocations and outcomes.

## File Access Safety
- Enforce work directory scope and deny traversal above it.
- Allow-list paths in future when file plugins expand.

## Audit Logs
- All tasks and logs are stored locally.
- Consider adding an immutable audit table for security-sensitive actions.
