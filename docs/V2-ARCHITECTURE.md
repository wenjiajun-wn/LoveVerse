# Love Memory V2 架构与接口

## 数据流

公开环境：demo.ts → MemoryProvider → 旧版宇宙、照片墙、时间轴；纪念日保持 localStorage。私人环境：登录壳 → 服务端登录/会话 → 受保护 API → MemoryService → Markdown 文件。私人正文不进入初始 HTML、构建数据或客户端静态包。

MemoryProvider 是唯一共享数据入口；adapter.ts 将 MemoryRecord 转为兼容旧版的 MemoryView。UI 不拼接磁盘路径。星图每组 6 颗，分页数量取实际回忆数；无回忆时显示引导。相册和时间轴仍复用原组件与原有 CSS，日记编辑使用新增样式文件。

## Markdown 格式

```markdown
---
id: 00000000-0000-4000-8000-000000000001
title: 一起看日落
date: '2026-05-20'
category: 旅行
place: 海边
tags:
  - 日落
photos: []
color: blue
visibility: private
createdAt: '2026-10-26T08:00:00.000Z'
updatedAt: '2026-10-26T08:00:00.000Z'
customSource: 手写日记
---

# 那一天

我们一起看了日落。
```

`story` 在数据模型中对应分隔符之后的 Markdown 正文，不在 frontmatter 重复保存。正文包括换行和 Markdown 语法原样保留。扩展 metadata（如 customSource）解析后保留，编辑时从服务器旧版本合并，不由客户端覆盖。序列化会规范 YAML 排版，因此不保证 YAML 注释、引号风格、字段排列和空白格式逐字一致。禁止 YAML 别名与重复字段。

`photos` 是 `{id, alt}[]`，不接受任意 URL 或磁盘路径。首图通过 adapter 映射为 V1 的 `image`，无照片回忆显示文字占位。所有照片由鉴权的 `/api/uploads/<uuid>` 返回。

`revision` 为整个文件内容的 SHA-256，不存入 Markdown。更新和删除携带当前 revision，在写锁内重读并比较；冲突返回 409，不覆盖另一台设备的修改。id、createdAt 由服务器创建，更新时不可修改。visibility 只允许 private，不存在将 private 改为 public 的发布捷径。

## 接口约定

返回格式：成功 `{ok:true,data:...}`；失败 `{ok:false,error:{code,message}}`。所有私人 API 返回 no-store，错误不包含原文、密码、绝对磁盘路径或堆栈。

| 路径                      | 方法               | 作用                                                    |
| ------------------------- | ------------------ | ------------------------------------------------------- |
| /api/auth/login           | POST               | 邮箱、密码登录，设置服务端会话 Cookie                   |
| /api/auth/session         | GET / DELETE       | 查询会话 / 注销并撤销会话                               |
| /api/memories             | GET / POST         | 搜索或列出 / 创建回忆                                   |
| /api/memories/:id         | GET / PUT / DELETE | 详情 / 带 revision 更新 / 带 revision 和 confirmed 删除 |
| /api/uploads              | GET / POST         | 照片库 / 原始图片请求体上传                             |
| /api/uploads/:id          | GET / DELETE       | 私人图片读取 / 确认后删除未被引用的照片                 |
| /api/anniversaries        | GET / PUT          | 同步纪念日集合，PUT 携带 revision                       |
| /api/anniversaries/import | POST               | 用户确认的一次性旧版导入                                |

搜索参数 `q, from, to, place, category, tag`：关键词按空白拆分，全文 AND 匹配；日期闭区间；地点包含匹配；分类和标签精确匹配。不创建向量索引，每次读取本地 Markdown 进行线性检索。此版本上限 1000 条回忆，不适用于大规模图库。

## 身份与授权

这是应用自身的服务端账号/会话实现，不是第三方认证 SDK。密码使用 Node scrypt（N=32768、r=8、p=1）与独立随机 salt，输出 64 字节，常量时间比较。设置命令生成高熵随机密码，服务端只保存哈希。最多两位成员、共享单一空间，没有角色分级或公众注册。

Cookie 使用 32 字节随机令牌、HttpOnly、SameSite=Strict、Path=/、12 小时绝对期限；HTTPS origin 强制 Secure。文件内仅保存令牌摘要；会话读取时重新检查账号和密码哈希指纹，注销/删除账号/改密码使旧会话失效。登录错误每 15 分钟最多 10 次，全局计数持久化，不信任客户端提供的 IP 来绕过限制。该限制可能让恶意请求暂时阻断正常登录；公网建议加 Cloudflare Access 和边缘限速。

写操作逐一验证精确 Origin；客户端按钮隐藏、robots、Hash 均不作为安全边界。只允许 HTTPS origin，HTTP 仅限 localhost、127.0.0.1、[::1]。反向代理必须保留浏览器 Origin。应用不信任 Cf-Access-Authenticated-User-Email 等请求头；即使 Cloudflare Access 已放行，仍要求应用会话。

## 存储与恢复

默认目录为 `<项目>/private`，可用 LOVEVERSE_DATA_DIR 指定独立持久磁盘。根目录不得位于 public、src、.next、.git、node_modules；读写检查所有祖先符号链接、文件名和 UUID。安全边界假定本机磁盘只有受信管理员/应用可写，无法防御已控制宿主机的攻击者或其 TOCTOU 竞争。

私人文件访问标记为运行期解析；next.config.ts 明确将 private、环境变量文件和测试产物排除在构建追踪之外。`npm run test:build-privacy` 会检查生成的 .nft.json。不要手动把完整工作目录作为部署包上传；私人磁盘数据仍需在目标主机单独安全挂载。实现依据 [Next.js Output File Tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)。

固定子目录：memories、uploads、auth、sessions、state、backups。更新/删除前保留旧文件副本。写锁是根目录的 `.write-lock`，覆盖全部读-改-写事务；临时文件与目标同目录，fsync 后 rename。异常时原文件保留；不自动打破残留锁，以避免覆盖仍活跃的写入。只支持单机本地文件系统，不支持跨主机共享盘的并发保证。

恢复步骤：停止应用 → 对完整数据目录做离线副本 → 检查 backups 中对应原始文件和 SHA/格式 → 将选定副本恢复到原 UUID 文件名 → 确认无活跃写入后再移除残留 `.write-lock` 与 `.tmp` → 重启并验证。备份可能仍包含已删除的正文和图片；完全擦除需由管理员同时处理备份，不承诺安全抹除。定期离线备份并制定保留周期，不能无限积累。

图片单张最多 8MB、1600 万像素，只接受 JPEG/PNG/WebP，实际解码后重新编码为 WebP，限制边长 2400，去除 EXIF。不接受 SVG、脚本或伪装文件。最多 2000 张。被当前回忆引用的图片不能删除；从编辑器移除只是解除关联，可在照片库另行确认删除。取消编辑时已上传的照片仍在私人照片库，可再次选择或删除。

## 纪念日迁移

上海日历日期与闰日周年计算复用 V1 dates.ts。私人纪念日存 state/anniversaries.json，含 revision 和已导入账号标记。导入必须 `confirmed:true`，每账号仅一次，按标题+日期+是否年度重复去重，给导入项目分配新 UUID。原 localStorage 保留；不会自动上传，更不会自动删除。另一台设备打开页面或窗口重新聚焦后刷新。并发保存出现 409 时保留表单输入，重新加载后合并；这是按请求同步，不是实时推送。

## 第三阶段 Love Agent 边界

MemoryService 已提供 listMemories、getMemory、searchMemories、createMemory、updateMemory、deleteMemory 六个方法。每个方法接受服务器 `authenticate(request)` 产生的 IdentityContext，内部再次验证会话，返回结构化 Result。不能通过传入 `{userId,role}` 假造 context；有效 context 在进程 WeakMap 注册，不可 JSON 序列化重建。

未来工具层必须在每个请求重新取得身份上下文、按工具白名单调用服务。写工具需要传入已验证的输入，更新/删除携带 revision，删除要求明确确认。未来 Agent 不应得到任意文件系统、shell 或 repository 对象。当前没有 LLM、Ollama、向量数据库、微信/QQ 接入，也没有运行 Harness 循环。

参考：[Node crypto](https://nodejs.org/api/crypto.html)、[OWASP 会话管理](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)、[react-markdown 安全说明](https://github.com/remarkjs/react-markdown#security)。
