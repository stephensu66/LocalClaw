# OpenClaw Wrapper Project Assessment & Plan

## 项目定位（基于现有实现）
- 目标形态是“本地单机 OpenClaw 产品化壳层”，包含 Web 控制台、Desktop 壳层与 Local Service。核心是把 OpenClaw 的 CLI/网关封装成可视化、可配置、可控的本地服务。
- 当前结构：`apps/web`（Web UI）、`apps/desktop`（Tauri 壳层）、`services/local-service`（REST + SSE + Prisma）、`packages/shared`（DTO/Schema）。

## 当前已实现能力概览（关键实现点）
- 多模型接入与切换：已实现。通过 UI 选择模型提供商与 API Key，服务端写入本地配置并同步到 OpenClaw。
实现文件：[providerMap.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/openclaw/providerMap.ts)，[settingsService.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/services/settingsService.ts)，[realAdapter.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/openclaw/realAdapter.ts)。
- OpenClaw 自动安装与网关启动：已实现。若本地无二进制则自动安装，可选自动 onboarding 与 gateway 启动。实现文件：[installer.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/openclaw/installer.ts)。
- Skill 安装/发现/调用：部分实现。已能将本地技能目录写入 OpenClaw 配置（`skills.load.extraDirs`），但 UI 未提供安装与管理入口。目前只内置一个 `file-write-guard` 技能。实现文件：[realAdapter.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/openclaw/realAdapter.ts)。
- Skill 安全与权限控制：部分实现。Local Service 有权限系统（FILE_READ/WRITE、SHELL_EXEC、INTERNET_ACCESS 等），任务创建会校验权限，UI 可开关，但与 OpenClaw 内部工具权限尚未做细粒度绑定。实现文件：[permissionService.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/modules/permissions/permissionService.ts)，[Permissions.tsx](/Users/gaozijian/Desktop/AI/openclaw-plugins/apps/web/src/pages/Permissions.tsx)。
- 任务管理与日志：已实现。任务创建、状态更新、日志流（SSE），UI 可查看任务列表与日志。实现文件：[taskService.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/modules/tasks/taskService.ts)，[Tasks.tsx](/Users/gaozijian/Desktop/AI/openclaw-plugins/apps/web/src/pages/Tasks.tsx)。
- 安全与本地密钥管理：已实现。API Key AES-256-GCM 本地加密，密钥保存在 `~/.openclaw/secret.key`。实现文件：[encryption.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/utils/encryption.ts)，说明文档：`docs/SECURITY.md`。
- Web 搜索能力接入：已补齐配置通道，可通过 env 写入 `tools.web.search` / `tools.web.fetch` 并在问题触发时要求 tool-use，提升失败可诊断性。实现文件：[realAdapter.ts](/Users/gaozijian/Desktop/AI/openclaw-plugins/services/local-service/src/openclaw/realAdapter.ts)。

## P0 能力覆盖（“能稳定干活”）
- 多模型接入与切换：已实现。
- Skill 安装、发现、调用：部分实现。只支持额外技能目录接入，缺 UI 侧安装/管理/卸载与调用可视化。
- Skill 安全与权限控制：部分实现。有本地权限表，但与 OpenClaw 内部工具控制还未打通。
- 个人知识库接入：未实现。没有向量库、文档索引或检索管线。
- 检索优先级控制：未实现。无 RAG 检索路由或优先级策略。
- 分层记忆能力：未实现。仅有任务日志与数据库记录。
- 工作流编排：未实现。只有单次任务执行，无多步骤流程定义。
- 人机协作节点：部分实现。任务发起、日志回传与结果展示已具备，但没有明确“人工审批节点”。
- 结果产出能力：部分实现。结果以 JSON 存储并展示，没有产物归档、导出、模板等。
- 成本控制：部分实现。可切换模型与 API Key，但没有成本统计或预算机制。
- 稳定性与可回滚：部分实现。任务状态、日志记录和权限保护存在，但缺重试/回滚策略与健康监控。
- 基础连接外部系统：部分实现。已有 web_search/web_fetch 管道，但缺外部系统集成框架（邮件、数据库、IM 等）。

## P1 能力覆盖（“真正好用且可扩展”）
- 主动任务与定时调度：未实现。无 scheduler/cron。
- 写作风格学习：未实现。无个性化样式配置或学习模块。
- 追问式需求澄清：未实现。缺基于规则或模板的追问流程。
- 自动更新用户画像 / CoreFiles：未实现。缺记忆系统与画像存储。
- 自动发布与外部执行：未实现。缺发布通道与执行器。
- 可视化工作流界面：未实现。缺流程建模 UI。
- 工作流模板市场：未实现。
- 更强的多模态处理：未实现。UI 支持文件上传，但后端没有多模态处理链路。
- 执行可解释与回放：未实现。缺完整事件回放与工具调用记录。
- 面向非开发者的一键配置：部分实现。已有 onboarding UI，但不包含模型/技能/检索等一键向导。

## 需要补齐的关键能力与建议做法
- 个人知识库与检索优先级：引入本地向量库（SQLite+FAISS/Chroma）与文档入库流程；建立检索路由规则（本地知识优先、互联网 fallback）。
- 分层记忆：加入短期记忆（会话级缓存）与长期记忆（持久化向量）；引入记忆策略与过滤规则。
- 工作流编排与人机协作：定义 workflow schema（步骤、条件、审批、工具）；UI 提供流程编排与节点确认。
- Skill 生态：UI 中提供安装/启用/禁用/升级、可信签名与权限提示。
- 稳定性与可回滚：引入任务重试策略、失败恢复、失败日志聚合；健康检查和状态告警。
- 成本控制：记录模型调用成本、每任务预算上限与预警。
- 基础外部系统连接：统一外部连接插件接口（邮件、IM、数据库、云盘等）。

## 分阶段计划（执行优先级）
1. P0-A：把“稳定干活”跑通。增强配置向导：一键选择模型+Key+工作目录+web_search；统一工具权限控制：本地权限映射到 OpenClaw tool policy；任务执行可诊断：补齐失败原因与工具调用记录；技能管理界面：列出本地技能、启用/禁用、来源路径。
2. P0-B：补齐知识库与检索链路。建立本地知识库数据模型与 API；文档导入、增量索引、检索优先级策略；支持本地知识 + web_search 的策略组合。
3. P0-C：基础工作流与协作节点。设计 workflow schema 与执行器；增加“人工确认节点”与“审批后继续”机制。
4. P1：增强可用性与扩展性。定时任务与主动提醒；风格学习与画像更新；工作流可视化与模板市场；更强的多模态处理与可回放。

## 计划产物（建议）
- Core roadmap：P0 打通稳定执行链路，P1 做增强与生态。
- API Contract：知识库、workflow、技能管理、调度。
- 安全与权限策略：工具级权限映射与审计。
