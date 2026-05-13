# Review Log

## 2026-03-25 22:30
- Question: 希望后续每次都把问题和解决方案简要记录到项目里的 `review.md`，且不需要重复输入同样提示。
- Solution: 新增项目级 `AGENTS.md` 作为长期规则，要求每次完成请求后自动追加简要记录到 `review.md`；并初始化了本日志文件。

## 2026-03-25 22:35
- Question: 项目在apps/desktop中本地运行正常，如何打包成桌面安装包供macOS/Windows用户下载安装使用？
- Solution: 提供了Tauri构建步骤，包括安装Rust/Tauri CLI、运行cargo tauri build生成.dmg/.msi安装包，并说明分发和注意事项。

## 2026-03-25 22:40
- Question: Rust 和 Tauri 是需要安装在系统上还是本地项目中？
- Solution: 解释了Rust为系统级，Tauri库为项目本地，Tauri CLI为系统级，并提供了安装步骤。

## 2026-03-26 14:30
- Question: `apps/desktop/src-tauri/target` 目录里都包含什么内容、各自用途是什么，以及哪些属于可执行程序。
- Solution: 扫描了 `target` 实际产物并按目录说明用途（`release/.fingerprint`、`build`、`deps`、`examples`、`incremental`），同时区分了“可直接运行的主程序”与“仅构建过程使用的可执行/动态库”。

## 2026-03-26 14:36
- Question: 为什么双击 `target/release/LocalClaw` 后，界面表现和浏览器里 Web 版本的 UI/UX 不一致。
- Solution: 解释了 Tauri `release` 运行时实际加载的是构建时打包进二进制的 `apps/web/dist` 静态资源（非实时 `web/src`），并补充了 dev 与 release 行为差异及本地服务运行依赖。

## 2026-03-26 14:54
- Question: 安装包里带有本地开发数据，如何在发布给别人时保证是初始状态。
- Solution: 新增 `pnpm --filter @openclaw/local-service reset:state` 一键清理脚本，发布前可清空 SQLite 状态和密钥；同时修正 `.env.example`，去掉开发机绝对路径示例，并在 README 增加发布前初始化说明。

## 2026-03-26 15:55
- Question: 需要梳理用户安装默认程序后，在“已安装且已配置 OpenClaw+API Key”与“未安装 OpenClaw”两种情况下，程序的实际执行流程。
- Solution: 按当前代码给出启动时序和双场景流程，明确了 `real` 模式下安装/读取 token/onboarding/gateway 启动/配置同步逻辑，以及当前桌面端未内置自动拉起 local-service 的实现边界。

## 2026-03-26 16:46
- Question: 在产品化流程中还需保证 Node 24，并确认安装扩展（如 Node、OpenClaw）时是否应征得用户同意。
- Solution: 明确建议把 Node 24 纳入环境门禁与自动修复流程；同时对系统级下载/安装操作采用显式用户授权（含一次性授权与细粒度开关），避免无感安装带来的安全与合规风险。

## 2026-03-26 16:48
- Question: 需要把前两轮讨论收敛成按顺序执行的补齐清单，先共同审阅确认，再进入代码实现。
- Solution: 输出了产品化缺口的有序实施列表（覆盖 local-service 自动拉起、Node 24 门禁、OpenClaw 安装/升级编排、用户授权机制、健康检查与失败恢复等），用于实现前评审。

## 2026-03-26 16:53
- Question: “未安装 OpenClaw”场景下要求 UI 指定安装目录与工作目录，用户在 Windows 需要大磁盘目录，macOS 是否也需要。
- Solution: 建议 Windows 和 macOS 都支持目录选择；默认路径可自动给出，但应允许用户把数据/工作目录放到大容量磁盘，并在安装前做可用空间与可写权限校验。

## 2026-03-26 17:18
- Question: 需要把最近三轮讨论合并成一份清晰的计划列表，便于后续按步骤实现。
- Solution: 整理为统一实施清单：前置策略（Node 24 与授权）-> 本地服务自动拉起 -> OpenClaw 安装/升级编排 -> 存储目录策略（含 macOS/Windows）-> 进度与恢复机制 -> 发布验证。

## 2026-03-26 18:17
- Question: 按前述计划开始落代码，实现首批产品化能力（自动拉起 local-service、Node/OpenClaw setup 检查与授权、基础自动安装链路、Onboarding 接入）。
- Solution: 新增 `/api/setup` 模块与执行链路（Node 24 门禁、OpenClaw 检测/安装、gateway 启动、配置同步、授权与路径持久化）；Onboarding 增加 setup 操作区；Tauri 主进程增加 local-service 自动拉起逻辑，并通过构建验证确保可编译。

## 2026-03-26 18:20
- Question: 确认“按上方计划执行”后的代码是否已落地并可编译运行。
- Solution: 复核关键实现（`/api/setup`、Onboarding setup UI、desktop 自动拉起 local-service），并完成构建验证：`@openclaw/local-service build`、`@openclaw/web build`、`apps/desktop/src-tauri cargo check` 全部通过。

## 2026-03-26 21:56
- Question: 继续推进产品化剩余项，优先补齐安装前预检、setup 执行状态持久化与失败恢复能力。
- Solution: 重构 setup 模块，新增路径可写/磁盘空间预检（`SETUP_MIN_FREE_GB`）、运行状态机持久化（runId/步骤/失败可重试）、按需授权安装（仅在缺失时要求同意），并加入工作目录失败回滚；Onboarding 同步展示预检与上次运行状态。

## 2026-03-28 22:17
- Question: 对比分析本项目相对 OpenClaw 原生方案的优势，重点评估其是否更适合国内不懂代码用户。
- Solution: 基于仓库实现给出结论：该项目的核心优势是将 OpenClaw CLI 产品化为中文可视化引导、一键环境准备、国内模型优先配置、任务与权限可视化管理及本地化持久化；同时明确其仍存在技能市场、知识库与工作流等能力缺口。

## 2026-04-16 18:09
打包命令： cargo tauri build --bundles app --no-sign

推荐打包流程（macOS）：
先确保前端资源是最新（需要 Node 24 + pnpm 可用）
pnpm --filter @openclaw/web build
打包 .app（跳过签名）
cd apps/desktop/src-tauri && cargo tauri build --bundles app --no-sign
若要 .dmg，改为
cargo tauri build --bundles app,dmg --no-sign
若只想验证 Rust 主程序可构建：
cargo tauri build --no-bundle

双击 .app 启动，确认窗口可打开。
若需对外分发，再补签名/公证流程。

## 2026-04-16 Q&A 记录 01

### 问题
- 实现 LocalClaw 一键启动改造：打包后点击 `.app` 自动拉起 local-service，并在启动失败时前端明确报错，不再无限“启动中”。

### 结论
- 已实现打包期 runtime 准备脚本：构建并部署 local-service 到 `apps/desktop/src-tauri/resources/local-service`，并复制 Node 运行时到 `resources/runtime/node`。
- 已实现 Tauri 打包链路接入：`beforeBuildCommand` 自动执行 web 构建与 runtime 准备，且 `bundle.resources` 打入 runtime 资源。
- 已实现桌面端 release 启动逻辑：优先使用内置 `node + tsx + src/index.ts` 启动 local-service，注入 `PORT` 与 `APP_DATA_DIR`，并进行 20 秒就绪探测。
- 已实现启动失败上报：Rust 侧发出 `local-service-startup-error` 事件并写日志文件；前端启动页监听事件后展示错误信息、日志路径与重试按钮。
- 已补充 local-service 包配置：`tsx` 移至 dependencies，新增 `desktop:start` 启动语义脚本。

### 证据
- 新增脚本：`apps/desktop/scripts/prepare-runtime.mjs`。
- 配置修改：`apps/desktop/src-tauri/tauri.conf.json`（`beforeBuildCommand` + `bundle.resources`）。
- Rust 启动逻辑修改：`apps/desktop/src-tauri/src/main.rs`（release 内置启动、日志、就绪探测、事件上报）。
- 前端启动页修改：`apps/web/src/App.tsx`（失败态 UI + 事件监听 + 重试）。
- 文案修改：`apps/web/src/i18n.ts`（新增启动失败相关多语言 key）。
- 包配置修改：`services/local-service/package.json`、`apps/desktop/package.json`。
- 本地验证：`cd apps/desktop/src-tauri && cargo check -q` 通过。
- 受环境限制：当前机器 `Node v16.13.0`，无法执行 `pnpm` 相关命令验证 runtime 准备脚本与前端构建链路。

### 后续动作
- 将本机 Node 升级到 24（或 >=18.12）后执行：`pnpm --filter @openclaw/desktop prepare:runtime` 与 `cargo tauri build --bundles app --no-sign`。
- 用打包产物做冷启动验证：不手动起服务直接双击 `.app`，确认 20 秒内进入应用。
- 破坏内置启动文件（如临时改名 `resources/runtime/node`）验证失败路径 UI 与日志提示。

## 2026-04-17 Q&A 记录 02

### 问题
- 用户要求桌面端走轻量化方案：不再内置 Node，启动时检测本机 Node 是否为 24；若不满足则弹窗征求安装许可，拒绝则退出应用。

### 结论
- 已改为系统 Node 运行模式：release 启动 local-service 时使用系统 `node`，不再依赖 `resources/runtime/node`。
- 已新增 Node 24 启动前检测：读取 `node -v` 主版本并与 `NODE_REQUIRED_MAJOR`（默认 24）比较。
- 已新增 macOS 弹窗授权流程：缺少 Node 24 时弹出原生对话框，用户拒绝即退出应用。
- 已新增本地安装逻辑：用户允许后执行 `NODE_INSTALL_CMD`；未配置时回退 `brew install node@24`（若检测到 brew）。安装后再次校验版本。
- 已同步轻量化打包：runtime 准备脚本不再复制 Node；Tauri bundle resources 仅保留 `resources/local-service`。

### 证据
- Rust 主流程与检测/安装逻辑：`apps/desktop/src-tauri/src/main.rs`。
- 轻量化 runtime 打包脚本：`apps/desktop/scripts/prepare-runtime.mjs`。
- Tauri 资源配置更新：`apps/desktop/src-tauri/tauri.conf.json`。
- 编译验证：`cd apps/desktop/src-tauri && cargo check -q` 通过。

### 后续动作
- 在目标机器设置或确认 `NODE_INSTALL_CMD`（推荐显式指定），避免仅靠 brew 回退策略。
- 使用实际 `.app` 做两条路径验收：
  - 无 Node/非 24：出现授权弹窗，拒绝后立即退出。
  - 允许安装并成功后：自动拉起 local-service，进入应用主界面。

## 2026-04-17 Q&A 记录 03

### 问题
- 用户在 `apps/desktop` 下执行 `npm run build` 时报错：`Rollup failed to resolve import "@tauri-apps/api/event"`，并在执行 `npm i` 时出现 `Unsupported URL Type "workspace:"`。

### 结论
- 根因 1：仓库是 pnpm workspace（存在 `workspace:*` 依赖），不能用 npm 安装依赖，必须用 pnpm。
- 根因 2：`apps/web/src/App.tsx` 里引用了 `@tauri-apps/api/event`，但 `apps/web/package.json` 未声明 `@tauri-apps/api`，导致构建时解析失败。
- 已修复：在 `apps/web/package.json` 的 `dependencies` 中添加 `@tauri-apps/api`。

### 证据
- 根目录 `package.json` 指定 `packageManager: pnpm@9.0.0`。
- `pnpm-workspace.yaml` 启用 workspace。
- 报错堆栈指向 `apps/web/src/App.tsx` 的 `@tauri-apps/api/event`。
- 代码修改文件：`apps/web/package.json`。

### 后续动作
- 使用 pnpm 重新安装依赖并构建，不再使用 npm：
  - 仓库根目录执行 `pnpm install`
  - 执行 `pnpm --filter @openclaw/desktop build`
  - 执行桌面打包 `cd apps/desktop/src-tauri && cargo tauri build --bundles app --no-sign`

## 2026-04-17 Q&A 记录 04

### 问题
- 用户反馈本机默认 `node -v` 检测到 16，但通过 nvm 已安装 Node 24；希望启动时先尝试 `nvm list/use 24`，若可用则直接继续，不要弹安装授权窗。

### 结论
- 已实现 Node 检测优先级调整：
  1. 先查当前系统 `node` 是否满足要求（默认主版本 24）；
  2. 不满足时，自动在 shell 中加载 nvm 并检测 `nvm version 24`，若存在则执行 `nvm use 24` 并解析 node 路径；
  3. 若 nvm 路径有效，直接使用该 node 启动 local-service，跳过弹窗；
  4. 仅当系统 node 与 nvm 都不可用时，才进入授权安装弹窗。
- 启动命令已支持使用 `LOCAL_SERVICE_NODE_PATH` 指定 node 程序路径（由 nvm 解析后自动注入）。

### 证据
- 代码新增函数：`detect_nvm_node_path`、`detect_node_major_with_program`。
- 代码更新：`ensure_node_runtime_ready` 增加 nvm 优先分支；`default_local_service_cmd` 改为优先读取 `LOCAL_SERVICE_NODE_PATH`。
- 文件：`apps/desktop/src-tauri/src/main.rs`。
- 编译验证：`cd apps/desktop/src-tauri && cargo check -q` 通过。

### 后续动作
- 在本机从 Finder 双击 `.app` 验证：若 nvm 中已有 24，不再出现安装授权弹窗。
- 若仍弹窗，检查用户图形会话下 `HOME/.nvm/nvm.sh` 是否存在且可读。

## 2026-04-17 Q&A 记录 05

### 问题
- 用户反馈 Node 版本问题已解决，但应用界面仍显示 `Load failed/启动失败`。

### 结论
- 根因是打包后资源目录层级与代码预期不一致：实际路径为 `.../Resources/resources/local-service`，而代码只查找 `.../Resources/local-service`，导致 release 启动时判定“local-service 启动命令未配置”。
- 已修复为双路径兼容：优先查 `resource_dir/local-service`，不存在则回退 `resource_dir/resources/local-service`。

### 证据
- 日志证据：`~/Library/Logs/com.guodongsu.localclaw/local-service.log` 中出现 `local-service is not running and no startup command is configured`。
- 打包内容证据：`LocalClaw.app/Contents/Resources/resources/local-service` 存在。
- 代码修复文件：`apps/desktop/src-tauri/src/main.rs`（`default_local_service_cmd`）。
- 编译验证：`cd apps/desktop/src-tauri && cargo check -q` 通过。

### 后续动作
- 重新打包并替换旧 app 后再启动验证：
  - `pnpm --filter @openclaw/desktop prepare:runtime`
  - `cd apps/desktop/src-tauri && cargo tauri build --bundles app --no-sign`
- 若仍失败，优先查看 `~/Library/Logs/com.guodongsu.localclaw/local-service.log` 最新 50 行。

## 2026-04-17 Q&A 记录 06

### 问题
- 用户反馈 local-service 仍未启动，日志持续出现 `local-service is not running and no startup command is configured`。

### 结论
- 深查后根因是 `.app` 包内 `node_modules` 结构与开发目录不同：
  - 包内 `node_modules/tsx` 直链不存在；
  - `tsx` 实际位于 `node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs`。
- 原有启动检查仅验证 `node_modules/tsx/dist/cli.mjs`，导致误判“未配置启动命令”。
- 已修复：新增 `resolve_tsx_cli_path`，优先查直链路径，失败后回退扫描 `.pnpm` 真实路径。

### 证据
- 现场证据：
  - `app_tsx_cli_missing`（直链缺失）；
  - `find .../node_modules -path '*/tsx/dist/cli.mjs'` 命中 `.pnpm/tsx@4.21.0/.../cli.mjs`。
- 代码修复：`apps/desktop/src-tauri/src/main.rs`（`resolve_tsx_cli_path` + `default_local_service_cmd`）。
- 编译验证：`cd apps/desktop/src-tauri && cargo check -q` 通过。

### 后续动作
- 重新打包并运行新 `.app`：
  - `pnpm --filter @openclaw/desktop prepare:runtime`
  - `cd apps/desktop/src-tauri && cargo tauri build --bundles app --no-sign`
- 启动后若仍异常，查看 `~/Library/Logs/com.guodongsu.localclaw/local-service.log` 最新 80 行确认下一跳错误。

## 2026-04-17 Q&A 记录 07

### 问题
- 用户提供最新日志：local-service 启动时报 `Cannot find package 'esbuild' imported from .../tsx/dist/cli.mjs`，随后 20 秒超时。

### 结论
- 根因不是 Node 版本，而是打包后的 local-service 运行依赖不完整：
  - `tsx` 运行时需要 `esbuild/get-tsconfig`；
  - 资源复制后 `node_modules` 的关键 symlink 在打包链路中失效，导致运行时解析不到包。
- 已修复为更稳的准备流程：
  1. `services/local-service` 显式增加 `esbuild` 与 `get-tsconfig` 依赖；
  2. `prepare-runtime.mjs` 不再使用 `pnpm deploy`（该命令在当前环境会错误重写目标路径并触发 EPERM）；
  3. 改为从 `services/local-service` 拷贝运行目录，并将 `node_modules` 顶层/作用域 symlink 实体化为真实目录，避免打包后丢链接。

### 证据
- 日志证据：`~/Library/Logs/com.guodongsu.localclaw/local-service.log` 中明确报错 `ERR_MODULE_NOT_FOUND: Cannot find package 'esbuild'`。
- 环境复现证据：`pnpm deploy` 在本机会错误操作 `/Users/gaozijian/Desktop/apps/...` 并报 EPERM。
- 修复后证据：`apps/desktop/src-tauri/resources/local-service/node_modules` 中 `tsx/esbuild/get-tsconfig` 均存在且为非 symlink 实体目录。
- 编译验证：`cd apps/desktop/src-tauri && cargo check -q` 通过。

### 后续动作
- 重新打包并用新 app 验证启动：
  - `source ~/.nvm/nvm.sh && nvm use 24`
  - `pnpm install --no-frozen-lockfile`
  - `pnpm --filter @openclaw/desktop prepare:runtime`
  - `cd apps/desktop/src-tauri && cargo tauri build --bundles app --no-sign`
- 启动后若仍失败，继续提供 `~/Library/Logs/com.guodongsu.localclaw/local-service.log` 最新 120 行。

## 2026-04-17 Q&A 记录 08

### 问题
- 用户要求将 desktop 发布形态改为：先构建 `local-service` 产物，再把 `dist/` 与生产运行依赖复制到 `apps/desktop/src-tauri/resources/local-service`，避免发布包运行时依赖 `tsx`。

### 结论
- 已落地为 `dist` 运行形态：`services/local-service/package.json` 使用 `build` 产出并通过 `start:prod` 运行 `node dist/index.cjs`。
- 已调整打包脚本：`apps/desktop/scripts/prepare-runtime.mjs` 改为先执行 `@openclaw/shared build + local-service prisma:generate + local-service build`，再复制 `dist` 与运行所需资源。
- 已将运行依赖最小化：构建阶段把 `express/cors/dotenv/zod/@openclaw/shared` 打入 bundle；runtime 仅保留 Prisma 必需依赖（`@prisma/client` 与 `.prisma`），不再依赖 `tsx`。
- 已验证前端构建与 Rust 编译通过，`Cannot find package 'esbuild' from tsx` 路径已不再适用。

### 证据
- 代码改动：
  - `services/local-service/tsup.config.ts`：改为 CJS 产物，bundle 业务依赖，`external: ['@prisma/client']`。
  - `apps/desktop/scripts/prepare-runtime.mjs`：不再复制整包 `node_modules`，改为复制 `dist` 与 Prisma 运行时依赖。
- 构建验证：
  - `pnpm --filter @openclaw/desktop prepare:runtime` 成功。
  - `pnpm --filter @openclaw/desktop build` 成功。
  - `cd apps/desktop/src-tauri && cargo check -q` 成功。
- 运行态检查：`resources/local-service/node_modules` 仅含 `@prisma/client` 与 `.prisma`，并包含 `libquery_engine-darwin-arm64.dylib.node`。

### 后续动作
- 在本机（非沙箱）执行一次完整打包并双击 `.app` 验证启动：
  - `source ~/.nvm/nvm.sh && nvm use 24`
  - `pnpm --filter @openclaw/desktop prepare:runtime`
  - `cd apps/desktop/src-tauri && cargo tauri build --bundles app --no-sign`
- 若仍启动失败，先查看 `~/Library/Logs/com.guodongsu.localclaw/local-service.log` 最新 120 行定位下一跳。

## 2026-04-17 Q&A 记录 09

### 问题
- 启动后过早进入主界面，随后持续触发“列模型”请求，用户体验上表现为一直在调模型；期望改为先完成环境配置/模型准备，再进入应用，并在过程中显示“正在配置环境”。
- 已定位真实崩点：local-service 已启动，但“列模型”调用触发了另一套 OpenClaw/Node 运行时，落到 Homebrew node@22，最终被缺失 `simdjson` 动态库击穿。

### 结论
- 已在前端加入启动门禁：当 `config` 已就绪且 `onboarded=true` 时，应用会先预热 `listAgentModels`，成功后才进入主界面；预热过程中显示“正在配置环境”。
- 已将模型列表预热结果写入 React Query 缓存，并将模型列表查询设置为 `staleTime=60s`，减少进入页面后立即重复调模型。
- 已在 local-service 侧统一 OpenClaw 子进程环境：所有 `openclaw` 命令执行时优先把当前运行 Node（`LOCAL_SERVICE_NODE_PATH` 或 `process.execPath`）所在目录前置到 `PATH`，避免回落到 Homebrew node@22。
- 已覆盖调用面：`openclaw/cli.ts`、`openclaw/realAdapter.ts`、`openclaw/installer.ts` 的 spawn 均使用统一环境构造函数。

### 证据
- 新增文件：`services/local-service/src/openclaw/runtimeEnv.ts`（统一构建 OpenClaw 子进程 env，前置 Node 运行时 PATH）。
- 修改文件：
  - `services/local-service/src/openclaw/cli.ts`
  - `services/local-service/src/openclaw/realAdapter.ts`
  - `services/local-service/src/openclaw/installer.ts`
  - `apps/web/src/App.tsx`
  - `apps/web/src/hooks/useAgent.ts`
  - `apps/web/src/i18n.ts`
- 构建验证通过：
  - `pnpm --filter @openclaw/local-service build`
  - `pnpm --filter @openclaw/web build`
  - `cd apps/desktop/src-tauri && cargo check -q`

### 后续动作
- 在本机重新打包并双击 `.app` 验证：启动页先显示“正在配置环境”，仅在模型列表可用后进入主界面。
- 若仍异常，抓取 `~/Library/Logs/com.guodongsu.localclaw/local-service.log`，重点看 `openclaw models list` 的 stderr 是否仍包含 node@22/simdjson 相关信息。

## 2026-04-17 Q&A 记录 10

### 问题
- 用户确认真实故障点在 `OpenClawRealAdapter.listModels()`：local-service 虽已由 Node24 启动，但列模型时又走到另一条 OpenClaw/Node 调用链，实际落到 Homebrew `node@22`，并因 `libsimdjson.31.dylib` 缺失崩溃。
- 用户要求处理策略：凡涉及 Node 的调用，默认先执行 `nvm use` 再执行目标命令。

### 结论
- 已新增统一运行时策略：
  1. 所有 shell 命令默认包裹 `nvm use <required-major>`（macOS/Linux 下默认主版本来自 `NODE_REQUIRED_MAJOR`，缺省 24）；
  2. `runOpenClawCommand` 不再盲目直接 `spawn(openclaw, ...)`，而是先解析 `openclaw` 可执行路径；若识别为 Node shebang 脚本或 shell wrapper（内部 `exec ...node ...script`），则改为显式 `Node24 + script` 启动，避免回退到 Homebrew node@22。
- 已保持 `LOCAL_SERVICE_NODE_PATH/process.execPath` 作为统一 Node 运行时来源，并继续将其目录前置到 `PATH`。

### 证据
- 关键代码变更：
  - `services/local-service/src/openclaw/runtimeEnv.ts`
    - 新增 `withNvmUse()`、`buildOpenClawLaunch()` 及 openclaw wrapper 解析逻辑。
  - `services/local-service/src/openclaw/realAdapter.ts`
    - `runOpenClawCommand()` 改为使用 `buildOpenClawLaunch()` 生成真实 program/args。
    - 自定义 shell run 模板命令执行前也包裹 `withNvmUse()`。
  - `services/local-service/src/openclaw/cli.ts`
    - `runCommand()` 默认 `withNvmUse(command)`。
  - `services/local-service/src/openclaw/installer.ts`
    - `runShell()` 与 `startGateway()` 默认 `withNvmUse(command)`。
- 编译验证通过：
  - `pnpm --filter @openclaw/local-service build`
  - `pnpm --filter @openclaw/web build`
  - `cd apps/desktop/src-tauri && cargo check -q`

### 后续动作
- 重新打包后启动 `.app`，重点观察日志中的 `openclaw models list` 是否还出现 `/opt/homebrew/Cellar/node@22/...`。
- 若仍出现，补充日志最新 120 行，继续沿着 `openclaw` wrapper 路径做针对性兼容（例如更复杂的 shell wrapper 语法）。

## 2026-04-17 Q&A 记录 11

### 问题
- 启动页在“正在检查模型运行环境并加载模型列表”长期卡住，日志只看到会话轮询（`Listed 1 sessions...`），用户无法进入界面。
- 需要实现：模型检查有上限等待并可降级放行；`onboarded` 改为真实可用配置判定；`/api/agent/models` 不悬挂且可观测；继续保持 Node24/nvm 运行时优先。

### 结论
- 已实现启动门禁降级：前端模型检查采用 5 秒超时（`AbortController`）+ 有限重试（2 次）；失败/超时/未配置时不再阻塞启动页，放行进入应用并显示非阻塞提示。
- 已实现后端 `agent models` 路由容错：引入统一 async handler，避免 Express4 async 抛错导致请求悬挂；`/api/agent/models` 采用 8 秒超时，并返回 `ready/reason` 元信息。
- 已实现模型接口降级语义：在未配置、超时、CLI 暂不可用等可恢复场景下返回 `200 + { models: [], ready: false, reason }`；真正系统错误继续走 5xx。
- 已收紧 `onboarded` 判定：不再只看 `openclaw.json` 文件存在，需满足“有 primary model 且具备运行所需 key（本地密文 key 或 provider.apiKey；ollama 例外）”。

### 证据
- 后端改动：
  - `services/local-service/src/modules/agent/agentRouter.ts`
    - 统一 `asyncHandler`；`/models` 增加 8s 超时、结构化日志、降级返回（`ready/reason`）。
  - `services/local-service/src/openclaw/adapter.ts`
    - `listModels(options?: { timeoutMs?: number })`。
  - `services/local-service/src/openclaw/realAdapter.ts`
    - `listModels` 支持超时参数透传。
  - `services/local-service/src/openclaw/mockAdapter.ts`
    - 接口签名同步。
  - `services/local-service/src/services/settingsService.ts`
    - `hasOpenClawConfig` 改为“可用配置”判定。
- 前端改动：
  - `apps/web/src/api/client.ts`
    - `listAgentModels` 返回 `models + ready + reason`，支持传入 `RequestInit`（用于 `signal`）。
  - `apps/web/src/App.tsx`
    - 模型检查 5s 超时 + 有限重试 + 降级放行 + 非阻塞提示条。
  - `apps/web/src/i18n.ts`
    - 新增模型未就绪/超时/CLI 未就绪提示文案。
- 构建验证通过：
  - `pnpm --filter @openclaw/local-service build`
  - `pnpm --filter @openclaw/web build`
  - `cd apps/desktop/src-tauri && cargo check -q`

### 后续动作
- 重新打包并启动 `.app` 验证：
  - 新装无模型/无 key 场景应进入 Onboarding 或主界面（带非阻塞提示），不再无限卡启动页。
- 若仍异常，抓取 `~/Library/Logs/com.guodongsu.localclaw/local-service.log`，重点查看 `agent.models` 的 `start/finish/failed` 结构化日志与 `reason`。

## 2026-04-17 Q&A 记录 12

### 问题
- 用户反馈：进入主界面后又退回“正在配置环境”窗口，出现来回跳转。

### 结论
- 根因是前端启动检查 effect 的依赖中使用了 `t`，而 `useI18n()` 每次渲染都创建新的 `t` 函数引用，导致 effect 被频繁重新触发。
- 该 effect 每次触发都会先执行 `setModelsReady(false)`，从而把界面重新拉回“正在配置环境”。
- 已修复：将 `useI18n` 中的 `t` 用 `useCallback([locale])` 稳定化，避免同语言下渲染导致函数引用抖动。

### 证据
- 修复文件：`apps/web/src/i18n.ts`。
- 构建验证：`pnpm --filter @openclaw/web build` 通过。

### 后续动作
- 使用新包再次验证：进入主界面后不应再因普通渲染回退到“正在配置环境”。
- 若仍回退，继续抓取当时的前端控制台日志和 `local-service.log`，定位是否存在真正的 `config` 或 `onboarded` 状态变化。

## 2026-04-26 Q&A 记录 13

### 问题
- 用户询问 `apps/desktop/src-tauri/target/release` 目录中的安装包分别对应什么平台，希望简要说明 mac/win 等差异。

### 结论
- 当前目录里只有 macOS 构建产物，没有看到 Windows 安装包。
- `target/release/LocalClaw` 是 macOS 的原生可执行文件，不是安装包。
- `target/release/bundle/macos/LocalClaw.app` 是 macOS 应用包，可直接在 Finder 中作为应用运行。
- 未发现常见 Windows 打包结果，例如 `.exe`、`.msi` 或 `bundle/nsis`、`bundle/msi` 目录。

### 证据
- `ls -lah apps/desktop/src-tauri/target/release` 显示：`LocalClaw`、`LocalClaw.d`、`bundle`、`deps`、`resources`。
- `file apps/desktop/src-tauri/target/release/LocalClaw` 结果为 `Mach-O 64-bit executable arm64`，说明它是 Apple Silicon 的 macOS 二进制。
- `find apps/desktop/src-tauri/target/release/bundle/macos -maxdepth 4 -type f -o -type d` 显示存在 `LocalClaw.app/Contents/...`，属于标准 macOS `.app` 结构。
- `bundle` 目录下仅有 `macos` 子目录，没有 `windows`、`msi`、`nsis` 等 Windows 打包目录。

### 后续动作
- 如需 Windows 安装包，需要在 Windows 环境或对应交叉打包链路下执行 Tauri 打包，产物通常会出现在 `bundle/msi` 或 `bundle/nsis`。
- 如需给用户分发 macOS 安装包，可以继续检查是否生成 `.dmg`；当前目录里还没有看到 `.dmg` 文件。

## 2026-04-26 Q&A 记录 14

### 问题
- 用户追问为什么当前不是正式的 macOS `.dmg` 下载包。

### 结论
- 直接原因是这个项目此前采用的打包命令就是只生成 `.app`：`cargo tauri build --bundles app --no-sign`，没有要求输出 `.dmg`。
- 当前 `tauri.conf.json` 里也没有显式配置 `bundle.targets` 为 `dmg`，所以仓库配置层面没有把 `.dmg` 作为默认目标固定下来。
- `.app` 是可运行的 macOS 应用包，适合开发机本地验证；`.dmg` 更像对外分发用的安装镜像容器。
- 即使生成了 `.dmg`，如果仍然是 `--no-sign` 且未公证，也通常不能算严格意义上的“正式发行包”。

### 证据
- `apps/desktop/src-tauri/tauri.conf.json` 的 `bundle` 段目前只有 `resources`，未见 `targets: ["dmg"]` 等配置。
- `summary.md` 历史记录明确写过打包命令：`cargo tauri build --bundles app --no-sign`。
- 同一处历史记录也写明：若要 `.dmg`，需改为 `cargo tauri build --bundles app,dmg --no-sign`。
- 当前产物目录 `apps/desktop/src-tauri/target/release/bundle` 下只有 `macos/LocalClaw.app`，没有 `.dmg` 文件。

### 后续动作
- 如果目标是内部测试，继续保留 `.app` 即可，路径更直接。
- 如果目标是用户下载分发，改用 `cargo tauri build --bundles app,dmg`，再补签名与 notarization。
- 如需，我可以继续把仓库默认打包流程改成输出 `.dmg`，并顺手补一个发布说明。

## 2026-05-02 Q&A 记录 15

### 问题
- 用户询问为什么直接把 `apps/desktop/src-tauri/target/release/LocalClaw.d` 放到 MacBook 中无法正常打开。

### 结论
- `LocalClaw.d` 不是 macOS 应用，也不是可执行文件；它是 Rust/Tauri 构建过程中生成的依赖描述文件。
- 真正可运行的二进制是 `apps/desktop/src-tauri/target/release/LocalClaw`。
- 更适合拷贝到另一台 Mac 的是 `apps/desktop/src-tauri/target/release/bundle/macos/LocalClaw.app`，而不是 `.d` 文件。
- 当前二进制是 `arm64` 架构；如果目标 Mac 是 Intel 芯片，也不能直接运行这个二进制。

### 证据
- `file apps/desktop/src-tauri/target/release/LocalClaw.d` 返回 `ASCII text, with very long lines`，说明它只是文本文件。
- `sed -n '1,40p' apps/desktop/src-tauri/target/release/LocalClaw.d` 内容是 `LocalClaw` 对前端资源、Rust 源码和 `resources/local-service` 的依赖清单。
- `ls -la apps/desktop/src-tauri/target/release` 显示同目录下存在可执行文件 `LocalClaw` 以及 `bundle` 目录。
- `find apps/desktop/src-tauri/target/release/bundle/macos/LocalClaw.app -maxdepth 3 -type f` 显示存在标准 macOS 应用包结构，包括 `Contents/MacOS/LocalClaw` 和 `Contents/Info.plist`。
- `codesign -dv --verbose=4 apps/desktop/src-tauri/target/release/LocalClaw` 显示该可执行文件为 `Mach-O thin (arm64)`。

### 后续动作
- 如果只是本机测试，优先运行 `target/release/bundle/macos/LocalClaw.app`。
- 如果要分发给别人，建议生成 `.app` 或 `.dmg`，不要分发 `.d`。
- 如果对方 Mac 打开 `.app` 仍失败，继续检查是否是架构不匹配、Gatekeeper 拦截、未签名或资源目录缺失。

## 2026-05-02 Q&A 记录 16

### 问题
- 用户要求实现 Apple Silicon macOS 临时分享包与下载验证计划，包括默认输出 `.app + .dmg`、签名与 notarization 前置检查、可重复执行的发布命令，以及下载后在干净 Mac 上验证配置流程的说明。

### 结论
- 已将桌面端默认打包目标改为 `app + dmg`，并新增一套可重复执行的 macOS 发布脚本链路。
- 新增的发布入口会自动尝试通过 `nvm` 切换到 Node 24，再执行 `cargo tauri build --ci --target aarch64-apple-darwin --bundles app,dmg`。
- 发布脚本会强制检查 `APPLE_SIGNING_IDENTITY` 和 notarization 凭据，随后验证 `codesign`、`spctl`、`stapler`，计算 DMG 的 SHA-256，并可选执行上传命令生成下载链接。
- 目前本机未配置 `APPLE_SIGNING_IDENTITY`，所以实际打包流程已推进到签名前置检查并按预期停止，尚未生成最终 notarized `.dmg`。

### 证据
- 配置更新：`apps/desktop/src-tauri/tauri.conf.json` 的 `bundle.targets` 已加入 `["app", "dmg"]`。
- 脚本更新：新增 `apps/desktop/scripts/release-macos.mjs`、`apps/desktop/scripts/release-macos.sh`、`scripts/release-desktop-macos.sh`。
- 命令入口更新：`apps/desktop/package.json` 新增 `release:macos`，根 `package.json` 新增 `release:desktop:macos`。
- 文档更新：新增 `docs/macos-apple-silicon-release.md`，覆盖环境变量、命令、产物、下载分享钩子和干净机验证步骤。
- 本机验证：
  - `node apps/desktop/scripts/release-macos.mjs` 在默认 Node 16 下按预期报错 `Node.js 24.x is required`。
  - `bash ./scripts/release-desktop-macos.sh` 能自动切到 nvm 的 Node 24，并进一步报错 `APPLE_SIGNING_IDENTITY is required for signed macOS builds.`，说明发布入口与前置检查已生效。

### 后续动作
- 在本机导入或配置可用的 Apple Developer 签名身份，并设置 notarization 环境变量后重新执行 `bash ./scripts/release-desktop-macos.sh`。
- 如需自动生成下载链接，设置 `LOCALCLAW_SHARE_COMMAND`，让其上传最终 `.dmg` 并将 URL 输出到 stdout。
- 生成最终 DMG 后，按 `docs/macos-apple-silicon-release.md` 中的干净机验证步骤完成“下载 -> 安装 -> 打开 -> 配置 -> 检查日志”测试。

## 2026-05-02 Q&A 记录 17

### 问题
- 用户询问当前 macOS 发布链路是否已经可以直接使用，还是还需要继续做手动配置。

### 结论
- 发布脚本和文档已经可以直接用，但前提是先补齐 Apple 签名和 notarization 凭据。
- 当前仓库代码层面已经完成；真正未完成的是本机发布环境配置。
- 如果不配置 `APPLE_SIGNING_IDENTITY` 和 notarization 相关环境变量，脚本会在前置检查阶段停止，不能产出最终可分发的 notarized `.dmg`。

### 证据
- 新增的 `bash ./scripts/release-desktop-macos.sh` 已能自动切换到 Node 24 并进入发布流程。
- 上次本机执行结果停在 `APPLE_SIGNING_IDENTITY is required for signed macOS builds.`，说明代码链路正常，阻塞点是发布凭据。
- `docs/macos-apple-silicon-release.md` 已明确列出所需环境变量和执行命令。

### 后续动作
- 先配置 Apple 签名身份与 notarization 环境变量。
- 如需自动生成下载链接，再额外配置 `LOCALCLAW_SHARE_COMMAND`。
- 然后执行 `bash ./scripts/release-desktop-macos.sh` 开始正式打包。

## 2026-05-02 Q&A 记录 18

### 问题
- 用户说明暂时不做 Apple 签名和 notarization，询问是否可以先按未签名方案用于个人测试、内测和朋友试用。

### 结论
- 可以。对个人测试、内测、朋友试用来说，先用未签名的 `.app` 或 `.dmg` 是可行的。
- 这种方案的代价是目标 Mac 上大概率会遇到 Gatekeeper 拦截，需要右键“打开”或在系统设置里手动放行一次。
- 因此它适合小范围试用，不适合正式公开分发。

### 证据
- 仓库历史中此前一直使用 `cargo tauri build --bundles app --no-sign` 进行本地打包验证。
- 当前项目已经支持输出 `.app + .dmg`，只是正式签名公证链路还依赖 Apple 凭据。
- 之前排查已确认真正可运行和可分发的产物应是 `bundle/macos/LocalClaw.app` 或生成后的 `.dmg`，不是 `LocalClaw.d`。

### 后续动作
- 如果只做小范围试用，可继续使用未签名构建产物并附带一段“首次打开需手动放行”的说明。
- 如果后续要扩大分发范围，再切换到签名和 notarization 流程。

## 2026-05-02 Q&A 记录 19

### 问题
- 用户询问当前仓库下“现在打包的正确流程是什么”。

### 结论
- 当前正确流程分成两种：未签名小范围试用流程，以及签名公证的正式分发流程。
- 小范围试用时，最直接的是在 `apps/desktop/src-tauri` 下执行 `cargo tauri build --bundles app,dmg --no-sign`。
- 正式分发时，应先配置 Apple 签名与 notarization 环境变量，再执行 `bash ./scripts/release-desktop-macos.sh`。
- 当前仓库默认目标已包含 `app + dmg`，真正可分发的产物在 `apps/desktop/src-tauri/target/release/bundle/` 下，而不是 `LocalClaw.d`。

### 证据
- `apps/desktop/src-tauri/tauri.conf.json` 的 `bundle.targets` 已配置为 `["app", "dmg"]`。
- 仓库新增了 `apps/desktop/scripts/release-macos.mjs`、`apps/desktop/scripts/release-macos.sh`、`scripts/release-desktop-macos.sh`，用于正式发布流程。
- 历史验证中，未签名方案一直基于 `cargo tauri build --bundles app --no-sign`；当前已扩展为 `app,dmg`。

### 后续动作
- 如果只是自己和朋友试用，直接执行未签名构建即可。
- 如果要给更多人稳定下载，后续补齐 Apple 凭据并走正式发布脚本。

## 2026-05-02 Q&A 记录 20

### 问题
- 用户在执行 Tauri 打包时遇到 `vite: command not found` 和 `Local package.json exists, but node_modules missing`，需要定位并修复当前打包前置流程。

### 结论
- 根因一是当前 shell 使用 `Node v16.13.0`，与当前 `pnpm` 版本不兼容。
- 根因二是工作区依赖未安装，导致 `apps/web` 的 `vite` 不存在。
- 在安装依赖后，又暴露出一个脚本缺陷：`apps/desktop/scripts/prepare-runtime.mjs` 强制复制 `services/local-service/.env`，但仓库默认只有 `.env.example`，因此首次打包会失败。
- 已修复：安装了工作区依赖，并将 `prepare-runtime.mjs` 改为“`.env` 存在则复制，不存在则跳过”。
- 当前 `beforeBuildCommand` 所依赖的两步都已验证通过：`pnpm --filter @openclaw/web build` 和 `pnpm --filter @openclaw/desktop prepare:runtime`。

### 证据
- 环境检查：
  - `pnpm -v && node -v` 在默认 shell 下报错，显示当前 Node 为 `v16.13.0`，不满足 `pnpm` 要求。
  - `nvm version 24` 返回 `v24.15.0`，说明本机已有可用的 Node 24。
- 依赖状态：
  - 根目录和 `apps/web` 初始都没有 `node_modules`。
  - 已执行 `pnpm install` 完成工作区依赖安装。
- 构建验证：
  - `pnpm --filter @openclaw/web build` 成功，输出 `apps/web/dist/...`
  - `pnpm --filter @openclaw/desktop prepare:runtime` 成功，输出 `[desktop] runtime prepared`
- 代码修复：
  - `apps/desktop/scripts/prepare-runtime.mjs` 现在不再强依赖缺失的 `.env` 文件。

### 后续动作
- 后续打包前，先确保当前 shell 切到 Node 24，例如 `nvm use 24`。
- 小范围试用继续执行：`cd apps/desktop/src-tauri && cargo tauri build --bundles app,dmg --no-sign`
- 如果需要，我可以继续直接帮你把完整的未签名 `.dmg` 打包命令跑完。

## 2026-05-02 Q&A 记录 21

### 问题
- 用户要求将当前可用的本地测试配置写入 `.env`，并继续完成未签名打包流程。

### 结论
- 已新增 `services/local-service/.env`，采用适合个人测试/内测的最小配置：`OPENCLAW_MODE=mock`、`NODE_REQUIRED_MAJOR=24`、`LOG_LEVEL=info` 等。
- 使用该配置后，Tauri 的 `beforeBuildCommand` 已完整通过，`LocalClaw.app` 成功构建。
- Tauri 自带的 `bundle_dmg.sh` 在当前环境下仍失败，但这不影响 `.app` 本体。
- 已改用更朴素的 `hdiutil create` 方式额外生成一个可分享的未签名 DMG：`LocalClaw_0.1.0_aarch64_simple.dmg`。

### 证据
- 新增文件：`services/local-service/.env`
- `cargo tauri build --bundles app,dmg --no-sign` 输出显示：
  - `Built application at: .../target/release/LocalClaw`
  - `Bundling LocalClaw.app ...` 成功
  - 失败点仅在 `bundle_dmg.sh`
- 手工 DMG 生成成功：
  - `hdiutil create ... LocalClaw_0.1.0_aarch64_simple.dmg`
  - 输出 `created: /Users/gaozijian/Desktop/AI/LocalClaw/apps/desktop/src-tauri/target/release/bundle/dmg/LocalClaw_0.1.0_aarch64_simple.dmg`
- 当前产物状态：
  - `.app`：`apps/desktop/src-tauri/target/release/bundle/macos/LocalClaw.app`
  - `.dmg`：`apps/desktop/src-tauri/target/release/bundle/dmg/LocalClaw_0.1.0_aarch64_simple.dmg`
  - `codesign -dv` 显示 `.app` 为 `app bundle with Mach-O thin (arm64)`，签名状态为 `adhoc`

### 后续动作
- 个人测试、内测、朋友试用可直接使用当前 `.app` 或 `LocalClaw_0.1.0_aarch64_simple.dmg`。
- 首次打开时需要提醒对方手动放行未签名应用。
- 如果后续要修复 Tauri 自带的 fancy DMG 流程，再单独处理 `bundle_dmg.sh` 的 Finder/AppleScript 环节。

## 2026-05-02 Q&A 记录 22

### 问题
- 用户要求补一套 Windows 版打包支持。

### 结论
- 已补齐 Windows 专用打包配置与脚本，但当前这台 macOS 主机不能直接产出 Windows 安装包。
- 仓库现在支持在 Windows 主机上构建未签名的 `nsis` 安装器（`.exe`）和 `msi` 安装包（`.msi`）。
- Windows 版默认使用 `downloadBootstrapper` 模式安装 WebView2，适合朋友试用和内测。

### 证据
- 新增文件：
  - `apps/desktop/src-tauri/tauri.windows.conf.json`
  - `apps/desktop/scripts/release-windows.ps1`
  - `scripts/release-desktop-windows.ps1`
  - `docs/windows-release.md`
- 脚本入口：
  - `apps/desktop/package.json` 新增 `release:windows`
  - 根 `package.json` 新增 `release:desktop:windows`
- 本机验证结果：
  - `cargo tauri build --help` 在当前 macOS 主机仅暴露 `app,dmg` bundling
  - 已安装 Rust target 只有 `aarch64-apple-darwin`
  - 因此未在本机实际生成 Windows 包；当前实现属于“仓库支持已落地，待 Windows 主机执行”

### 后续动作
- 在 Windows 机器上准备 Node 24、pnpm、Rust/Tauri 环境后执行：
  - `powershell -ExecutionPolicy Bypass -File .\scripts\release-desktop-windows.ps1`
  - 或 `pnpm release:desktop:windows`
- 产物将出现在：
  - `apps/desktop/src-tauri/target/release/bundle/nsis/`
  - `apps/desktop/src-tauri/target/release/bundle/msi/`
- 如果后续需要正式分发，再额外补 Windows 代码签名。

## 2026-05-13 Q&A 记录 23

### 问题
- 用户要求检查这个项目里哪些内容没有上传到 GitHub，并把这些规则优化写入 `.gitignore`。

### 结论
- 已优化根目录 `.gitignore`，将依赖目录、构建产物、环境变量文件、本地历史目录和 Tauri 运行时资源改为更通用的递归忽略规则。
- 当前明确不会上传到 GitHub 的内容主要包括：各层级 `node_modules/`、`dist/`、`build/`、`coverage/`、`.env` 文件、`.DS_Store`，以及 `apps/desktop/src-tauri/resources/runtime/` 下的生成内容。
- 仓库里还存在 5330 个“已被 Git 跟踪但现在匹配忽略规则”的文件；其中 5328 个在 `apps/desktop/src-tauri/target/`，2 个在 `.history/services/local-service/`。这些内容不会因为新增 `.gitignore` 自动从 GitHub 消失，后续需要单独执行索引清理。

### 证据
- 已修改文件：`.gitignore`
- 新增规则位置：
  - 依赖忽略：`.gitignore:1-3`
  - 构建产物忽略：`.gitignore:5-14`
  - 环境文件忽略且保留 `.env.example`：`.gitignore:16-22`
  - 本地历史与桌面运行时资源忽略：`.gitignore:29-33`
- `git status --short --ignored` 显示当前被忽略的典型内容包括：
  - `services/local-service/.env`
  - `services/local-service/dist/`
  - `apps/web/dist/`
  - `apps/desktop/src-tauri/resources/local-service/node_modules/`
  - `apps/desktop/src-tauri/target/release/resources/local-service/.env`
- `git ls-files -ci --exclude-standard | wc -l` 结果为 `5330`
- `git ls-files -ci --exclude-standard` 聚合后主要来源为：
  - `5328 apps/desktop/src-tauri`
  - `2 .history/services/local-service`

### 后续动作
- 如需让 `target/` 和 `.history/` 中已跟踪内容也停止上传，后续执行一次 `git rm --cached -r apps/desktop/src-tauri/target .history`，再提交。
- 如果你要，我下一步可以继续帮你清一版“已被跟踪但应该移出仓库”的文件，并给出最小化提交方案。
