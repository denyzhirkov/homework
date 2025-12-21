
export async function run(ctx: any, params: { url: string, method?: string, body?: any, headers?: Record<string, string> }) {
  const method = params.method || "GET";
  const headers = params.headers || {};
  let body = params.body;

  if (body && typeof body === "object") {
    body = JSON.stringify(body);
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  }

  console.log(`[HTTP] ${method} ${params.url}`);

  const res = await fetch(params.url, {
    method,
    headers,
    body
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch { }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
  }

  return {
    status: res.status,
    body: json || text,
    headers: Object.fromEntries(res.headers.entries())
  };
}
