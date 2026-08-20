import type { VideoJob } from "./types";

const bucket = "video-renders";
const maximumObjectSize = 50_000_000;
const queueLeaseDurationMs = Math.max(60, Number(process.env.RENDER_LEASE_SECONDS ?? "300")) * 1_000;
let queueSnapshot: { expiresAt: number; files: string[] } | undefined;
let bucketConfirmedUntil = 0;

function storageTimeoutMs(data?: BodyInit) {
  const base = Math.max(5_000, Number(process.env.RENDER_STORAGE_TIMEOUT_MS ?? "15000"));
  const bytes = typeof data === "string"
    ? data.length
    : data instanceof ArrayBuffer ? data.byteLength
      : ArrayBuffer.isView(data) ? data.byteLength
        : 0;
  return Math.max(base, Math.ceil(bytes / 1_000_000) * 2_000);
}

function storageSignal(data?: BodyInit) {
  return AbortSignal.timeout(storageTimeoutMs(data));
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase render storage is not configured.");
  return { url, headers: { apikey: key, authorization: `Bearer ${key}` } };
}

async function ensureBucket() {
  if (bucketConfirmedUntil > Date.now()) return;
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers, signal: storageSignal() });
  if (response.ok) {
    bucketConfirmedUntil = Date.now() + 5 * 60_000;
    return;
  }
  if (response.status !== 400 && response.status !== 404) throw new Error(`Render storage check failed (${response.status}).`);
  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: maximumObjectSize }), signal: storageSignal(),
  });
  if (!created.ok && created.status !== 409) throw new Error(`Render storage setup failed (${created.status}): ${(await created.text()).slice(0, 200)}`);
  bucketConfirmedUntil = Date.now() + 5 * 60_000;
}

export async function putRemoteObject(objectPath: string, data: BodyInit, contentType: string) {
  await ensureBucket();
  const { url, headers } = config();
  let lastError = "unknown upload failure";
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, { method: "POST", headers: { ...headers, "content-type": contentType, "x-upsert": "true" }, body: data, signal: storageSignal(data) });
      if (response.ok) return;
      lastError = `${response.status}: ${(await response.text()).slice(0, 200)}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(8_000, 500 * 2 ** (attempt - 1))));
  }
  throw new Error(`Render storage upload failed (${lastError})`);
}

export async function getRemoteObject(objectPath: string, options: { range?: string } = {}): Promise<Response | null> {
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${objectPath}`, {
    headers: { ...headers, ...(options.range ? { range: options.range } : {}) },
    cache: "no-store",
    signal: storageSignal(),
  });
  if (response.status === 404) return null;
  if (response.status === 400) {
    const detail = await response.text();
    if (detail.includes('"statusCode":"404"')) return null;
    throw new Error(`Render storage read failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`Render storage read failed (${response.status}).`);
  return response;
}

export async function saveRemoteVideoJob(job: VideoJob) {
  const value = JSON.stringify({ ...job, updatedAt: new Date().toISOString() });
  await putRemoteObject(`jobs/${job.id}.json`, value, "application/json");
  if (job.status === "completed") {
    await putRemoteObject(`completed-jobs/${job.id}.json`, value, "application/json");
  }
}

export async function enqueueRemoteVideoJob(job: VideoJob) {
  await saveRemoteVideoJob(job);
  await putRemoteObject(`queue/${job.id}.json`, JSON.stringify(job), "application/json");
  queueSnapshot = undefined;
}

export async function getRemoteVideoJob(id: string): Promise<VideoJob | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const completed = await getRemoteObject(`completed-jobs/${id}.json`);
  if (completed) return await completed.json() as VideoJob;
  const response = await getRemoteObject(`jobs/${id}.json`);
  return response ? await response.json() as VideoJob : null;
}

export async function listRemoteQueue(): Promise<string[]> {
  if (process.env.VERCEL && queueSnapshot && queueSnapshot.expiresAt > Date.now()) return queueSnapshot.files;
  await ensureBucket();
  const { url, headers } = config();
  const entries: Array<{ name?: string }> = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const response = await fetch(`${url}/storage/v1/object/list/${bucket}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ prefix: "queue", limit: pageSize, offset, sortBy: { column: "created_at", order: "asc" } }), signal: storageSignal() });
    if (!response.ok) throw new Error(`Render queue listing failed (${response.status}).`);
    const page = await response.json() as Array<{ name?: string }>;
    entries.push(...page);
    if (page.length < pageSize) break;
  }
  const files = entries.map((entry) => entry.name ?? "").filter((name) => /^[a-f0-9-]{36}\.json$/.test(name));
  if (process.env.VERCEL) queueSnapshot = { expiresAt: Date.now() + 3_000, files };
  return files;
}

export async function removeRemoteQueueItem(file: string) {
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ prefixes: [`queue/${file}`] }), signal: storageSignal() });
  if (!response.ok) throw new Error(`Render queue claim failed (${response.status}).`);
  queueSnapshot = undefined;
}

export async function releaseRemoteQueueClaim(file: string) {
  const { url, headers } = config();
  const response = await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [`claims/${file}`] }), signal: storageSignal(),
  });
  if (!response.ok) throw new Error(`Render queue lease release failed (${response.status}).`);
}

export async function claimRemoteQueueItem(file: string, workerId: string): Promise<boolean> {
  if (!/^[a-f0-9-]{36}\.json$/.test(file)) return false;
  await ensureBucket();
  const { url, headers } = config();
  const claimPath = `claims/${file}`;
  const createClaim = () => fetch(`${url}/storage/v1/object/${bucket}/${claimPath}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json", "x-upsert": "false" },
    body: JSON.stringify({ workerId, expiresAt: Date.now() + queueLeaseDurationMs }), signal: storageSignal(),
  });

  let response = await createClaim();
  if (response.ok) return true;
  if (response.status !== 400 && response.status !== 409) {
    throw new Error(`Render queue lease failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }

  const existing = await getRemoteObject(claimPath);
  if (!existing) return false;
  const lease = await existing.json().catch(() => null) as { expiresAt?: number } | null;
  if ((lease?.expiresAt ?? 0) > Date.now()) return false;

  await releaseRemoteQueueClaim(file);
  response = await createClaim();
  return response.ok;
}

export async function renewRemoteQueueClaim(file: string, workerId: string): Promise<boolean> {
  if (!/^[a-f0-9-]{36}\.json$/.test(file)) return false;
  const claimPath = `claims/${file}`;
  const existing = await getRemoteObject(claimPath);
  if (!existing) return false;
  const lease = await existing.json().catch(() => null) as { workerId?: string } | null;
  if (lease?.workerId !== workerId) return false;
  await putRemoteObject(claimPath, JSON.stringify({ workerId, expiresAt: Date.now() + queueLeaseDurationMs }), "application/json");
  return true;
}
