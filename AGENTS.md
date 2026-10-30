# LoveVerse 开发约定

- 与用户使用中文交流，保留可运行项目，不只交付方案。
- 技术栈为 Next.js App Router、React、严格 TypeScript、Tailwind CSS、Motion 和 Three.js。
- 页面入口在 src/app；UI 在 src/components；演示内容在 src/data/demo.ts；日期逻辑在 src/lib。
- 所有照片、姓名和故事默认是演示内容。禁止提交私人照片、日记、令牌或 .env；private/ 与 public/private/ 均被忽略。但 gitignore 不是访问控制，public 下文件仍可通过网站访问。
- 分享真实内容前配置 Cloudflare Access 或其他服务端身份验证，不能用前端口令或 robots 代替认证。
- 新增功能应提供键盘访问、焦点状态、手机布局；弹窗使用原生 dialog，并恢复触发元素焦点。
- Three.js 必须按需加载、释放资源，尊重减少动态效果偏好；不可用时保留 CSS 星空。
- 日期以 Asia/Shanghai 的日历日计算，闰日周年在平年取 2 月 28 日。
- 验证：npm test、npm run typecheck、npm run build、npm run test:e2e。变更后的报告必须区分通过、失败和未执行。
- 不自动提交、推送、发布或开公网隧道。

## V2 私人数据边界

- 默认公开 demo，真实内容只能在独立 private 环境运行。不能添加开发口令、测试认证后门或根据客户端参数切换模式。
- 私人 API 必须通过 privateRoute / authenticate；业务服务必须验证 IdentityContext。Agent 只能访问 MemoryService 六个白名单方法，不得直连 repository/文件系统。
- 不要将私人数据从服务器组件序列化进初始页面；通过认证后客户端 API 获取。禁止把私人图片放 public。
- 服务端文件模块必须标记 server-only。客户端仅引入 model、adapter 和纯数据类型，不引入 repository、auth、uploads。
- 维护 story 正文、扩展 metadata、createdAt 与 revision 的语义。更新和删除要验证 revision；删除必须明确确认。
- 写入保持 withLock + 原子临时文件 + rename + 备份；不得静默覆盖损坏记录或自动清除残留锁。
- 上传限制真实格式、大小、像素、重新编码和元数据去除；任何图片 GET 都必须鉴权，响应 no-store。
- 纪念日导入必须显式 confirmed、一次性标记和去重，绝不清除旧版 localStorage。
- 使用临时目录和虚构账号测试，不对真实 private/ 目录运行测试、格式化、批量删除或重建。
- V2 验证顺序：npm test → npm run typecheck → npm run build → npm test，再运行 npm run test:e2e 与 npm run test:e2e:private。
- 不把账号初始化输出、密码、会话令牌、私有原文、测试 trace 中的真实内容写入报告。

## V3 Agent 边界

- 用户已授权无需账号的公开 AI 演示；仅在 demo 模式并显式启用 LOVEVERSE_AI_PUBLIC_DEMO 后，通过独立入口读取 demo.ts 的公开故事。该例外不适用于任何私人 API/回忆/照片。公开费用限额独立持久化。
- AI 默认关闭；双人共同启用、逐条当前 revision 授权后才可外发。secret/禁止第三方记录始终阻止；照片不发给模型。
- Agent 只通过 MemoryService 的只读方法访问数据，不直接读取回忆文件或调用写工具。每次工具/模型/回复前复查授权。
- DeepSeek 密钥仅在 server-only Provider，固定官方 HTTPS origin，不跟随重定向。禁止客户端选择模型 URL 或用户身份。
- 引用必须绑定本次检索片段；事实须可在来源原文核验。总结需标注推断，不透传 reasoning_content。
- 不记录提示词、私密文本、聊天或密钥。浏览器测试强制空密钥，模型使用 Mock；真实云端联调须明确区分。
- 构建前先停止同目录旧生产服务，构建后重新启动，防止静态资源版本错配。

## V4 Love Companion 边界

- V4 只在 private 模式中可用，API 必须走 privateRoute；公开 demo 不读取 V4 私人状态。
- AI 前言与惊喜策划必须继承 V3 的双人同意、当前 revision 逐条许可、预算与服务端密钥边界。照片不传至 DeepSeek。
- 回忆录保留原始来源 ID 与正文，AI 仅负责可编辑的草稿表达；不得把未证实事实写回 Love Memory。
- 惊喜方案、回忆录按创建者隔离；胶囊两人共享，但未到解锁日时任何响应都不能包含正文。
- 纪念日由独立任务凭据保护的服务端任务生成站内通知；任务不接受用户 Cookie 代替任务凭据，不接触 MemoryService 或 AI。未经另行授权不能发邮件、微信、QQ 或自动预订/购买。
- V4 测试只使用虚构账号和临时私有目录；不访问真实私人存储，不把草稿内容写入日志。
- 回忆录 AI 只排列/摘录可核验来源，生成与执行分离。PDF 仅服务端排版，禁止任意网络请求、脚本和原始 HTML；新依赖为 playwright-core，浏览器与中文字体由宿主机提供。
- 胶囊附件保存在 sealed 隔离目录，返回附件必须校验胶囊归属与解锁日期。不要自动清理孤立附件或恢复备份。
- 部署模板不等于线上验收；没有域名与账号权限时明确写“未执行”，不要自动启用 Tunnel、DNS、外部消息或 systemd 服务。

## 私人真实数据约定

- 情侣称呼和相恋日期仅由 server-only 配置读取器在 authorize 后返回，通过现有 session API 提供；不得序列化进初始页面，不得回退 demo.ts。
- 私人首页照片、星球、相册、时间轴和问答使用 MemoryProvider 的认证数据；不足时显示空状态。公开 demo 保持独立。
- LOVEVERSE_AI_ENABLED 与 LOVEVERSE_AI_PUBLIC_DEMO 默认 false；不开启真实模型调用做回归。测试配置显式覆盖情侣信息，避免加载开发者真实资料。
