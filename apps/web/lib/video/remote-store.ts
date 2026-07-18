import type { VideoJob } from "./types";

const bucket = "video-renders";

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase render storage is not configured.");
  return { url, headers: { apikey: key, authorization: `Bearer ${key}` } };
}

async function ensureBucket() {
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers });
  if (response.ok) return;
  if (response.status !== 400 && response.status !== 404) throw new Error(`Render storage check failed (${response.status}).`);
  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 50_000_000 }),
  });
  if (!created.ok && created.status !== 409) throw new Error(`Render storage setup failed (${created.status}): ${(await created.text()).slice(0, 200)}`);
}

export async function putRemoteObject(objectPath: string, data: BodyInit, contentType: string) {
  await ensureBucket();
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, { method: "POST", headers: { ...headers, "content-type": contentType, "x-upsert": "true" }, body: data });
  if (!response.ok) throw new Error(`Render storage upload failed (${response.status}).`);
}

export async function getRemoteObject(objectPath: string): Promise<Response | null> {
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, { headers, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Render storage read failed (${response.status}).`);
  return response;
}

export async function saveRemoteVideoJob(job: VideoJob) {
  const value = JSON.stringify({ ...job, updatedAt: new Date().toISOString() });
  await putRemoteObject(`jobs/${job.id}.json`, value, "application/json");
}

export async function enqueueRemoteVideoJob(job: VideoJob) {
  await saveRemoteVideoJob(job);
  await putRemoteObject(`queue/${job.id}.json`, JSON.stringify(job), "application/json");
}

export async function getRemoteVideoJob(id: string): Promise<VideoJob | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const response = await getRemoteObject(`jobs/${id}.json`);
  return response ? await response.json() as VideoJob : null;
}

export async function listRemoteQueue(): Promise<string[]> {
  await ensureBucket();
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/object/list/${bucket}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ prefix: "queue", limit: 100, offset: 0, sortBy: { column: "created_at", order: "asc" } }) });
  if (!response.ok) throw new Error(`Render queue listing failed (${response.status}).`);
  const entries = await response.json() as Array<{ name?: string }>;
  return entries.map((entry) => entry.name ?? "").filter((name) => /^[a-f0-9-]{36}\.json$/.test(name));
}

export async function removeRemoteQueueItem(file: string) {
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ prefixes: [`queue/${file}`] }) });
  if (!response.ok) throw new Error(`Render queue claim failed (${response.status}).`);
}
