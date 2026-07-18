import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { getVideoJob, jobDirectory } from "@/lib/video/job-store";
import { getRemoteObject, getRemoteVideoJob } from "@/lib/video/remote-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = process.env.VERCEL ? await getRemoteVideoJob(id) : await getVideoJob(id);
  if (!job || job.status !== "completed") return Response.json({ detail: "Canva edit file is not ready." }, { status: 404 });
  if (process.env.VERCEL) {
    const stored = await getRemoteObject(`outputs/${id}-canva.html`);
    if (!stored?.body) return Response.json({ detail: "Canva edit file is not ready." }, { status: 404 });
    return new Response(stored.body, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename="plandome-${id}-canva.html"`, "cache-control": "private, no-store" } });
  }
  const file = path.join(jobDirectory(id), "composition", "canva-editable.html");
  const info = await stat(file);
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { "content-type": "text/html; charset=utf-8", "content-length": String(info.size), "content-disposition": `attachment; filename="plandome-${id}-canva.html"`, "cache-control": "private, no-store" },
  });
}
