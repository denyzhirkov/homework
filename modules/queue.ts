// Message queue operations (RabbitMQ, Redis, AWS SQS, Google Cloud Pub/Sub).
// Tags: built-in
//
// Usage Example (RabbitMQ publish):
// {
//   "module": "queue",
//   "params": {
//     "op": "publish",
//     "provider": "rabbitmq",
//     "host": "http://localhost:15672",
//     "username": "${env.RABBITMQ_USER}",
//     "password": "${env.RABBITMQ_PASS}",
//     "exchange": "notifications",
//     "routingKey": "build.completed",
//     "message": "Build ${BUILD_ID} completed successfully"
//   }
// }
//
// Usage Example (AWS SQS consume):
// {
//   "module": "queue",
//   "params": {
//     "op": "consume",
//     "provider": "sqs",
//     "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
//     "region": "us-east-1",
//     "accessKey": "${env.AWS_ACCESS_KEY}",
//     "secretKey": "${env.AWS_SECRET_KEY}",
//     "timeout": 10
//   }
// }
//
// Full params by provider:
// RabbitMQ:
// {
//   "op": "publish" | "consume",
//   "provider": "rabbitmq",
//   "host": "http://localhost:15672",  // Management API endpoint
//   "username": "guest",
//   "password": "guest",
//   "vhost": "/",                       // Virtual host (optional, default: /)
//   "exchange": "my-exchange",        // For publish
//   "routingKey": "my.routing.key",   // For publish
//   "queue": "my-queue",               // For consume
//   "message": "..."                    // For publish (string or object)
// }
//
// Redis:
// {
//   "op": "publish" | "consume",
//   "provider": "redis",
//   "host": "http://localhost:8080",   // Redis HTTP API endpoint
//   "apiKey": "..."                    // If required
//   "channel": "my-channel",           // For publish/consume (Pub/Sub)
//   "list": "my-list",                 // Alternative: use list instead of channel
//   "message": "..."                    // For publish
// }
//
// AWS SQS:
// {
//   "op": "publish" | "consume",
//   "provider": "sqs",
//   "queueUrl": "https://sqs.region.amazonaws.com/account/queue",
//   "region": "us-east-1",
//   "accessKey": "...",
//   "secretKey": "...",
//   "message": "..."                    // For publish
// }
//
// Google Cloud Pub/Sub:
// {
//   "op": "publish" | "consume",
//   "provider": "pubsub",
//   "project": "my-project",
//   "topic": "my-topic",               // For publish
//   "subscription": "my-subscription", // For consume
//   "serviceAccount": { ... },          // Service account JSON object
//   "message": "..."                    // For publish
// }
//
// Returns:
// - publish: { "success": true, "messageId": "...", "provider": "..." }
// - consume: { "success": true, "message": "...", "messageId": "...", "provider": "..." }
// - consume (no message): { "success": false, "timeout": true }
//
// Note:
// - RabbitMQ requires Management Plugin enabled (default on port 15672)
// - Redis requires HTTP API (Redis Stack) or HTTP wrapper service
// - AWS SQS requires valid AWS credentials with SQS permissions
// - Google Cloud Pub/Sub requires service account JSON with Pub/Sub permissions

import type { PipelineContext } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["publish", "consume"],
      description: "Queue operation: publish (send) or consume (receive)"
    },
    provider: {
      type: "string",
      required: true,
      enum: ["rabbitmq", "redis", "sqs", "pubsub"],
      description: "Message queue provider"
    },
    // RabbitMQ params
    host: {
      type: "string",
      required: false,
      description: "RabbitMQ Management API host (e.g., http://localhost:15672)",
      visibleWhen: { param: "provider", equals: "rabbitmq" }
    },
    username: {
      type: "string",
      required: false,
      description: "RabbitMQ username",
      visibleWhen: { param: "provider", equals: "rabbitmq" }
    },
    password: {
      type: "string",
      required: false,
      description: "RabbitMQ password",
      visibleWhen: { param: "provider", equals: "rabbitmq" }
    },
    vhost: {
      type: "string",
      required: false,
      default: "/",
      description: "RabbitMQ virtual host",
      visibleWhen: { param: "provider", equals: "rabbitmq" }
    },
    exchange: {
      type: "string",
      required: false,
      description: "RabbitMQ exchange name (for publish)",
      visibleWhen: { param: "provider", equals: "rabbitmq" }
    },
    routingKey: {
      type: "string",
      required: false,
      description: "RabbitMQ routing key (for publish)",
      visibleWhen: { param: "provider", equals: ["rabbitmq"] }
    },
    queue: {
      type: "string",
      required: false,
      description: "RabbitMQ queue name (for consume)",
      visibleWhen: { param: "provider", equals: "rabbitmq" }
    },
    // Redis params
    apiKey: {
      type: "string",
      required: false,
      description: "Redis HTTP API key (if required)",
      visibleWhen: { param: "provider", equals: "redis" }
    },
    channel: {
      type: "string",
      required: false,
      description: "Redis Pub/Sub channel name",
      visibleWhen: { param: "provider", equals: "redis" }
    },
    list: {
      type: "string",
      required: false,
      description: "Redis list name (alternative to channel)",
      visibleWhen: { param: "provider", equals: "redis" }
    },
    // AWS SQS params
    queueUrl: {
      type: "string",
      required: false,
      description: "AWS SQS queue URL",
      visibleWhen: { param: "provider", equals: "sqs" }
    },
    region: {
      type: "string",
      required: false,
      default: "us-east-1",
      description: "AWS region",
      visibleWhen: { param: "provider", equals: "sqs" }
    },
    accessKey: {
      type: "string",
      required: false,
      description: "AWS access key ID",
      visibleWhen: { param: "provider", equals: "sqs" }
    },
    secretKey: {
      type: "string",
      required: false,
      description: "AWS secret access key",
      visibleWhen: { param: "provider", equals: "sqs" }
    },
    // Google Cloud Pub/Sub params
    project: {
      type: "string",
      required: false,
      description: "Google Cloud project ID",
      visibleWhen: { param: "provider", equals: "pubsub" }
    },
    topic: {
      type: "string",
      required: false,
      description: "Pub/Sub topic name (for publish)",
      visibleWhen: { param: "provider", equals: "pubsub" }
    },
    subscription: {
      type: "string",
      required: false,
      description: "Pub/Sub subscription name (for consume)",
      visibleWhen: { param: "provider", equals: "pubsub" }
    },
    serviceAccount: {
      type: "object",
      required: false,
      description: "Google Cloud service account JSON object",
      visibleWhen: { param: "provider", equals: "pubsub" }
    },
    // Common params
    message: {
      type: "string",
      required: false,
      description: "Message to publish (string or JSON object). Supports interpolation: ${BUILD_ID}",
      visibleWhen: { param: "op", equals: "publish" }
    },
    timeout: {
      type: "number",
      required: false,
      default: 10,
      description: "Timeout in seconds for consume operation",
      visibleWhen: { param: "op", equals: "consume" }
    }
  }
};

export interface QueueParams {
  op: "publish" | "consume";
  provider: "rabbitmq" | "redis" | "sqs" | "pubsub";
  // RabbitMQ
  host?: string;
  username?: string;
  password?: string;
  vhost?: string;
  exchange?: string;
  routingKey?: string;
  queue?: string;
  // Redis
  apiKey?: string;
  channel?: string;
  list?: string;
  // AWS SQS
  queueUrl?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  // Google Cloud Pub/Sub
  project?: string;
  topic?: string;
  subscription?: string;
  serviceAccount?: Record<string, unknown>;
  // Common
  message?: string | Record<string, unknown>;
  timeout?: number;
}

export interface QueuePublishResult {
  success: true;
  messageId: string;
  provider: string;
}

export interface QueueConsumeResult {
  success: boolean;
  message?: string;
  messageId?: string;
  provider?: string;
  timeout?: boolean;
}

type QueueResult = QueuePublishResult | QueueConsumeResult;

// Helper: Format message (string or object)
function formatMessage(message: string | Record<string, unknown> | undefined): string {
  if (!message) return "";
  if (typeof message === "string") return message;
  return JSON.stringify(message);
}

export async function run(
  ctx: PipelineContext,
  params: QueueParams
): Promise<QueueResult> {
  if (!params.op) {
    throw new Error("Queue module requires 'op' parameter (publish or consume)");
  }
  if (!params.provider) {
    throw new Error("Queue module requires 'provider' parameter");
  }

  if (ctx.signal?.aborted) {
    throw new Error("Pipeline stopped by user");
  }

  switch (params.provider) {
    case "rabbitmq":
      return await handleRabbitMQ(ctx, params);
    case "redis":
      return await handleRedis(ctx, params);
    case "sqs":
      return await handleSQS(ctx, params);
    case "pubsub":
      return await handlePubSub(ctx, params);
    default:
      throw new Error(`Unknown queue provider: ${params.provider}`);
  }
}

// --- RabbitMQ Implementation ---

async function handleRabbitMQ(
  ctx: PipelineContext,
  params: QueueParams
): Promise<QueueResult> {
  if (!params.host) {
    throw new Error("RabbitMQ requires 'host' parameter");
  }
  if (!params.username) {
    throw new Error("RabbitMQ requires 'username' parameter");
  }
  if (!params.password) {
    throw new Error("RabbitMQ requires 'password' parameter");
  }

  const vhost = params.vhost || "/";
  const encodedVhost = encodeURIComponent(vhost);

  if (params.op === "publish") {
    if (!params.exchange) {
      throw new Error("RabbitMQ publish requires 'exchange' parameter");
    }
    if (!params.routingKey) {
      throw new Error("RabbitMQ publish requires 'routingKey' parameter");
    }
    if (!params.message) {
      throw new Error("RabbitMQ publish requires 'message' parameter");
    }

    const messageText = formatMessage(params.message);
    if (ctx.log) ctx.log(`[Queue/RabbitMQ] Publishing to exchange '${params.exchange}' with routing key '${params.routingKey}'`);

    const url = `${params.host}/api/exchanges/${encodedVhost}/${encodeURIComponent(params.exchange)}/publish`;
    const auth = btoa(`${params.username}:${params.password}`);

    const body = {
      properties: {},
      routing_key: params.routingKey,
      payload: messageText,
      payload_encoding: "string"
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`
        },
        body: JSON.stringify(body),
        signal: ctx.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`RabbitMQ publish failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const data = await response.json();
      if (ctx.log) ctx.log(`[Queue/RabbitMQ] Message published successfully`);

      return {
        success: true,
        messageId: data.routed ? "routed" : "not_routed",
        provider: "rabbitmq"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      throw e;
    }
  } else {
    // consume
    if (!params.queue) {
      throw new Error("RabbitMQ consume requires 'queue' parameter");
    }

    const timeout = params.timeout || 10;
    if (ctx.log) ctx.log(`[Queue/RabbitMQ] Consuming from queue '${params.queue}' (timeout: ${timeout}s)`);

    const url = `${params.host}/api/queues/${encodedVhost}/${encodeURIComponent(params.queue)}/get`;
    const auth = btoa(`${params.username}:${params.password}`);

    const body = {
      count: 1,
      ackmode: "ack_requeue_false",
      encoding: "auto"
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`
        },
        body: JSON.stringify(body),
        signal: ctx.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`RabbitMQ consume failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        if (ctx.log) ctx.log(`[Queue/RabbitMQ] No messages available`);
        return {
          success: false,
          timeout: true
        };
      }

      const message = data[0];
      const payload = message.payload || "";
      const messageId = message.properties?.message_id || message.delivery_tag || "unknown";

      if (ctx.log) ctx.log(`[Queue/RabbitMQ] Message consumed: ${messageId}`);

      return {
        success: true,
        message: payload,
        messageId: String(messageId),
        provider: "rabbitmq"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      throw e;
    }
  }
}

// --- Redis Implementation ---

async function handleRedis(
  ctx: PipelineContext,
  params: QueueParams
): Promise<QueueResult> {
  if (!params.host) {
    throw new Error("Redis requires 'host' parameter (HTTP API endpoint)");
  }

  // Note: Redis typically uses binary protocol (RESP)
  // This implementation assumes HTTP API is available (e.g., Redis Stack or HTTP wrapper)
  // For basic operations, we'll use a simple HTTP API pattern

  if (params.op === "publish") {
    if (!params.channel && !params.list) {
      throw new Error("Redis publish requires 'channel' or 'list' parameter");
    }
    if (!params.message) {
      throw new Error("Redis publish requires 'message' parameter");
    }

    const messageText = formatMessage(params.message);
    const target = params.channel || params.list || "";
    const targetType = params.channel ? "channel" : "list";

    if (ctx.log) ctx.log(`[Queue/Redis] Publishing to ${targetType} '${target}'`);

    // Try HTTP API endpoint (Redis Stack or HTTP wrapper)
    // Format: POST /api/publish or POST /api/lpush
    const endpoint = params.channel
      ? `${params.host}/api/publish`
      : `${params.host}/api/lpush`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (params.apiKey) {
      headers["Authorization"] = `Bearer ${params.apiKey}`;
    }

    const body = params.channel
      ? { channel: params.channel, message: messageText }
      : { list: params.list, value: messageText };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctx.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Redis publish failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const data = await response.json().catch(() => ({ success: true }));
      if (ctx.log) ctx.log(`[Queue/Redis] Message published successfully`);

      return {
        success: true,
        messageId: data.id || data.messageId || "published",
        provider: "redis"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      // If HTTP API fails, provide helpful error
      if (e instanceof Error && e.message.includes("fetch")) {
        throw new Error(`Redis HTTP API not available at ${params.host}. Redis requires HTTP API (Redis Stack) or HTTP wrapper service.`);
      }
      throw e;
    }
  } else {
    // consume
    if (!params.channel && !params.list) {
      throw new Error("Redis consume requires 'channel' or 'list' parameter");
    }

    const timeout = params.timeout || 10;
    const target = params.channel || params.list || "";
    const targetType = params.channel ? "channel" : "list";

    if (ctx.log) ctx.log(`[Queue/Redis] Consuming from ${targetType} '${target}' (timeout: ${timeout}s)`);

    // Try HTTP API endpoint
    const endpoint = params.channel
      ? `${params.host}/api/subscribe?channel=${encodeURIComponent(params.channel)}&timeout=${timeout}`
      : `${params.host}/api/rpop?list=${encodeURIComponent(params.list || "")}`;

    const headers: Record<string, string> = {};
    if (params.apiKey) {
      headers["Authorization"] = `Bearer ${params.apiKey}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers,
        signal: ctx.signal
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 204) {
          if (ctx.log) ctx.log(`[Queue/Redis] No messages available`);
          return {
            success: false,
            timeout: true
          };
        }
        const text = await response.text();
        throw new Error(`Redis consume failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const data = await response.json().catch(async () => {
        const text = await response.text();
        return { message: text };
      });

      if (!data.message && !data.value) {
        return {
          success: false,
          timeout: true
        };
      }

      const message = data.message || data.value || "";
      const messageId = data.id || data.messageId || "consumed";

      if (ctx.log) ctx.log(`[Queue/Redis] Message consumed: ${messageId}`);

      return {
        success: true,
        message: String(message),
        messageId: String(messageId),
        provider: "redis"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      if (e instanceof Error && e.message.includes("fetch")) {
        throw new Error(`Redis HTTP API not available at ${params.host}. Redis requires HTTP API (Redis Stack) or HTTP wrapper service.`);
      }
      throw e;
    }
  }
}

// --- AWS SQS Implementation ---

// Reuse AWS Signature V4 signing from S3 module
async function signSQS(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: string,
  accessKey: string,
  secretKey: string,
  region: string
): Promise<Record<string, string>> {
  const encoder = new TextEncoder();

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  // Hash payload
  const bodyBytes = encoder.encode(body);
  const payloadHash = await sha256Hex(bodyBytes);

  // Create canonical headers
  headers["host"] = url.host;
  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = payloadHash;

  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders.map(k => `${k.toLowerCase()}:${headers[k].trim()}`).join("\n") + "\n";
  const signedHeaders = sortedHeaders.map(k => k.toLowerCase()).join(";");

  // Create canonical request (SQS uses query string parameters)
  const canonicalUri = url.pathname;
  const canonicalQueryString = url.searchParams.toString();
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  // Create string to sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/sqs/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(encoder.encode(canonicalRequest))
  ].join("\n");

  // Calculate signature
  const kDate = await hmacSha256(encoder.encode("AWS4" + secretKey), encoder.encode(dateStamp));
  const kRegion = await hmacSha256(kDate, encoder.encode(region));
  const kService = await hmacSha256(kRegion, encoder.encode("sqs"));
  const kSigning = await hmacSha256(kService, encoder.encode("aws4_request"));
  const signature = await hmacSha256Hex(kSigning, encoder.encode(stringToSign));

  // Create authorization header
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    "Authorization": authorization
  };
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const keyBuffer = new ArrayBuffer(key.length);
  new Uint8Array(keyBuffer).set(key);
  const dataBuffer = new ArrayBuffer(data.length);
  new Uint8Array(dataBuffer).set(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
  return new Uint8Array(signature);
}

async function hmacSha256Hex(key: Uint8Array, data: Uint8Array): Promise<string> {
  const result = await hmacSha256(key, data);
  return Array.from(result)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handleSQS(
  ctx: PipelineContext,
  params: QueueParams
): Promise<QueueResult> {
  if (!params.queueUrl) {
    throw new Error("AWS SQS requires 'queueUrl' parameter");
  }
  if (!params.accessKey) {
    throw new Error("AWS SQS requires 'accessKey' parameter");
  }
  if (!params.secretKey) {
    throw new Error("AWS SQS requires 'secretKey' parameter");
  }

  const region = params.region || "us-east-1";
  const queueUrl = new URL(params.queueUrl);

  if (params.op === "publish") {
    if (!params.message) {
      throw new Error("AWS SQS publish requires 'message' parameter");
    }

    const messageText = formatMessage(params.message);
    if (ctx.log) ctx.log(`[Queue/SQS] Publishing to queue: ${queueUrl.pathname}`);

    // SQS SendMessage action
    const url = new URL(queueUrl.href);
    url.searchParams.set("Action", "SendMessage");
    url.searchParams.set("MessageBody", messageText);
    url.searchParams.set("Version", "2012-11-05");

    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.0"
    };

    const body = url.searchParams.toString();
    const signedHeaders = await signSQS("POST", url, headers, body, params.accessKey, params.secretKey, region);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: signedHeaders,
        body,
        signal: ctx.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AWS SQS publish failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const text = await response.text();
      // Parse XML response for MessageId
      const messageIdMatch = text.match(/<MessageId>([^<]+)<\/MessageId>/);
      const messageId = messageIdMatch ? messageIdMatch[1] : "unknown";

      if (ctx.log) ctx.log(`[Queue/SQS] Message published: ${messageId}`);

      return {
        success: true,
        messageId,
        provider: "sqs"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      throw e;
    }
  } else {
    // consume
    const timeout = params.timeout || 10;
    if (ctx.log) ctx.log(`[Queue/SQS] Consuming from queue: ${queueUrl.pathname} (timeout: ${timeout}s)`);

    // SQS ReceiveMessage action
    const url = new URL(queueUrl.href);
    url.searchParams.set("Action", "ReceiveMessage");
    url.searchParams.set("MaxNumberOfMessages", "1");
    url.searchParams.set("WaitTimeSeconds", String(Math.min(timeout, 20))); // SQS max is 20
    url.searchParams.set("Version", "2012-11-05");

    const headers: Record<string, string> = {
      "Content-Type": "application/x-amz-json-1.0"
    };

    const body = url.searchParams.toString();
    const signedHeaders = await signSQS("POST", url, headers, body, params.accessKey, params.secretKey, region);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: signedHeaders,
        body,
        signal: ctx.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AWS SQS consume failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const text = await response.text();

      // Parse XML response
      const messageMatch = text.match(/<Message>([\s\S]*?)<\/Message>/);
      if (!messageMatch) {
        if (ctx.log) ctx.log(`[Queue/SQS] No messages available`);
        return {
          success: false,
          timeout: true
        };
      }

      const messageXml = messageMatch[1];
      const bodyMatch = messageXml.match(/<Body>([\s\S]*?)<\/Body>/);
      const receiptHandleMatch = messageXml.match(/<ReceiptHandle>([^<]+)<\/ReceiptHandle>/);
      const messageIdMatch = messageXml.match(/<MessageId>([^<]+)<\/MessageId>/);

      const message = bodyMatch ? bodyMatch[1] : "";
      const messageId = messageIdMatch ? messageIdMatch[1] : receiptHandleMatch ? receiptHandleMatch[1] : "unknown";

      if (ctx.log) ctx.log(`[Queue/SQS] Message consumed: ${messageId}`);

      return {
        success: true,
        message,
        messageId,
        provider: "sqs"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      throw e;
    }
  }
}

// --- Google Cloud Pub/Sub Implementation ---

async function getPubSubAccessToken(serviceAccount: Record<string, unknown>): Promise<string> {
  // Generate JWT and exchange for access token using RSA signing

  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const claim = {
    iss: serviceAccount.client_email as string,
    scope: "https://www.googleapis.com/auth/pubsub",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  // Base64URL encode (without padding)
  function base64UrlEncode(str: string): string {
    return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const claimB64 = base64UrlEncode(JSON.stringify(claim));
  const unsignedJwt = `${headerB64}.${claimB64}`;

  // Get private key from service account
  const privateKeyPem = serviceAccount.private_key as string;
  if (!privateKeyPem) {
    throw new Error("Service account missing 'private_key' field");
  }

  // Parse PEM private key and convert to CryptoKey
  // Remove PEM headers and whitespace
  const privateKeyContent = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const privateKeyBytes = Uint8Array.from(atob(privateKeyContent), c => c.charCodeAt(0));

  // Import private key for RSA signing
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedJwt)
  );

  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${unsignedJwt}.${signatureB64}`;

  // Exchange JWT for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Pub/Sub access token: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Invalid token response: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function handlePubSub(
  ctx: PipelineContext,
  params: QueueParams
): Promise<QueueResult> {
  if (!params.project) {
    throw new Error("Google Cloud Pub/Sub requires 'project' parameter");
  }
  if (!params.serviceAccount) {
    throw new Error("Google Cloud Pub/Sub requires 'serviceAccount' parameter (JSON object)");
  }

  // Get access token
  let accessToken: string;
  try {
    accessToken = await getPubSubAccessToken(params.serviceAccount);
  } catch (e) {
    throw new Error(`Failed to authenticate with Google Cloud: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (params.op === "publish") {
    if (!params.topic) {
      throw new Error("Google Cloud Pub/Sub publish requires 'topic' parameter");
    }
    if (!params.message) {
      throw new Error("Google Cloud Pub/Sub publish requires 'message' parameter");
    }

    const messageText = formatMessage(params.message);
    if (ctx.log) ctx.log(`[Queue/PubSub] Publishing to topic '${params.topic}'`);

    const url = `https://pubsub.googleapis.com/v1/projects/${params.project}/topics/${params.topic}:publish`;

    const body = {
      messages: [
        {
          data: btoa(messageText)
        }
      ]
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(body),
        signal: ctx.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Cloud Pub/Sub publish failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const data = await response.json();
      const messageId = data.messageIds?.[0] || "unknown";

      if (ctx.log) ctx.log(`[Queue/PubSub] Message published: ${messageId}`);

      return {
        success: true,
        messageId,
        provider: "pubsub"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      throw e;
    }
  } else {
    // consume
    if (!params.subscription) {
      throw new Error("Google Cloud Pub/Sub consume requires 'subscription' parameter");
    }

    const timeout = params.timeout || 10;
    if (ctx.log) ctx.log(`[Queue/PubSub] Consuming from subscription '${params.subscription}' (timeout: ${timeout}s)`);

    const url = `https://pubsub.googleapis.com/v1/projects/${params.project}/subscriptions/${params.subscription}:pull`;

    const body = {
      maxMessages: 1,
      returnImmediately: timeout === 0
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(body),
        signal: ctx.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Cloud Pub/Sub consume failed: ${response.status} ${response.statusText} - ${text}`);
      }

      const data = await response.json();

      if (!data.receivedMessages || data.receivedMessages.length === 0) {
        if (ctx.log) ctx.log(`[Queue/PubSub] No messages available`);
        return {
          success: false,
          timeout: true
        };
      }

      const receivedMessage = data.receivedMessages[0];
      const messageData = receivedMessage.message?.data || "";
      const messageId = receivedMessage.message?.messageId || receivedMessage.ackId || "unknown";
      const messageText = atob(messageData);

      // Acknowledge message
      const ackUrl = `https://pubsub.googleapis.com/v1/projects/${params.project}/subscriptions/${params.subscription}:acknowledge`;
      await fetch(ackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          ackIds: [receivedMessage.ackId]
        }),
        signal: ctx.signal
      }).catch(() => {
        // Log but don't fail if ack fails
        if (ctx.log) ctx.log(`[Queue/PubSub] Warning: Failed to acknowledge message`);
      });

      if (ctx.log) ctx.log(`[Queue/PubSub] Message consumed: ${messageId}`);

      return {
        success: true,
        message: messageText,
        messageId,
        provider: "pubsub"
      };
    } catch (e: unknown) {
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      throw e;
    }
  }
}

