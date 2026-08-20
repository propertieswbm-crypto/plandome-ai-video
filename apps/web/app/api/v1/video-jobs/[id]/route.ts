import { NextResponse } from "next/server";
import { getVideoJob } from "@/lib/video/job-store";
import { getRemoteVideoJob, listRemoteQueue } from "@/lib/video/remote-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = process.env.VERCEL ? await getRemoteVideoJob(id) : await getVideoJob(id);
  if (!job) return NextResponse.json({ detail: "Video job not found." }, { status: 404 });
  const heartbeatAt = Date.parse(job.updatedAt);
  const heartbeatAgeSeconds = Number.isFinite(heartbeatAt) ? Math.max(0, Math.floor((Date.now() - heartbeatAt) / 1_000)) : 0;
  const terminal = job.status === "completed" || job.status === "failed";
  const queued = !terminal && (/queu|wait/i.test(job.stage) || job.progress < 10);
  const renderHealth = job.status === "completed" ? "complete" : job.status === "failed" ? "failed" : queued ? "queued" : heartbeatAgeSeconds <= 45 ? "live" : "delayed";
  let queuePosition: number | undefined;
  let queueDepth: number | undefined;
  if (process.env.VERCEL && queued) {
    const queue = await listRemoteQueue();
    const index = queue.indexOf(`${id}.json`);
    if (index >= 0) { queuePosition = index + 1; queueDepth = queue.length; }
  }
  return NextResponse.json({ ...job, heartbeatAgeSeconds, renderHealth, ...(queuePosition ? { queuePosition, queueDepth } : {}) }, {
    headers: { "cache-control": "no-store, no-cache, must-revalidate", "x-render-health": renderHealth },
  });
}
