import {createHash} from "node:crypto";
import {mkdir,rename,rm} from "node:fs/promises";
import path from "node:path";
import {bundle} from "@remotion/bundler";
import {renderMedia,selectComposition} from "@remotion/renderer";
import type {RendererAdapter,RendererArtifact} from "../../src";
import type {RemotionRenderInput} from "./project-schema";
import {validateRenderInput} from "./project-schema";
import {validateMp4} from "./output-validation";

let bundlePromise:Promise<string>|undefined;
const contentHash=(input:RemotionRenderInput)=>createHash("sha256").update(JSON.stringify({project:input.project,variation:input.variation,exportId:input.exportId})).digest("hex");
export class RemotionRendererAdapter implements RendererAdapter<RemotionRenderInput>{
  readonly descriptor={id:"remotion" as const,production:false,available:true,projectNeutral:true};
  validate=validateRenderInput;
  async render(input:RemotionRenderInput,options?:{onProgress?:(progress:number)=>void;signal?:AbortSignal}):Promise<RendererArtifact>{
    this.validate(input);if(options?.signal?.aborted)throw new Error("Remotion render cancelled.");
    bundlePromise??=bundle({entryPoint:path.join(import.meta.dirname,"entry.tsx"),webpackOverride:(config)=>config});
    const serveUrl=await bundlePromise,composition=await selectComposition({serveUrl,id:"PlandomeVideo",inputProps:input});
    await mkdir(path.dirname(input.outputPath),{recursive:true});const temporary=`${input.outputPath}.${process.pid}.tmp.mp4`;
    try{
      await renderMedia({composition,serveUrl,codec:"h264",outputLocation:temporary,inputProps:input,onProgress:({progress})=>options?.onProgress?.(progress)});
      if(options?.signal?.aborted)throw new Error("Remotion render cancelled.");
      const expectedDuration=input.project.scenes.reduce((max,scene)=>Math.max(max,scene.start+scene.duration),0);
      const ffprobe=process.env.FFPROBE_PATH??path.resolve(import.meta.dirname,"../../../../../tools/ffmpeg/ffmpeg-8.1.2-essentials_build/bin/ffprobe.exe");
      const probe=await validateMp4(temporary,ffprobe,{width:input.width,height:input.height,fps:input.fps,durationSeconds:expectedDuration,audio:Boolean(input.narrationPath)});
      await rename(temporary,input.outputPath);
      return{path:input.outputPath,mimeType:"video/mp4",codec:probe.codec,width:probe.width,height:probe.height,fps:probe.fps,durationSeconds:probe.durationSeconds,sizeBytes:probe.sizeBytes,contentHash:contentHash(input)};
    }catch(error){await rm(temporary,{force:true});throw error;}
  }
}
