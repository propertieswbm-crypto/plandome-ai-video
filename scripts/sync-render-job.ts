import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVideoJob, jobDirectory } from "../apps/web/lib/video/job-store";
import { putRemoteObject, saveRemoteVideoJob } from "../apps/web/lib/video/remote-store";

const root = path.resolve(import.meta.dirname, "..");

async function main() {
  const id = process.argv[2];
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("Pass a valid video job ID.");
  const env = await readFile(path.join(root, "apps/web/.env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); if (match) process.env[match[1]] ??= match[2].trim().replace(/^['\"]|['\"]$/g, ""); }
  const job = await getVideoJob(id);
  if (!job || job.status !== "completed") throw new Error("The local job is not completed.");
  await putRemoteObject(`outputs/${id}.mp4`, await readFile(path.join(jobDirectory(id), "output.mp4")), "video/mp4");
  await putRemoteObject(`outputs/${id}-canva.html`, await readFile(path.join(jobDirectory(id), "composition/canva-editable.html")), "text/html; charset=utf-8");
  await saveRemoteVideoJob(job);
}

void main();
