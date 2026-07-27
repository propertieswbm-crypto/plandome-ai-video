import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getVideoJob, jobDirectory } from "@/lib/video/job-store";
import { getRemoteObject, getRemoteVideoJob } from "@/lib/video/remote-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = process.env.VERCEL ? await getRemoteVideoJob(id) : await getVideoJob(id);
  if (!job) return NextResponse.json({ detail:"Video job not found." }, { status:404 });
  if (process.env.VERCEL) {
    const response = await getRemoteObject(`projects/${id}.json`);
    if (!response) return NextResponse.json({ detail:"CreativeProject has not been generated yet." }, { status:404 });
    return new NextResponse(await response.text(), { headers:{ "content-type":"application/json", "cache-control":"no-store" } });
  }
  try {
    const project = await readFile(path.join(jobDirectory(id), "creative-project.json"), "utf8");
    return new NextResponse(project, { headers:{ "content-type":"application/json", "cache-control":"no-store" } });
  } catch {
    return NextResponse.json({ detail:"CreativeProject has not been generated yet." }, { status:404 });
  }
}
