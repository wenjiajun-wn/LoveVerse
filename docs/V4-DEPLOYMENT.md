# V4 私人部署与外部平台

## 当前状态与建议

本机原部署是 Windows 上仅监听 127.0.0.1 的 Node 服务，数据为本地文件。关机或休眠时不能执行提醒。正式使用建议单台常在线 Linux 主机 + 持久磁盘 + systemd + 命名 Cloudflare Tunnel；不要直接部署到无持久磁盘的 Serverless，也不要多副本共享文件仓库。

本次没有创建域名、Tunnel、Access 应用、DNS、云主机或外部账号。以下为可审查的部署配置，实际启用需要用户选择宿主机、域名和双方允许的邮箱。线上配置验证仍未执行。

## 应用与 PDF

1. 将代码部署到 `/opt/loveverse`，使用专用非 root 用户 `loveverse`，`npm ci` 后构建。私人目录单独挂载 `/var/lib/loveverse`，仅应用用户可读写；不要把本地 private 或 .env 放进镜像/公开部署包。
2. Linux 安装受维护的 Chromium 与中文字体（如 Noto CJK）。环境配置 `LOVEVERSE_PDF_BROWSER=/usr/bin/chromium`。Windows 默认使用现有 Microsoft Edge。PDF 自动化测试已实际调用 Edge 排版，Linux Chromium 环境仍需部署验收。
3. 用现有 `npm run private:setup` 初始化两个独立账号。配置 `LOVEVERSE_MODE=private`、`LOVEVERSE_ORIGIN=https://你的专属域名`、`LOVEVERSE_DATA_DIR=/var/lib/loveverse`。DeepSeek key 仅服务端，AI 仍需双方逐条授权。
4. 应用监听 `127.0.0.1:3000`。可参考 `deploy/loveverse.service`，根据实际 node 路径修改。先停旧服务再替换构建；不要在运行中的同一 `.next` 直接 build。

## 定时任务

由管理员生成 32 字节密码学随机值，写入权限 0600 的 `/etc/loveverse/scheduler.env`：

```dotenv
LOVEVERSE_SCHEDULER_TOKEN=替换为64位十六进制随机值
LOVEVERSE_SCHEDULER_URL=http://127.0.0.1:3000/api/internal/reminders
```

应用进程也必须读取同一个 `LOVEVERSE_SCHEDULER_TOKEN`（环境配置，不是 NEXT_PUBLIC）。不要将值放入命令行参数、Git、截图、报告或 Cloudflare DNS。

管理员检查路径后，将 `deploy/loveverse-reminders.service` 和 `.timer` 安装至 systemd 配置目录，再手动启用。timer 每 15 分钟执行，`Persistent=true` 处理停机错过的激活，业务层独立补偿与去重。不是依赖浏览器的 setInterval。计时器行为依据 [systemd 官方文档](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)。

验收：创建一条当天虚构纪念日，开启当天提醒，关闭浏览器，等待任务；重新登录应见一条通知。再次执行任务仍为一条；关应用后任务应失败并记录非零状态，恢复后补偿；关闭成员提醒后不再新增。监控 `journalctl` 的失败状态以及 UI 最近运行时间，超过 30 分钟未成功需排查。暂不发送告警邮件。

## 命名 Tunnel、HTTPS 与 Access

1. 在自己 Cloudflare 账号建立持久 Tunnel，映射专属域名至回环应用地址。凭据文件不进仓库，cloudflared 以服务运行。示例 ingress 在 `deploy/cloudflared.example.yml`，包含兜底 404 与内部任务路径拒绝规则。
2. 在 Zero Trust 建立 Self-hosted Access application，覆盖该 hostname **所有路径**；Allow 仅列双方邮箱，其他身份拒绝，不设 Bypass/Everyone，不为 API 或照片放行。配置独立 HTTPS origin 后应用仍要求自己的会话，不能信任客户端裸邮箱头。
3. `/api/internal/*` 不通过公网 ingress；任务只在本机凭据通道调用。不要为了 cron 配置 Access 绕过规则。
4. 防火墙不开放 3000/Node 源站入站，防止绕开 Access。公网访问只能经 Tunnel。不要发布 public/private 下任何素材。

按 [Cloudflare Tunnel 官方配置](https://developers.cloudflare.com/tunnel/get-started/) 与 [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) 设置后，必须实际检查以下矩阵；本次无域名和账号权限，均标记未执行：

| 验证 | 预期 | 线上状态 |
|---|---|---|
| 无 Access 会话访问首页/API/图片/PDF | 被 Access 拦截或跳转认证 | 未执行 |
| 非双方邮箱 | Access 拒绝 | 未执行 |
| Access 通过但无应用 Cookie | 私人 API 401 | 未执行 |
| 合法双方账号 | 正常访问；秘密计划仍互相不可见 | 未执行 |
| 公网 /api/internal/reminders | ingress 404 | 未执行 |
| 直接访问主机公网 3000 | 无法连接 | 未执行 |
| 注销/未解锁胶囊附件 | 应用层拒绝且 no-store | 本地通过，线上未执行 |

## 微信、QQ 通知适配器

`src/lib/v4/notifications.ts` 定义通道、收件人、幂等消息 ID 和双方/收件人许可契约；目前所有外部通道硬禁用，传 true 也不会发送。下一阶段必须在服务端保存真实授权记录，不能信任客户端布尔字段。禁止读取个人聊天数据库、扫码托管个人号或使用非官方协议。

- 微信：评估企业微信自建应用或微信官方订阅消息。前者需要组织/应用身份和成员可见范围；后者需平台主体资格、模板审核及收件人主动订阅。并非任意个人微信号都能发消息。企业微信 [发送应用消息官方入口](https://developer.work.weixin.qq.com/document/path/90236) 本次工具无法读取，具体权限、额度与接口参数**未验证**，不能据此开启发送。
- QQ：官方 QQ 开放平台机器人提供应用身份与沙箱机制，见 [腾讯官方机器人文档仓库](https://github.com/tencent-connect/bot-docs/blob/main/docs/README.md)。历史文档不等于当前账号拥有主动定时推送资格；该能力需在控制台与最新规则再次核实。当前只设计适配，不承诺可以向任意好友主动发提醒。
- 共同前置条件：双方知情同意、收件人 opt-in、官方凭据、模板/权限核验、退订撤销、最少消息内容和幂等 outbox。外部发送必须另行授权，不能由 DeepSeek 工具触发。消息正文默认只说“你有一条站内提醒”，不附私人照片、故事或未解锁内容。

## 备份与恢复

备份完整私人根目录，包括 V2 Markdown、uploads、V4 state、sealed 和 backups；离线加密备份由管理员配置。删除草稿/胶囊仍可能在备份中存在。先停服务、复制全部目录，再审查备份恢复；不要自动清理锁、孤立 sealed 文件或真实数据。保留周期、磁盘监控和实际恢复演练需要正式部署后完成。
