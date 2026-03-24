# Local Development Guide

## Environment
- Copy `services/local-service/.env.example` to `services/local-service/.env` and adjust.
- Optional: copy `apps/web/.env.example` to `apps/web/.env`.

## Install Dependencies
- `pnpm install`

## Prisma
- `pnpm --filter @openclaw/local-service prisma:generate`
- `pnpm --filter @openclaw/local-service prisma:migrate`

## Run Local Service
- `pnpm --filter @openclaw/local-service dev`

## Run Web Console
- `pnpm --filter @openclaw/web dev`

## Run Desktop Shell (Dev)
- Start web console first.
- Use Tauri CLI from `apps/desktop` if configured.

## Mock Mode
- Set `OPENCLAW_MODE=mock` in `services/local-service/.env`.
