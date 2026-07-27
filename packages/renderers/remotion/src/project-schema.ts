import type { CreativeProject } from "../../../creative-project/src/types";

export type VisualFamily="editorial-property"|"technical-blueprint"|"planning-document"|"premium-corporate"|"case-study"|"construction-risk"|"financial-analysis";
export type LayoutId="media-left"|"media-right"|"full-bleed"|"lower-zone"|"circular-mask"|"curved-mask"|"document-frame"|"technical-frame"|"split-comparison"|"report-card"|"statistic"|"full-cta"|"property-cta";
export interface VariationProfile {
  version:"1.0"; seed:string; dominantVisualFamily:VisualFamily; supportingVisualFamily?:VisualFamily;
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
    if(requirement?.media==="video"&&!input.sceneMedia[scene.id]&&scene.beat!=="cta"){
      throw new RemotionInputError("missing_scene_media",`Scene ${scene.id} requires resolved local media.`);
    }
  }
}
