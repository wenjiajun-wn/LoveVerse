import 'server-only';
import { AppError } from '../memory/errors';
export type NotificationChannel = 'in-app' | 'wecom' | 'wechat-subscription' | 'qq-official';
export type NotificationEnvelope = { id: string; recipient: string; title: string; body: string };
export interface NotificationAdapter {
  channel: NotificationChannel;
  send(
    message: NotificationEnvelope,
    consent: { bothMembersApproved: boolean; recipientOptedIn: boolean },
  ): Promise<{ delivered: boolean }>;
}
// 外部消息适配器只定义契约；没有凭据、授权及平台审核前始终拒绝。
export const externalAdapter = (
  channel: Exclude<NotificationChannel, 'in-app'>,
): NotificationAdapter => ({
  channel,
  async send() {
    throw new AppError('CHANNEL_DISABLED', '外部通知尚未授权和配置，不会发送消息', 403);
  },
});
