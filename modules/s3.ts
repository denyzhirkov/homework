// S3-compatible storage operations (AWS S3, MinIO, DigitalOcean Spaces).
// Tags: built-in
//
// Usage Example (upload):
// {
//   "module": "s3",
//   "params": {
//     "op": "upload",
//     "bucket": "my-artifacts",
//     "source": "./dist/build.zip",
//     "key": "releases/v1.0.0/build.zip",
//     "endpoint": "${env.S3_ENDPOINT}",
//     "accessKey": "${env.S3_ACCESS_KEY}",
//     "secretKey": "${env.S3_SECRET_KEY}"
//   }
// }
//
// Usage Example (download):
// {
//   "module": "s3",
//   "params": {
//     "op": "download",
//     "bucket": "my-artifacts",
//     "key": "releases/latest.zip",
//     "output": "./download.zip",
//     "endpoint": "${env.S3_ENDPOINT}",
//     "accessKey": "${env.S3_ACCESS_KEY}",
//     "secretKey": "${env.S3_SECRET_KEY}"
//   }
// }
//
// Usage Example (list):
// {
//   "module": "s3",
//   "params": {
//     "op": "list",
//     "bucket": "my-artifacts",
//     "prefix": "releases/",
//     "endpoint": "${env.S3_ENDPOINT}",
//     "accessKey": "${env.S3_ACCESS_KEY}",
//     "secretKey": "${env.S3_SECRET_KEY}"
//   }
// }
//
// Usage Example (delete):
// {
//   "module": "s3",
//   "params": {
//     "op": "delete",
//     "bucket": "my-artifacts",
//     "key": "releases/old-build.zip",
//     "endpoint": "${env.S3_ENDPOINT}",
//     "accessKey": "${env.S3_ACCESS_KEY}",
//     "secretKey": "${env.S3_SECRET_KEY}"
//   }
// }
//
// Full params:
// {
//   "module": "s3",
//   "params": {
//     "op": "upload",             // Operation: upload, download, list, delete (required)
//     "bucket": "bucket-name",    // S3 bucket name (required)
//     "key": "path/to/file",      // Object key in bucket (required except for list)
//     "source": "./local/file",   // Source file for upload (required for upload)
//     "output": "./local/dest",   // Destination for download (required for download)
//     "prefix": "path/prefix/",   // Prefix filter for list (optional)
//     "endpoint": "https://...",  // S3-compatible endpoint (required)
//     "region": "us-east-1",      // AWS region (optional, default: us-east-1)
//     "accessKey": "AKIA...",     // Access key ID (required)
//     "secretKey": "secret...",   // Secret access key (required)
//     "contentType": "app/zip",   // Content-Type for upload (optional, auto-detected)
//     "acl": "public-read"        // ACL for upload (optional)
//   }
// }
//
// Returns:
// - upload: { "success": true, "key": "path/to/file", "size": 12345 }
// - download: { "success": true, "key": "path/to/file", "size": 12345 }
// - list: { "objects": [{ "key": "...", "size": 123, "lastModified": "..." }], "count": 10 }
// - delete: { "success": true, "key": "path/to/file" }
//
// Note: For AWS S3, endpoint is "https://s3.{region}.amazonaws.com"
// For MinIO: "http://localhost:9000"
// For DigitalOcean Spaces: "https://{region}.digitaloceanspaces.com"

import type { PipelineContext } from "../server/types/index.ts";
import { ensureDir } from "@std/fs";
import { dirname, join, extname } from "@std/path";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["upload", "download", "list", "delete"],
      description: "S3 operation: upload, download, list, or delete"
    },
    // Common params (always visible)
    bucket: {
      type: "string",
      required: true,
      description: "S3 bucket name"
    },
    endpoint: {
      type: "string",
      required: true,
      description: "S3-compatible endpoint URL (e.g., https://s3.us-east-1.amazonaws.com)"
    },
    region: {
      type: "string",
      required: false,
      default: "us-east-1",
      description: "AWS region (default: us-east-1)"
    },
    accessKey: {
      type: "string",
      required: true,
      description: "S3 access key ID"
    },
    secretKey: {
      type: "string",
      required: true,
      description: "S3 secret access key"
    },
    // Key - visible for upload, download, delete (not list)
    key: {
      type: "string",
      required: false,
      description: "Object key in bucket (path/to/file)",
      visibleWhen: { param: "op", equals: ["upload", "download", "delete"] }
    },
    // Upload-specific
    source: {
      type: "string",
      required: false,
      description: "Source file path for upload (local file)",
      visibleWhen: { param: "op", equals: "upload" }
    },
    contentType: {
      type: "string",
      required: false,
      description: "Content-Type for upload (auto-detected if not specified)",
      visibleWhen: { param: "op", equals: "upload" }
    },
    acl: {
      type: "string",
      required: false,
      enum: ["private", "public-read", "public-read-write", "authenticated-read"],
      description: "ACL for uploaded object",
      visibleWhen: { param: "op", equals: "upload" }
    },
    // Download-specific
    output: {
      type: "string",
      required: false,
      description: "Destination path for download",
      visibleWhen: { param: "op", equals: "download" }
    },
    // List-specific
    prefix: {
      type: "string",
      required: false,
      description: "Prefix filter for list operation",
      visibleWhen: { param: "op", equals: "list" }
    }
  }
};

export interface S3Params {
  op: "upload" | "download" | "list" | "delete";
  bucket: string;
  key?: string;
  source?: string;
  output?: string;
  prefix?: string;
  endpoint: string;
  region?: string;
  accessKey: string;
  secretKey: string;
  contentType?: string;
  acl?: string;
}

interface S3Object {
  key: string;
  size: number;
  lastModified: string;
}

export interface S3UploadResult {
  success: true;
  key: string;
  size: number;
}

export interface S3DownloadResult {
  success: true;
  key: string;
  size: number;
}

export interface S3ListResult {
  objects: S3Object[];
  count: number;
}

export interface S3DeleteResult {
  success: true;
  key: string;
}

type S3Result = S3UploadResult | S3DownloadResult | S3ListResult | S3DeleteResult;

// MIME type detection based on extension
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wasm": "application/wasm",
};

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

// AWS Signature Version 4 signing
async function sign(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: Uint8Array | null,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string = "s3"
): Promise<Record<string, string>> {
  const encoder = new TextEncoder();
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  // Hash payload
  const payloadHash = await sha256Hex(body || new Uint8Array());

  // Create canonical headers
  const host = url.host;
  headers["host"] = host;
  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = payloadHash;

  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders.map(k => `${k.toLowerCase()}:${headers[k].trim()}`).join("\n") + "\n";
  const signedHeaders = sortedHeaders.map(k => k.toLowerCase()).join(";");

  // Create canonical request
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
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(encoder.encode(canonicalRequest))
  ].join("\n");

  // Calculate signature
  const kDate = await hmacSha256(encoder.encode("AWS4" + secretKey), encoder.encode(dateStamp));
  const kRegion = await hmacSha256(kDate, encoder.encode(region));
  const kService = await hmacSha256(kRegion, encoder.encode(service));
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
  // Create a proper ArrayBuffer copy to satisfy TypeScript
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // Create proper ArrayBuffer copies to satisfy TypeScript
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

export async function run(
  ctx: PipelineContext,
  params: S3Params
): Promise<S3Result> {
  if (!params.op) {
    throw new Error("S3 module requires 'op' parameter");
  }
  if (!params.bucket) {
    throw new Error("S3 module requires 'bucket' parameter");
  }
  if (!params.endpoint) {
    throw new Error("S3 module requires 'endpoint' parameter");
  }
  if (!params.accessKey) {
    throw new Error("S3 module requires 'accessKey' parameter");
  }
  if (!params.secretKey) {
    throw new Error("S3 module requires 'secretKey' parameter");
  }

  const region = params.region || "us-east-1";

  switch (params.op) {
    case "upload":
      return await uploadFile(ctx, params, region);
    case "download":
      return await downloadFile(ctx, params, region);
    case "list":
      return await listObjects(ctx, params, region);
    case "delete":
      return await deleteObject(ctx, params, region);
    default:
      throw new Error(`Unknown S3 operation: ${params.op}`);
  }
}

async function uploadFile(
  ctx: PipelineContext,
  params: S3Params,
  region: string
): Promise<S3UploadResult> {
  if (!params.source) {
    throw new Error("S3 upload requires 'source' parameter");
  }
  if (!params.key) {
    throw new Error("S3 upload requires 'key' parameter");
  }

  // Resolve source path
  const sourcePath = params.source.startsWith("/")
    ? params.source
    : join(ctx.workDir, params.source);

  // Read file
  let fileData: Uint8Array;
  try {
    fileData = await Deno.readFile(sourcePath);
  } catch {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }

  const contentType = params.contentType || getMimeType(params.key);

  if (ctx.log) ctx.log(`[S3] Uploading ${sourcePath} to s3://${params.bucket}/${params.key}`);
  if (ctx.log) ctx.log(`[S3] Size: ${fileData.length} bytes, Content-Type: ${contentType}`);

  // Build URL
  const endpoint = params.endpoint.endsWith("/") ? params.endpoint.slice(0, -1) : params.endpoint;
  const url = new URL(`${endpoint}/${params.bucket}/${params.key}`);

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(fileData.length),
  };

  if (params.acl) {
    headers["x-amz-acl"] = params.acl;
  }

  const signedHeaders = await sign("PUT", url, headers, fileData, params.accessKey, params.secretKey, region);

  try {
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: signedHeaders,
      body: fileData,
      signal: ctx.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText} - ${text}`);
    }

    if (ctx.log) ctx.log(`[S3] Upload successful: ${params.key}`);

    return {
      success: true,
      key: params.key,
      size: fileData.length
    };
  } catch (e: unknown) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}

async function downloadFile(
  ctx: PipelineContext,
  params: S3Params,
  region: string
): Promise<S3DownloadResult> {
  if (!params.key) {
    throw new Error("S3 download requires 'key' parameter");
  }
  if (!params.output) {
    throw new Error("S3 download requires 'output' parameter");
  }

  // Resolve output path
  const outputPath = params.output.startsWith("/")
    ? params.output
    : join(ctx.workDir, params.output);

  if (ctx.log) ctx.log(`[S3] Downloading s3://${params.bucket}/${params.key} to ${outputPath}`);

  // Build URL
  const endpoint = params.endpoint.endsWith("/") ? params.endpoint.slice(0, -1) : params.endpoint;
  const url = new URL(`${endpoint}/${params.bucket}/${params.key}`);

  const headers: Record<string, string> = {};
  const signedHeaders = await sign("GET", url, headers, null, params.accessKey, params.secretKey, region);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: signedHeaders,
      signal: ctx.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 download failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = new Uint8Array(await response.arrayBuffer());

    // Ensure output directory exists
    await ensureDir(dirname(outputPath));

    // Write file
    await Deno.writeFile(outputPath, data);

    if (ctx.log) ctx.log(`[S3] Download successful: ${data.length} bytes`);

    return {
      success: true,
      key: params.key,
      size: data.length
    };
  } catch (e: unknown) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}

async function listObjects(
  ctx: PipelineContext,
  params: S3Params,
  region: string
): Promise<S3ListResult> {
  if (ctx.log) ctx.log(`[S3] Listing objects in s3://${params.bucket}/${params.prefix || ""}`);

  // Build URL
  const endpoint = params.endpoint.endsWith("/") ? params.endpoint.slice(0, -1) : params.endpoint;
  const url = new URL(`${endpoint}/${params.bucket}`);
  url.searchParams.set("list-type", "2");
  if (params.prefix) {
    url.searchParams.set("prefix", params.prefix);
  }

  const headers: Record<string, string> = {};
  const signedHeaders = await sign("GET", url, headers, null, params.accessKey, params.secretKey, region);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: signedHeaders,
      signal: ctx.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 list failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const text = await response.text();

    // Parse XML response
    const objects: S3Object[] = [];
    const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
    let match;

    while ((match = contentRegex.exec(text)) !== null) {
      const content = match[1];
      const keyMatch = content.match(/<Key>([^<]+)<\/Key>/);
      const sizeMatch = content.match(/<Size>([^<]+)<\/Size>/);
      const lastModifiedMatch = content.match(/<LastModified>([^<]+)<\/LastModified>/);

      if (keyMatch) {
        objects.push({
          key: keyMatch[1],
          size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
          lastModified: lastModifiedMatch ? lastModifiedMatch[1] : ""
        });
      }
    }

    if (ctx.log) ctx.log(`[S3] Found ${objects.length} objects`);

    return {
      objects,
      count: objects.length
    };
  } catch (e: unknown) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}

async function deleteObject(
  ctx: PipelineContext,
  params: S3Params,
  region: string
): Promise<S3DeleteResult> {
  if (!params.key) {
    throw new Error("S3 delete requires 'key' parameter");
  }

  if (ctx.log) ctx.log(`[S3] Deleting s3://${params.bucket}/${params.key}`);

  // Build URL
  const endpoint = params.endpoint.endsWith("/") ? params.endpoint.slice(0, -1) : params.endpoint;
  const url = new URL(`${endpoint}/${params.bucket}/${params.key}`);

  const headers: Record<string, string> = {};
  const signedHeaders = await sign("DELETE", url, headers, null, params.accessKey, params.secretKey, region);

  try {
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: signedHeaders,
      signal: ctx.signal,
    });

    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(`S3 delete failed: ${response.status} ${response.statusText} - ${text}`);
    }

    if (ctx.log) ctx.log(`[S3] Delete successful: ${params.key}`);

    return {
      success: true,
      key: params.key
    };
  } catch (e: unknown) {
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}

