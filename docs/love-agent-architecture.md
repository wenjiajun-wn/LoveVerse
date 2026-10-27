# LoveVerse V3：只读回忆助手

## 范围与复用

沿用 Next.js App Router、React、TypeScript、Tailwind/Motion/Three.js，无新增运行依赖。复用 V2 privateRoute、IdentityContext、MemoryService、Markdown 仓库、搜索、详情弹窗与图片接口。分支 feat/love-agent-v3 保留未提交的 V2 更改，不迁移原数据。

## 数据流与文件

1. `src/components/love-agent.tsx` 展示双人同意、逐条授权、聊天和来源；公开 demo 不调用私人 API。
2. `/api/agent/consent` GET/PUT 与 `/api/agent/chat` POST 均复用 privateRoute；写操作验证 Origin，输入严格校验。
3. `src/lib/agent/consent.ts` 验证两位成员共同同意及逐条版本授权；`budget.ts` 预留请求限额。
4. `service.ts` 只先发送当前问题与系统规则；`provider.ts` 调用 DeepSeek；模型决定请求 `tools.ts` 的三个只读工具。
5. 工具只调用 MemoryService；每次工具、模型调用前、发布答案前均复查身份、共同许可与版本。
6. 回答结构化校验后才返回；来源按钮通过 V2 API 重新读取，使用已有 MemoryDetail，附带引用片段与序号。

## 私人内容与双方同意

V2 是单个情侣共享空间，不是多租户。两名成员共享 V2 读写权，AI 增加更严格的共同许可；请求不能提交 userId 冒充另一人。IdentityContext 必须由已有认证产生。

现有 visibility=private 回忆默认全部禁止外发，不改 Markdown。额外许可保存在忽略的 `private/state/agent-consent.json`，由 V2 原子写、锁与备份保护。每位成员只能修改自己的许可。两人都 enabled 且都选中同一 id/revision 才可外发；单账号环境不能启用。账号或密码变化使旧许可失效。编辑任何回忆后需要重新授权。

扩展 metadata 的 `secret: true`、`sensitivity: secret`、`allowThirdParty: false` 均强制禁止外发。普通 private 记录需明确 opt-in。发送字段仅包含标题、日期、地点、有限正文、逻辑来源与版本；不发送照片、未选记录、原始 metadata、邮箱、磁盘路径。

任一方可撤销，阻止后续调用和尚未发布的答案；已发送的云端请求和已到达对方浏览器的内容不可撤回。双方应自行确认提供方隐私政策。管理员还可设置 LOVEVERSE_AI_ENABLED=false 并重启停用。

## DeepSeek 协议与预算

AIProvider 是可替换接口；当前 DeepSeekProvider 使用 Node fetch，默认 deepseek-flash，显式 thinking.type=disabled，非流式。保留 tool_calls/tool_call_id；reasoning_content 仅在服务器协议内传递，永不返回 UI。

依据官方文档：[首次调用](https://api-docs.deepseek.com/quick_start/agent_integrations/)、[Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)、[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)。

密钥仅服务端读取；当前 Provider 限定官方 HTTPS origin、禁止重定向。切换其他提供方需实现新 Provider 并审查隐私告知，不能让模型指定 URL。

| 项目     | 上限                                                   |
| -------- | ------------------------------------------------------ |
| 问题     | 1500 字符，仅当前问题，不回传聊天历史                  |
| 模型     | 3 次调用；429/5xx 每次最多重试一次；网络超时不自动重试 |
| 时间     | 单次网络请求 20 秒，总请求 55 秒，支持取消             |
| 工具     | 最多 2 轮，每轮 3 个，只读白名单                       |
| 检索     | 每次最多 4 条，每条最多 2 段，整次最多 8 个不同片段    |
| 段落     | 空行拆段，长段再切至 600 字符，保留片段位置与版本      |
| 输入     | messages 最多 16000 UTF-8 字节，请求体最多 22000 字节  |
| 输出     | 每次 max_tokens=1600；已报告累计 token 超 30000 中止   |
| 空间限额 | 每小时 6 次，UTC 日 30 次；失败计入，重启不重置        |

费用由次数、输入字节、输出 token 和重试共同封顶。极保守按 UTF-8 字节作 token 上界，含重试每次问答预留上界约 141600 token；这是请求边界而非精确预测或货币账单保证。实际花费以提供方计量和定价为准，建议同时配置提供方账户预算；没有实时人民币计费功能。

## 证据与可信度

片段 ID 根据 memoryId/revision/序号派生；sourcePath 为 `memory:<UUID>#part-N`，不暴露磁盘路径。有限检索不代表全库，无结果固定提示没有足够记录。同名回忆的日期/地点不同会提醒不一致，但不保证发现所有语义冲突。

事实只接受与引用原文连续子串或准确标题/日期/地点一致的文本；虚构事实和来源会拒绝整条答案。总结/推断必须引用真实片段，但 ID 校验不能证明语义完全支持，用户仍需核对。所有模型文本以 React 文本节点渲染，不执行 Markdown 链接或 HTML。恶意 Markdown 被视作不可信数据；安全依赖只读白名单、参数与授权边界，不宣称模型绝不会被误导。

## 公开 AI 演示（用户后续授权）

用户要求暂不配置账号，先公开使用 AI。新增 `/api/agent/demo`，仅在 demo 模式且 LOVEVERSE_AI_ENABLED/LOVEVERSE_AI_PUBLIC_DEMO 都为 true 时启用。模型与引用引擎共用 `runAgent`，但数据源固定为 `src/data/demo.ts`，不调用私人 MemoryService。该接口不接受私人 ID、路径、用户身份或客户端注入的记忆。私人模式无条件关闭它。

访客需明确勾选问题将发送到 DeepSeek；公开故事本来已在页面公开，照片仍不发送。只有额度计数保存在 `private/state/agent-demo-budget.json`，不读写私人回忆与账号文件；不保存聊天。全站每小时 6 次、每日 30 次，重启不会重置。公开配置不能作为免认证访问私人回忆的开关。未来启用账号时使用原私人模式与双方同意流程。

## 聊天、日志与扩展说明

聊天仅存当前 React 页面，最多 20 次问答；离开、退出、清除或撤销后清空。支持本地 JSON 导出，`.chat-export.json` 已忽略。不写 localStorage、不存服务端历史，不接受伪造 assistant/tool 历史。

日志仅事件名、耗时、模型、token、错误码和白名单工具名。不记录问题、原文、提示词、完整模型响应、邮箱、密钥或推理；错误不透传提供方响应体。

未来 anniversary_planner、memory_summary、love_story_generator 可在明确的新授权边界内注册。当前没有写工具，不连接微信、QQ、外部消息服务，不运行大型 Agent Harness。
