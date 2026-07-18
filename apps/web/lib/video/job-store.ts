import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateVideoJobInput } from "@openvideo/contracts";
import type { VideoJob } from "./types";
import { createVariationIdentity, type VariationIdentity } from "./creative-system";

const cwd = process.cwd();
const workspaceRoot = path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps" ? path.resolve(cwd, "../..") : cwd;
export const jobsRoot = process.env.VIDEO_JOBS_ROOT ?? path.join(workspaceRoot, ".data/video-jobs");

function jobFile(id: string) { return path.join(jobsRoot, id, "job.json"); }

export async function createVideoJob(id: string, input: CreateVideoJobInput, identity: VariationIdentity = createVariationIdentity()): Promise<VideoJob> {
  const now = new Date().toISOString();
  const job: VideoJob = { id, input, ...identity, status: "queued", progress: 2, stage: "Queued", createdAt: now, updatedAt: now };
  await mkdir(path.dirname(jobFile(id)), { recursive: true });
  await saveVideoJob(job);
  return job;
}

export async function getVideoJob(id: string): Promise<VideoJob | null> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  try { return JSON.parse(await readFile(jobFile(id), "utf8")) as VideoJob; } catch { return null; }
}

export async function saveVideoJob(job: VideoJob): Promise<void> {
  const file = jobFile(job.id);
  const temp = `${file}.${process.pid}.tmp`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(temp, JSON.stringify({ ...job, updatedAt: new Date().toISOString() }, null, 2));
  await rename(temp, file);
}

export function jobDirectory(id: string) { return path.join(jobsRoot, id); }
