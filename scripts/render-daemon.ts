import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createVideoJob, getVideoJob, jobDirectory } from "../apps/web/lib/video/job-store";
import { getRemoteObject, listRemoteQueue, putRemoteObject, removeRemoteQueueItem, saveRemoteVideoJob } from "../apps/web/lib/video/remote-store";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");

async function loadEnv() {
  let text=""; try{text=await readFile(path.join(root,"apps/web/.env.local"),"utf8");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  for (const line of text.split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match) process.env[match[1]] ??= match[2].trim().replace(/^['\"]|['\"]$/g, ""); }
}

async function processJob(file: string) {
  const id = file.replace(/\.json$/, "");
  const queued = await getRemoteObject(`queue/${file}`);
  if (!queued) return;
  const remote = await queued.json() as NonNullable<Awaited<ReturnType<typeof getVideoJob>>>;
  await removeRemoteQueueItem(file);
  await createVideoJob(id, remote.input, { generationId: remote.generationId, variationSeed: remote.variationSeed, projectId: remote.projectId });
  const cli = path.join(root, "node_modules/tsx/dist/cli.mjs");
  const worker = path.join(root, "scripts/video-worker.ts");
  const child = exec(process.execPath, [cli, worker, id], { cwd: root, windowsHide: true, maxBuffer: 10_000_000 });
  let finished = false;
  void child.finally(() => { finished = true; });
  while (!finished) { const job = await getVideoJob(id); if (job) await saveRemoteVideoJob(job); await new Promise((resolve) => setTimeout(resolve, 2_000)); }
  await child;
  const job = await getVideoJob(id);
  if (!job) throw new Error(`Local render job ${id} disappeared.`);
  if (job.status === "completed") {
    await putRemoteObject(`outputs/${id}.mp4`, await readFile(path.join(jobDirectory(id), "output.mp4")), "video/mp4");
    await putRemoteObject(`outputs/${id}-canva.html`, await readFile(path.join(jobDirectory(id), "composition/canva-editable.html")), "text/html; charset=utf-8");
    await putRemoteObject(`outputs/${id}-inspector.json`, await readFile(path.join(jobDirectory(id), "generation-inspector.json")), "application/json");
  }
  await saveRemoteVideoJob(job);
}

async function main() {
  await loadEnv();
  process.stdout.write("Plandome production render worker online.\n");
  for (;;) {
    try { const queue = await listRemoteQueue(); if (queue[0]) await processJob(queue[0]); else await new Promise((resolve) => setTimeout(resolve, 3_000)); }
    catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); await new Promise((resolve) => setTimeout(resolve, 5_000)); }
  }
}

void main();
