import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getRemoteObject } from "@/lib/video/remote-store";
import { getVideoJob, jobDirectory } from "@/lib/video/job-store";

export const runtime="nodejs";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params; if(process.env.NODE_ENV==="production" && process.env.ENABLE_GENERATION_INSPECTOR!=="true") return NextResponse.json({detail:"Inspector is disabled."},{status:404});
 const job=await getVideoJob(id); if(process.env.VERCEL){const object=await getRemoteObject(`outputs/${id}-inspector.json`); if(!object) return NextResponse.json({detail:"Inspector not ready."},{status:404}); return new Response(object.body,{headers:{"content-type":"application/json","cache-control":"private, no-store"}});}
 if(!job) return NextResponse.json({detail:"Job not found."},{status:404}); try{return NextResponse.json(JSON.parse(await readFile(path.join(jobDirectory(id),"generation-inspector.json"),"utf8")));}catch{return NextResponse.json({detail:"Inspector not ready."},{status:404});}
}
