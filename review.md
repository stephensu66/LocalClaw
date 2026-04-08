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
