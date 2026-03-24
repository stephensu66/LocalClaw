# Future Extension Plan

## Multi-Device Sync
- Introduce a sync service that stores task metadata and configs.
- Apply conflict resolution on config edits.

## Mobile Support
- Add a `packages/shared-ui` for React Native or Flutter bridge.
- Reuse DTOs and local API contract.

## Account System
- Add optional login and token-based access.
- Keep local-only mode as default.

## Cloud Task Sync
- Store task history and logs in a cloud queue when enabled.
- Allow users to opt-in on a per-device basis.

## Plugin Marketplace
- Add signed plugin bundles.
- Include plugin approval workflow and security checks.

## Multi-User Local Mode
- Add multi-profile support with isolated configs and histories.
