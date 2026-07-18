import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVideoJob, jobDirectory } from "../apps/web/lib/video/job-store";
import { putRemoteObject, saveRemoteVideoJob } from "../apps/web/lib/video/remote-store";

async function main(){
 const id=process.argv[2]; if(!id)throw new Error("Usage: tsx scripts/sync-video-job.ts <job-id>");
 const env=await readFile(path.resolve("apps/web/.env.local"),"utf8"); for(const line of env.split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match)process.env[match[1]!]??=match[2]!.trim().replace(/^['"]|['"]$/g,"");}
 const job=await getVideoJob(id); if(!job||job.status!=="completed")throw new Error("Only a completed local job can be synchronized."); const directory=jobDirectory(id);
 await putRemoteObject(`outputs/${id}.mp4`,await readFile(path.join(directory,"output.mp4")),"video/mp4"); await putRemoteObject(`outputs/${id}-canva.html`,await readFile(path.join(directory,"composition/canva-editable.html")),"text/html; charset=utf-8"); await putRemoteObject(`outputs/${id}-inspector.json`,await readFile(path.join(directory,"generation-inspector.json")),"application/json"); await saveRemoteVideoJob(job); process.stdout.write(`Synchronized ${id} at 100%.\n`);
}
void main();
