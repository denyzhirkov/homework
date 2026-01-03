// Sends notifications to messaging platforms (Telegram, Slack).
// Tags: built-in
//
// Usage Example (Telegram):
// {
//   "module": "notify",
//   "params": {
//     "type": "telegram",
//     "token": "${env.TG_BOT_TOKEN}",
//     "chatId": "${env.TG_CHAT_ID}",
//     "message": "Pipeline completed successfully!"
//   }
// }
//
// Usage Example (Slack):
// {
//   "module": "notify",
//   "params": {
//     "type": "slack",
//     "webhook": "${env.SLACK_WEBHOOK_URL}",
//     "message": "Pipeline completed!",
//     "channel": "#deploys"
//   }
// }
//
// Full Telegram params:
// {
//   "module": "notify",
//   "params": {
//     "type": "telegram",              // Notification type (required)
//     "token": "123456:ABC...",        // Bot API token (required)
//     "chatId": "-1001234567890",      // Chat/channel ID (required)
//     "message": "Hello!",             // Message text (required)
//     "parseMode": "HTML"              // Optional: "HTML" or "Markdown"
//   }
// }
//
// Full Slack params:
// {
//   "module": "notify",
//   "params": {
//     "type": "slack",                 // Notification type (required)
//     "webhook": "https://hooks...",   // Slack Incoming Webhook URL (required)
//     "message": "Hello!",             // Message text (required)
//     "channel": "#general",           // Override channel (optional)
//     "username": "CI Bot",            // Override username (optional)
//     "iconEmoji": ":rocket:",         // Override icon emoji (optional)
//     "iconUrl": "https://...",        // Override icon URL (optional)
//     "attachments": [...]             // Slack attachments (optional)
//   }
// }
//
// Returns:
// - Telegram: { "success": true, "messageId": 12345 }
// - Slack: { "success": true }
//
// Usage in Pipeline:
// {
//   "name": "Build and Notify",
//   "env": "production",
//   "steps": [
//     {
//       "name": "build",
//       "module": "shell",
//       "params": { "cmd": "npm run build" }
//     },
//     {
//       "name": "notify_telegram",
//       "description": "Send Telegram notification on build success",
//       "module": "notify",
//       "params": {
//         "type": "telegram",
//         "token": "${env.TG_BOT_TOKEN}",
//         "chatId": "${env.TG_CHAT_ID}",
//         "message": "<b>✅ Build successful!</b>\n\nPipeline: ${pipelineId}\nExit code: ${results.build.code}",
//         "parseMode": "HTML"
//       }
//     },
//     {
//       "name": "notify_slack",
//       "description": "Send Slack notification",
//       "module": "notify",
//       "params": {
//         "type": "slack",
//         "webhook": "${env.SLACK_WEBHOOK_URL}",
//         "message": "✅ Build successful!",
//         "channel": "#ci-notifications",
//         "attachments": [
//           {
//             "color": "good",
//             "title": "Build Details",
//             "fields": [
//               { "title": "Pipeline", "value": "${pipelineId}", "short": true },
//               { "title": "Status", "value": "Success", "short": true }
//             ]
//           }
//         ]
//       }
//     }
//   ]
// }
//
// Note:
// - Telegram: To get a bot token, talk to @BotFather.
//   To get chat ID, add the bot to a chat and use the getUpdates API.
// - Slack: Create an Incoming Webhook at https://api.slack.com/messaging/webhooks

import type { PipelineContext } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    type: {
      type: "string",
      required: true,
      enum: ["telegram", "slack"],
      description: "Notification platform type"
    },
    // Common (always visible)
    message: {
      type: "string",
      required: true,
      description: "Message text. Supports interpolation: ${results.build.code}"
    },
    // Telegram-specific (visible when type === "telegram")
    token: {
      type: "string",
      required: false,
      description: "Telegram Bot API token (required for telegram)",
      visibleWhen: { param: "type", equals: "telegram" }
    },
    chatId: {
      type: "string",
      required: false,
      description: "Telegram Chat or channel ID (required for telegram)",
      visibleWhen: { param: "type", equals: "telegram" }
    },
    parseMode: {
      type: "string",
      required: false,
      enum: ["HTML", "Markdown"],
      description: "Telegram message parse mode for formatting",
      visibleWhen: { param: "type", equals: "telegram" }
    },
    // Slack-specific (visible when type === "slack")
    webhook: {
      type: "string",
      required: false,
      description: "Slack Incoming Webhook URL (required for slack)",
      visibleWhen: { param: "type", equals: "slack" }
    },
    channel: {
      type: "string",
      required: false,
      description: "Slack channel override (e.g., #general)",
      visibleWhen: { param: "type", equals: "slack" }
    },
    username: {
      type: "string",
      required: false,
      description: "Slack username override",
      visibleWhen: { param: "type", equals: "slack" }
    },
    iconEmoji: {
      type: "string",
      required: false,
      description: "Slack icon emoji (e.g., :rocket:)",
      visibleWhen: { param: "type", equals: "slack" }
    },
    iconUrl: {
      type: "string",
      required: false,
      description: "Slack icon URL",
      visibleWhen: { param: "type", equals: "slack" }
    },
    attachments: {
      type: "array",
      required: false,
      description: "Slack message attachments array",
      visibleWhen: { param: "type", equals: "slack" }
    }
  }
};

// Telegram params
export interface TelegramParams {
  type: "telegram";
  token: string;
  chatId: string;
  message: string;
  parseMode?: "HTML" | "Markdown";
}

// Slack attachment field
export interface SlackAttachmentField {
  title: string;
  value: string;
  short?: boolean;
}

// Slack attachment
export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: SlackAttachmentField[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

// Slack params
export interface SlackParams {
  type: "slack";
  webhook: string;
  message: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
  attachments?: SlackAttachment[];
}

export type NotifyParams = TelegramParams | SlackParams;

// Return types
export interface TelegramResult {
  success: true;
  messageId: number;
}

export interface SlackResult {
  success: true;
}

export type NotifyResult = TelegramResult | SlackResult;

export async function run(
  ctx: PipelineContext,
  params: NotifyParams
): Promise<NotifyResult> {
  if (!params.type) {
    throw new Error("Notify module requires 'type' parameter");
  }

  if (params.type === "telegram") {
    return await sendTelegram(ctx, params as TelegramParams);
  }

  if (params.type === "slack") {
    return await sendSlack(ctx, params as SlackParams);
  }

  throw new Error(`Unknown notification type: ${(params as { type: string }).type}`);
}

async function sendTelegram(
  ctx: PipelineContext,
  params: TelegramParams
): Promise<TelegramResult> {
  if (!params.token) {
    throw new Error("Telegram notification requires 'token' parameter");
  }
  if (!params.chatId) {
    throw new Error("Telegram notification requires 'chatId' parameter");
  }
  if (!params.message) {
    throw new Error("Telegram notification requires 'message' parameter");
  }

  if (ctx.log) ctx.log(`[Notify] Sending Telegram message to chat ${params.chatId}...`);

  const url = `https://api.telegram.org/bot${params.token}/sendMessage`;

  const body: Record<string, string> = {
    chat_id: params.chatId,
    text: params.message,
  };

  if (params.parseMode) {
    body.parse_mode = params.parseMode;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctx.signal,
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errorDesc = data.description || "Unknown error";
      throw new Error(`Telegram API error: ${errorDesc}`);
    }

    const messageId = data.result?.message_id;
    if (ctx.log) ctx.log(`[Notify] Telegram message sent, ID: ${messageId}`);

    return { success: true, messageId };
  } catch (e: unknown) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}

async function sendSlack(
  ctx: PipelineContext,
  params: SlackParams
): Promise<SlackResult> {
  if (!params.webhook) {
    throw new Error("Slack notification requires 'webhook' parameter");
  }
  if (!params.message) {
    throw new Error("Slack notification requires 'message' parameter");
  }

  if (ctx.log) {
    const channelInfo = params.channel ? ` to ${params.channel}` : "";
    ctx.log(`[Notify] Sending Slack message${channelInfo}...`);
  }

  // Build Slack payload
  const payload: Record<string, unknown> = {
    text: params.message,
  };

  if (params.channel) {
    payload.channel = params.channel;
  }

  if (params.username) {
    payload.username = params.username;
  }

  if (params.iconEmoji) {
    payload.icon_emoji = params.iconEmoji;
  }

  if (params.iconUrl) {
    payload.icon_url = params.iconUrl;
  }

  if (params.attachments && params.attachments.length > 0) {
    payload.attachments = params.attachments;
  }

  try {
    const response = await fetch(params.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctx.signal,
    });

    // Slack webhooks return "ok" as plain text on success
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Slack webhook error: ${response.status} ${response.statusText} - ${text}`);
    }

    if (text !== "ok") {
      throw new Error(`Slack webhook error: ${text}`);
    }

    if (ctx.log) ctx.log(`[Notify] Slack message sent successfully`);

    return { success: true };
  } catch (e: unknown) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}
