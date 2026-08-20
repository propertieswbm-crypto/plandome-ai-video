import type { CreativeProject } from "../../../creative-project/src/types";

export type VisualFamily="editorial-property"|"technical-blueprint"|"planning-document"|"premium-corporate"|"case-study"|"construction-risk"|"financial-analysis";
export type ApprovedDesignSystemId="plandome-architectural-editorial-v1"|"plandome-primary-design-reference-v1"|"plandome-hmo-cinematic-reference-v1"|"plandome-extension-technical-reference-v1";
export type LayoutId="media-left"|"media-right"|"full-bleed"|"lower-zone"|"circular-mask"|"curved-mask"|"document-frame"|"technical-frame"|"split-comparison"|"report-card"|"statistic"|"full-cta"|"property-cta";
export interface VariationProfile {
  version:"1.0"; seed:string; dominantVisualFamily:VisualFamily; supportingVisualFamily?:VisualFamily; approvedDesignSystemId?:ApprovedDesignSystemId;
  templateSequence:string[]; layoutSequence:LayoutId[]; textAlignmentSequence:Array<"left"|"center"|"right">;
  headlineTreatmentSequence:string[]; mediaFramingStrategy:string; imageMaskSequence:string[];
  cameraSequence:string[]; transitionSequence:string[]; captionTreatment:string; overlayDensity:number;
  motionIntensity:number; pacingProfile:"measured"|"balanced"|"brisk"; typographyScale:number;
  ctaTreatment:string; safeZoneProfile:"vertical"|"square"|"horizontal"; assetDiversityRules:{maximumRepeats:number;minimumUniqueRatio:number};
}
export interface RemotionRenderInput extends Record<string,unknown> {
  project:CreativeProject; exportId:string; variation:VariationProfile;
  sceneMedia:Record<string,string>; narrationPath?:string; musicPath?:string;
  soundEffectPaths?:Record<string,string>; logoPath:string; outputPath:string;
  width:number;height:number;fps:number;codec:"h264";quality:"preview"|"production";
  renderingSeed:string;contentHash:string;
}
export class RemotionInputError extends Error {
  constructor(public readonly code:string,message:string){super(message);this.name="RemotionInputError";}
}
export function validateRenderInput(input:RemotionRenderInput) {
  if(input.project.schemaVersion!=="1.0") throw new RemotionInputError("invalid_project","CreativeProject schemaVersion must be 1.0.");
  if(!input.project.scenes.length) throw new RemotionInputError("empty_storyboard","CreativeProject requires at least one scene.");
  if(!input.logoPath) throw new RemotionInputError("missing_logo","A resolved Plandome logo path is required.");
  if(!input.outputPath.endsWith(".mp4")) throw new RemotionInputError("invalid_export","Remotion output must be an MP4 path.");
  if(input.width<320||input.height<320||input.fps<12) throw new RemotionInputError("invalid_dimensions","Output dimensions or FPS are invalid.");
  if(input.variation.templateSequence.length!==input.project.scenes.length) throw new RemotionInputError("invalid_variation","Template sequence must map one-to-one to scenes.");
  for(const scene of input.project.scenes.filter((item)=>item.enabled)){
    const requirement=scene.assetRequirements[0];
    const media=input.sceneMedia[scene.id];
    if(requirement?.media&&!media&&scene.beat!=="cta"){
      throw new RemotionInputError("missing_scene_media",`Scene ${scene.id} requires resolved local media.`);
    }
    const mediaIdentity=media?.startsWith("data:")?media.slice(0,media.indexOf(",")):media;
    if(mediaIdentity&&/premium[-_ ]motion[-_ ]fallback|placeholder|blank|template[-_ ]visual/i.test(mediaIdentity)){
      throw new RemotionInputError("placeholder_scene_media",`Scene ${scene.id} contains prohibited placeholder media.`);
    }
    const narrationWords=String(scene.narration||"").trim().split(/\s+/).filter(Boolean);
    const mobileWordLimit=scene.beat==="hook"?7:9;
    if(String(scene.headline||"").trim().split(/\s+/).filter(Boolean).length>mobileWordLimit){
      scene.headline=(scene.beat==="cta"?narrationWords.slice(-mobileWordLimit):narrationWords.slice(0,mobileWordLimit)).join(" ");
    }
    const headline=String(scene.headline||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const narration=String(scene.narration||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    if(headline&&narration&&!narration.includes(headline))throw new RemotionInputError("misaligned_scene_copy",`Scene ${scene.id} headline must be an exact narration phrase.`);
  }
}
