import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createVideoJob, saveVideoJob } from "../apps/web/lib/video/job-store";
import { createVariationIdentity, selectCreative } from "../apps/web/lib/video/creative-system";
import { createVisualBrief, type DesignProfile } from "./video-quality";
import { writePremiumComposition, type PlannedScene } from "./premium-visual-composition";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const fixture = path.join(root, ".data/video-jobs/4dca33a1-b6d8-4df7-90ca-bb15e99f9fe7");
const ffmpegDir = path.join(root, "tools/ffmpeg/ffmpeg-8.1.2-essentials_build/bin");
const ffmpeg = path.join(ffmpegDir, "ffmpeg.exe");
const ffprobe = path.join(ffmpegDir, "ffprobe.exe");

type Alignment = { characters:string[]; character_start_times_seconds:number[]; character_end_times_seconds:number[] };
function words(alignment:Alignment) {
  const result:Array<{text:string;start:number;end:number}>=[]; let text=""; let start=0; let end=0;
  const flush=()=>{if(text.trim())result.push({text:text.trim(),start,end});text="";};
  alignment.characters.forEach((character,index)=>{if(/\s/.test(character)){flush();return;} if(!text)start=alignment.character_start_times_seconds[index]??end; text+=character; end=alignment.character_end_times_seconds[index]??start+.12;});
  flush(); return result;
}

async function main() {
  const sourceJob=JSON.parse(await readFile(path.join(fixture,"job.json"),"utf8")) as {input:{script:string}};
  const alignment=JSON.parse(await readFile(path.join(fixture,"narration-alignment.json"),"utf8")) as Alignment;
  const narration=path.join(fixture,"composition/assets/narration.mp3");
  const {stdout}=await exec(ffprobe,["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",narration]);
  const duration=Number(stdout.trim()); const allWords=words(alignment);
  const id=randomUUID(); const identity=createVariationIdentity("plandome-planning-refusal-v2");
  const job=await createVideoJob(id,{script:sourceJob.input.script,format:"portrait",quality:"production",useAvatar:false,sceneMediaUrls:[]},identity);
  const directory=path.join(root,".data/video-jobs",id); const composition=path.join(directory,"composition"); const assets=path.join(composition,"assets");
  await mkdir(assets,{recursive:true});
  const files=["01-refusal-drawings.png","02-policy-review.png","03-neighbour-impact.png","04-revised-submission.png"];
  await Promise.all(files.map(file=>copyFile(path.join(root,"assets/generated-planning-refusal-v2",file),path.join(assets,file))));
  await copyFile(narration,path.join(assets,"narration.mp3")); await copyFile(path.join(root,"apps/web/public/brand/plandome-logo.png"),path.join(assets,"logo.png"));
  const starts=[0,duration*.25,duration*.5,duration*.75]; const headlines=["REFUSAL IS A DIAGNOSIS","READ THE POLICY","TEST THE IMPACT","REVISE WITH EVIDENCE"];
  const texts=["A refusal does not always end the project.","Find the exact policy and design issue.","Test neighbour, heritage and access impacts.","Revise the scheme and submit stronger evidence."];
  const scenes:PlannedScene[]=starts.map((start,index)=>{const end=starts[index+1]??duration;return{text:texts[index]!,headline:headlines[index]!,visualAsset:files[index]!,start,duration:end-start,kind:index===0?"planning":"property",brief:createVisualBrief(`${texts[index]} UK Victorian planning application`,index,4,duration),captionWords:allWords.filter(word=>word.start>=start&&word.start<end)}});
  const creative=selectCreative(identity,[],scenes.length);
  const design:DesignProfile={generationId:identity.generationId,templateIndex:5,template:creative.template.name,paletteIndex:0,palette:{paper:"#F1ECE2",ink:"#132238",accent:"#D09A45",secondary:"#FFFDF7"},fontIndex:0,fonts:{heading:creative.fontPair.headingFont,body:creative.fontPair.bodyFont},overlay:"editorial",designSystemId:creative.designSystem.id,designSystemName:creative.designSystem.name,designSystemFamily:creative.designSystem.family,artDirection:creative.designSystem.artDirection,creativeFingerprint:creative.creativeFingerprint};
  await writePremiumComposition(composition,scenes,duration,false,design,identity.variationSeed);
  const env={...process.env,PATH:`${ffmpegDir}${path.delimiter}${process.env.PATH}`}; const hyperframes=path.join(root,"node_modules/hyperframes/dist/cli.js"); const silent=path.join(directory,"visual-master.mp4"); const output=path.join(directory,"output.mp4");
  await exec(process.execPath,[hyperframes,"lint",composition],{env,maxBuffer:10_000_000});
  await exec(process.execPath,[hyperframes,"render",composition,"--output",silent,"--quality","high","--fps","30","--workers","2","--strict"],{env,maxBuffer:10_000_000});
  await exec(ffmpeg,["-y","-i",silent,"-i",narration,"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",output],{env,maxBuffer:10_000_000});
  Object.assign(job,{status:"completed",progress:100,stage:"Relevant planning-refusal sample ready",outputUrl:`/api/v1/video-jobs/${id}/download`,creativeFingerprint:creative.creativeFingerprint}); await saveVideoJob(job); process.stdout.write(id);
}
void main();
