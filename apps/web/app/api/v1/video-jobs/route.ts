import { spawn } from "node:child_process";
import path from "node:path";
import { createVideoJobSchema, type ProblemDetails } from "@openvideo/contracts";
import { logger } from "@openvideo/observability";
import { NextResponse, type NextRequest } from "next/server";
import { createVideoJob, saveVideoJob } from "@/lib/video/job-store";
import { enqueueRemoteVideoJob } from "@/lib/video/remote-store";
import { createVariationIdentity } from "@/lib/video/creative-system";

export const runtime = "nodejs";

function problem(requestId: string, status: number, code: string, detail: string) {
  const body: ProblemDetails = { type: "about:blank", title: "Video job could not be created", status, code, detail, requestId };
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const parsed = createVideoJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(requestId, 422, "validation_failed", "Paste a script between 20 and 3,000 characters.");
  const id = crypto.randomUUID();
  const identity = createVariationIdentity();
  if (process.env.VERCEL) {
    const now = new Date().toISOString();
    const job = { id, input: parsed.data, ...identity, status: "queued" as const, progress: 2, stage: "Queued for production renderer", createdAt: now, updatedAt: now };
    try { await enqueueRemoteVideoJob(job); }
    catch (error) { logger.error({ event: "video_job.queue_failed", requestId, jobId: id, error: error instanceof Error ? error.message : String(error) }, "Remote video queue failed"); return problem(requestId, 503, "queue_unavailable", "The production render queue is temporarily unavailable."); }
    return NextResponse.json(job, { status: 202, headers: { location: `/api/v1/video-jobs/${id}` } });
  }
  const job = await createVideoJob(id, parsed.data, identity);
  const root = path.resolve(process.cwd(), "../..");
  const worker = path.join(root, "scripts", "video-worker.ts");
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  try {
    const child = spawn(process.execPath, [tsxCli, worker, id], { cwd: root, stdio: "ignore", windowsHide: true });
    child.once("error", async (error) => {
      job.status = "failed";
      job.stage = "Worker could not start";
      job.error = { code: "worker_launch_failed", message: "The local video worker could not start. Restart the development server and try again." };
      await saveVideoJob(job);
      logger.error({ event: "video_job.worker_launch_failed", requestId, jobId: id, error: error.message }, "Video worker launch failed");
    });
    child.unref();
  } catch (error) {
    job.status = "failed";
    job.stage = "Worker could not start";
    job.error = { code: "worker_launch_failed", message: "The local video worker could not start. Restart the development server and try again." };
    await saveVideoJob(job);
    logger.error({ event: "video_job.worker_launch_failed", requestId, jobId: id, error: error instanceof Error ? error.message : String(error) }, "Video worker launch failed");
    return problem(requestId, 503, "worker_launch_failed", job.error.message);
  }
  logger.info({ event: "video_job.created", requestId, jobId: id }, "Video render job created");
  return NextResponse.json(job, { status: 202, headers: { location: `/api/v1/video-jobs/${id}` } });
}
