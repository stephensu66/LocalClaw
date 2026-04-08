# OpenClaw MVP

本仓库是一个本地单机模式的 OpenClaw 产品化 MVP 骨架，包含 Web 控制台、Desktop 壳层，以及 Local Service。

## 架构概览
该项目采用三层结构：

- `apps/web` / `apps/desktop`：负责交互与展示
- `services/local-service`：本地后端中枢（REST + SSE + Prisma）
- OpenClaw CLI / Gateway：实际执行 Agent 与工具调用

典型调用链路：
`Web/Desktop -> Local Service API -> OpenClaw Adapter(mock/real) -> OpenClaw`

`Local Service` 是本项目的核心运行时，主要负责把 OpenClaw CLI 能力产品化为可视化、可配置、可控的本地服务。

## Local Service 核心职责
- 对外统一 API：提供 `/api/config`、`/api/tasks`、`/api/permissions`、`/api/agent`、`/api/events`（SSE）等接口。
- 任务编排与状态管理：创建任务、持久化状态、保存日志、推送实时事件。
- 配置管理与同步：管理模型模式、工作目录、API Key，并同步到 OpenClaw。
- 安全控制：本地权限默认拒绝，需显式授权（如 `FILE_WRITE`、`SHELL_EXEC`、`INTERNET_ACCESS`）。
- 本地数据存储：使用 Prisma + SQLite 持久化配置、任务、日志、权限。
- 运行时适配：支持 `mock` / `real` 两种模式，开发与真实执行可切换。

## 运行环境
- Node.js 24（自动化安装链路的目标版本）
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

可选：检查 Local Service 健康状态
```bash
curl http://localhost:3980/api/health
```

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

## Real 模式（接入真实 OpenClaw）
当你希望通过本项目真正驱动 OpenClaw 时，设置：

```bash
OPENCLAW_MODE=real
```

`real` 模式下，Local Service 会尝试完成以下动作：
- 检测并安装 OpenClaw（二进制不存在时）
- 检测 Node 主版本是否满足 `NODE_REQUIRED_MAJOR`（默认 24）
- 读取/准备 gateway token
- 启动 OpenClaw gateway
- 将本地配置同步到 OpenClaw 运行环境

你也可以通过 `/api/setup`（Onboarding 已接入）执行一键检查/自动准备，包含：
- 安装授权（Node/OpenClaw）
- 安装目录与工作目录设置
- 路径可写与磁盘剩余空间预检（`SETUP_MIN_FREE_GB`）
- 运行步骤状态持久化与失败重试

如果你只是在本地联调前后端或调 UI，优先使用 `mock` 模式即可。

## 发布前初始化（避免带入开发数据）
如果你要把桌面安装包发给其他人，建议在打包前先清空本地服务状态：

```bash
pnpm --filter @openclaw/local-service reset:state
```

说明：
- 该命令会清理 local-service 使用的 SQLite 数据文件（含 `-wal/-shm/-journal`）与 `secret.key`。
- 如果你的 `.env` 里配置了 `DATABASE_URL=file:/...`，它也会清理该路径对应的数据文件。
- 请避免在发布用 `.env` 中写死开发机路径（如 `DATABASE_URL=file:/.../prisma/dev.db`）。

## 常见问题
- 如果 Prisma 报 enum 不支持，请确保使用的是 `services/local-service/prisma/schema.prisma`。
- 如果前端无法连接本地服务，检查 `apps/web/.env` 中的 `VITE_API_BASE_URL`。

## 参考文档
- `docs/DEV.md`
- `docs/SECURITY.md`
- `docs/FUTURE.md`
