# Love Memory V2 增量方案

## 基线与范围

起点为 main / 4e537c3，检查时工作区干净。功能分支 feat/love-memory-v2，禁止自动提交、推送和启动公网 Tunnel。保留 V1 素材、日期逻辑、Hash 导航、星图和全部小游戏。

V1 数据流：LoveVerse 和 Memories 直接导入 demo.ts；弹窗由组件本地 state 控制；Anniversaries 从 localStorage 读取；Games 单独导入题库。6 项日期单测、类型检查和生产构建已通过，浏览器基线正在执行。

## 模块及顺序

| 模块            | 责任                                | 依赖                      |
| --------------- | ----------------------------------- | ------------------------- |
| private-storage | 路径约束、原子写入、锁、备份        | Node 持久化文件系统       |
| identity        | 服务端密码认证、会话、同源检查      | private-storage           |
| memory          | Markdown 模型、CRUD、搜索、版本控制 | identity、private-storage |
| uploads         | 图片解码、重新编码、受保护访问      | identity、private-storage |
| anniversaries   | 共享存储、确认导入、去重            | identity、private-storage |
| memory-ui       | 编辑预览、搜索、旧页面适配          | memory、uploads           |
| agent-contract  | 六个受控服务方法与结构化结果        | memory、identity          |

按上述依赖实现，先完成后端存储/权限测试，再接入 UI 和浏览器回归。

## 默认约束

单租户：一对情侣共享一个空间；两位用户均可读写全部回忆。敏感级别为私人资料。单台持久化 Node.js 服务、小规模读多写少（设计负载 <10 请求/秒），不支持无持久磁盘 Serverless 或多副本。用户负责主机、备份和可用性，不承诺托管 SLO。主设备为手机，保留低动态、键盘与对比度设计；本阶段以交互与权限正确性验收，不虚报真实设备 Web Vitals。

## 认证与环境隔离

- LOVEVERSE_MODE 默认 demo，私人数据 API 在 demo 中关闭；私人部署显式 private，未配置账号或合法 origin 时拒绝认证。
- 两个账号保存在忽略的 private/auth 配置，密码使用 Node scrypt + 随机 salt。浏览器只接触登录表单，不持有认证秘密。
- 会话使用 256 位随机令牌、服务端仅存令牌摘要；HttpOnly、SameSite=Strict，HTTPS 下 Secure；12 小时绝对过期，注销服务端撤销。修改密码会使旧会话失效。
- 所有私有 API 先认证，再读取数据；写请求校验配置的精确 Origin。登录限速落盘，无信任客户端 IP 的绕过。
- 本机 HTTP 只允许 localhost / 127.0.0.1，远程必须 HTTPS。Cloudflare Access 可额外覆盖全域，但应用不信任裸邮箱头。
- public/demo 不变；private/uploads 经鉴权 API 返回，no-store、nosniff，不暴露静态路径。

## Markdown 与一致性

Markdown 文件由 YAML frontmatter + 原样正文组成。story 为正文权威值，metadata 支持扩展字段并在更新时保留；id、createdAt 由服务端创建，updatedAt 和内容 SHA-256 revision 用于乐观锁。用户输入仅可修改白名单字段，visibility 固定 private，不因字段值改变权限。

ID 为 UUID；文件名由服务器生成；目录与文件拒绝符号链接/目录跳转；正文、元数据、请求体、图片和总记录数均有上限。写入使用同目录临时文件、fsync、rename，写锁覆盖读-改-写。更新/删除保留原始版本备份。损坏文件返回错误，不静默覆盖；崩溃残留锁要求管理员确认服务停止后恢复，禁止自动抢锁。

## UI 与验收

公开模式仍展示演示回忆；私人模式在认证前只渲染登录壳，不服务端序列化私人数据。客户端经 API 加载、共用适配器；星图每页最多 6 颗星球。新增恋爱日记入口，支持结构化表单、Markdown 正文和实时安全预览、多照片上传/移除、创建编辑删除确认、保存状态及版本冲突提示。搜索支持关键词、日期范围、地点、分类与标签，高亮通过 React 文本节点实现。

纪念日私人存储跨设备共用；localStorage 导入必须明确点击确认，服务端记录一次性导入与内容去重，永不删除旧浏览器数据。

## 验证命令

依次执行 npm test、npm run typecheck、npm run build、npm test；执行旧版和私人模式 E2E。覆盖 Markdown 往返、未知字段保留、CRUD、并发冲突、损坏数据、路径、XSS、认证、图片权限、迁移去重与旧功能回归。

## Skills 使用

实际检查了本地 spec-driven-development、planning-and-task-breakdown、frontend-ui-engineering、senior-architect、senior-frontend、senior-backend、agent-harness 的 SKILL.md。依据用户已明确的规格与直接实施要求进行规划后执行，不额外启动逐轮方案审批，不运行完整 Agent Harness。沿用前两阶段已核验的 addyosmani/agent-skills 与 alirezarezvani/claude-skills 来源记录。

认证实现参考 Node crypto scrypt 和 OWASP Session Management；Markdown 使用 react-markdown 的默认安全 AST 渲染，不启用原始 HTML，不自动加载正文外链图片。
