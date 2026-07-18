import { NextResponse } from "next/server";
import { getVideoJob } from "@/lib/video/job-store";
import { getRemoteVideoJob } from "@/lib/video/remote-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = process.env.VERCEL ? await getRemoteVideoJob(id) : await getVideoJob(id);
  return job ? NextResponse.json(job, { headers: { "cache-control": "no-store" } }) : NextResponse.json({ detail: "Video job not found." }, { status: 404 });
}
