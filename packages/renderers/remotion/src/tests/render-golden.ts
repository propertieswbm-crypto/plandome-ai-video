import {readFile} from "node:fs/promises";
import path from "node:path";
import type {CreativeProject} from "../../../../creative-project/src/types";
import {RemotionRendererAdapter} from "../renderer-adapter";
import {VariationPlanner,visualFingerprint} from "../variation/variation-planner";
const root=path.resolve(import.meta.dirname,"../../../../..");
const project=JSON.parse(await readFile(path.join(root,"packages/test-kits/golden-projects/plandome-extension-ad.json"),"utf8")) as CreativeProject;
const recent=[];for(let index=0;index<5;index++){
  const variation=new VariationPlanner().plan(project,`golden-${index}`,recent,.2);recent.push(variation);
  const output=path.join(root,".data/remotion-validation",`plandome-extension-${index+1}.mp4`);
  const artifact=await new RemotionRendererAdapter().render({project,exportId:"golden",variation,sceneMedia:{},logoPath:path.join(root,"apps/web/public/brand/plandome-logo.png"),outputPath:output,width:360,height:640,fps:24,codec:"h264",quality:"preview",renderingSeed:variation.seed,contentHash:visualFingerprint(variation,[])},{onProgress:(progress)=>process.stdout.write(`variant ${index+1}: ${Math.round(progress*100)}%\r`)});
  process.stdout.write(`${artifact.path} ${visualFingerprint(variation,[])}\n`);
}
