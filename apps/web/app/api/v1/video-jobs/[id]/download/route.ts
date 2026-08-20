import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { getVideoJob, jobDirectory } from "@/lib/video/job-store";
import { getRemoteObject, getRemoteVideoJob } from "@/lib/video/remote-store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = process.env.VERCEL ? await getRemoteVideoJob(id) : await getVideoJob(id);
  if (!job || job.status !== "completed") return Response.json({ detail: "Video is not ready." }, { status: 404 });
  if (process.env.VERCEL) {
    const range = request.headers.get("range");
    const stored = await getRemoteObject(`outputs/${id}.mp4`, range ? { range } : {});
    if (!stored?.body) return Response.json({ detail: "Video file is not ready." }, { status: 404 });
    const contentLength = stored.headers.get("content-length");
    const contentRange = stored.headers.get("content-range");
    return new Response(stored.body, {
      status: stored.status,
      headers: {
        "content-type": "video/mp4",
        "content-disposition": `inline; filename="plandome-${id}.mp4"`,
        "cache-control": "private, no-store",
        "accept-ranges": "bytes",
        ...(contentLength ? { "content-length": contentLength } : {}),
        ...(contentRange ? { "content-range": contentRange } : {}),
      },
    });
  }
  const file = path.join(jobDirectory(id), "output.mp4");
  const info = await stat(file);
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { "content-type": "video/mp4", "content-length": String(info.size), "content-disposition": `inline; filename="plandome-${id}.mp4"`, "cache-control": "private, no-store", "accept-ranges": "bytes" },
  });
}
