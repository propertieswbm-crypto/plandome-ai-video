import {existsSync} from "node:fs";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import type {CreativeProject} from "../../../../creative-project/src/types";
import {RemotionRendererAdapter} from "../renderer-adapter";
import type {VariationProfile} from "../project-schema";
import {VariationPlanner,visualFingerprint} from "../variation/variation-planner";

const root=path.resolve(import.meta.dirname,"../../../../..");
const outputDir=path.join(root,"outputs/remotion-review/plandome-extension-ad-v2");
const project=JSON.parse(await readFile(path.join(root,"packages/test-kits/golden-projects/plandome-extension-ad.json"),"utf8")) as CreativeProject;
const narrationCuts=[0,3.1815,5.62185,8.82277,11.4526,15.23];
project.brief.durationSeconds=narrationCuts.at(-1)!;
project.scenes=project.scenes.map((scene,index)=>({...scene,start:narrationCuts[index]!,duration:narrationCuts[index+1]!-narrationCuts[index]!}));
project.captions=project.captions.map((caption,index)=>({...caption,start:narrationCuts[index]!,end:narrationCuts[index+1]!}));
const base=new VariationPlanner().plan(project,"plandome-extension-ad-v2",[],.2);
const variation:VariationProfile={...base,
  templateSequence:["premium-editorial-property","construction-risk","technical-blueprint","report-review","branded-cta-contact"],
  layoutSequence:["full-bleed","full-bleed","technical-frame","report-card","full-cta"],
  cameraSequence:["slow-push","slow-pull","blueprint-depth","document-reveal","slow-pull"],
  transitionSequence:["crossfade","architectural-mask","line-draw","document-page","clean-slide"],
  textAlignmentSequence:["left","left","left","left","center"],
  imageMaskSequence:["none","none","split","document-frame","none"],
  headlineTreatmentSequence:["architectural-rule","underline","technical","editorial","minimal"],
  dominantVisualFamily:"editorial-property",supportingVisualFamily:"technical-blueprint",
  captionTreatment:"minimal-active-word",overlayDensity:.35,motionIntensity:.5,pacingProfile:"balanced",typographyScale:1.1,ctaTreatment:"report-led",
};
const mimeFor=(uri:string)=>uri.endsWith(".jpg")||uri.endsWith(".jpeg")?"image/jpeg":"image/png";
const dataUri=async(uri:string,mime=mimeFor(uri))=>`data:${mime};base64,${(await readFile(path.join(root,uri))).toString("base64")}`;
const sceneMedia=Object.fromEntries(await Promise.all(project.assets.map(async(asset)=>[asset.sceneId,await dataUri(asset.uri)])));
const logoPath=await dataUri("apps/web/public/brand/plandome-logo.png");
const narrationFile=process.env.REMOTION_REVIEW_NARRATION??path.join(root,".data/remotion-review/narration.mp3");
const narrationPath=existsSync(narrationFile)?await dataUri(path.relative(root,narrationFile).replaceAll("\\","/"),"audio/mpeg"):undefined;
await mkdir(outputDir,{recursive:true});
const outputPath=path.join(outputDir,"plandome-extension-ad-v2.mp4");
const artifact=await new RemotionRendererAdapter().render({project,exportId:"golden-v2",variation,sceneMedia,narrationPath,logoPath,outputPath,width:1080,height:1920,fps:30,codec:"h264",quality:"production",renderingSeed:variation.seed,contentHash:visualFingerprint(variation,project.assets.map((asset)=>asset.assetId))},{onProgress:(progress)=>process.stdout.write(`render-progress ${Math.round(progress*100)}%\n`)});
await Promise.all([
  writeFile(path.join(outputDir,"CreativeProject.json"),JSON.stringify(project,null,2)),
  writeFile(path.join(outputDir,"VariationProfile.json"),JSON.stringify(variation,null,2)),
  writeFile(path.join(outputDir,"asset-manifest.json"),JSON.stringify(project.assets,null,2)),
]);
process.stdout.write(`${JSON.stringify({artifact,templates:variation.templateSequence,motions:variation.cameraSequence,transitions:variation.transitionSequence},null,2)}\n`);
