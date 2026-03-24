# OpenClaw MVP

本仓库是一个本地单机模式的 OpenClaw 产品化 MVP 骨架，包含 Web 控制台、Desktop 壳层，以及 Local Service。

## 运行环境
- Node.js 18+（建议 20+）
- pnpm 9+
- SQLite（内置）
- Rust（仅当你要构建 Desktop/Tauri）

## 目录结构
- `apps/web`：本地 Web 控制台
- `apps/desktop`：Tauri 桌面壳层（复用 web UI）
- `services/local-service`：本地服务（REST + SSE + Prisma）
- `packages/shared`：共享 DTO / Zod schema
- `docs`：安全、开发、扩展说明

## 快速开始
1. 安装依赖
```bash
pnpm install
```

2. 配置环境变量
```bash
cp services/local-service/.env.example services/local-service/.env
cp apps/web/.env.example apps/web/.env
```

3. 初始化 Prisma
```bash
pnpm --filter @openclaw/local-service prisma:generate
pnpm --filter @openclaw/local-service prisma:migrate
```

4. 启动 Local Service
```bash
pnpm --filter @openclaw/local-service dev
```

5. 启动 Web 控制台
```bash
pnpm --filter @openclaw/web dev
```

访问 `http://localhost:5173` 即可。

## Desktop 开发模式（可选）
- Desktop 复用 Web UI，默认通过 `apps/desktop/src/main.tsx` 引入 `apps/web/src`。
- Tauri 配置在 `apps/desktop/src-tauri/tauri.conf.json`。

如果你已经安装 Tauri CLI：
```bash
cd apps/desktop
pnpm dev
```

## Mock 模式
默认使用 mock adapter，确保本地可运行：
- `services/local-service/.env` 里设置 `OPENCLAW_MODE=mock`

## 常见问题
- 如果 Prisma 报 enum 不支持，请确保使用的是 `services/local-service/prisma/schema.prisma`。
- 如果前端无法连接本地服务，检查 `apps/web/.env` 中的 `VITE_API_BASE_URL`。

## 参考文档
- `docs/DEV.md`
- `docs/SECURITY.md`
- `docs/FUTURE.md`
