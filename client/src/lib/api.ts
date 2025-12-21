const API_BASE = "http://localhost:8000/api"; // In prod this might be relative

export interface Pipeline {
  id: string;
  name: string;
  schedule?: string;
  steps: any[];
}

export async function getPipelines(): Promise<Pipeline[]> {
  const res = await fetch(`${API_BASE}/pipelines`);
  return res.json();
}

export async function getPipeline(id: string): Promise<Pipeline> {
  const res = await fetch(`${API_BASE}/pipelines/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

export async function savePipeline(id: string, pipeline: any) {
  const res = await fetch(`${API_BASE}/pipelines/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pipeline)
  });
  return res.json();
}

export async function runPipeline(id: string) {
  const res = await fetch(`${API_BASE}/run/${id}`, { method: "POST" });
  return res.json();
}

export async function getModules(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/modules`);
  return res.json();
}

export async function getModuleSource(id: string): Promise<string> {
  const res = await fetch(`${API_BASE}/modules/${id}`);
  const data = await res.json();
  return data.source;
}

export async function saveModule(id: string, source: string) {
  const res = await fetch(`${API_BASE}/modules/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source })
  });
  return res.json();
}
