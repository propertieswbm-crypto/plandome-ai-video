import type { CreativeProject } from "../../../../creative-project/src/types";
import type { LayoutId,VariationProfile,VisualFamily } from "../project-schema";

const hash=(value:string)=>{let h=2166136261;for(const c of value){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const pick=<T>(items:readonly T[],seed:number,index:number)=>items[(seed+index*2654435761)%items.length]!;
const families:VisualFamily[]=["editorial-property","technical-blueprint","planning-document","premium-corporate","case-study","construction-risk","financial-analysis"];
const layouts:LayoutId[]=["media-left","media-right","full-bleed","lower-zone","circular-mask","curved-mask","document-frame","technical-frame","split-comparison","report-card","statistic"];
const cameras=["slow-push","slow-pull","pan-left","pan-right","vertical-reveal","document-reveal","detail-wide","static","parallax","comparison-wipe","blueprint-depth"];
const transitions=["crossfade","clean-slide","architectural-mask","subtle-zoom","document-page","comparison-wipe","line-draw","emphasis-cut"];
const templatesFor=(text:string,beat:string)=>{
  const value=text.toLowerCase();
  if(beat==="cta")return["branded-cta","branded-cta-property","branded-cta-contact"];
  if(/drain|foundation|steel|roof|insulation|fire|construction/.test(value))return["construction-risk","technical-blueprint"];
  if(/planning|council|permission|refusal|policy/.test(value))return["planning-document","report-review"];
  if(/cost|£|budget|financial|uplift|investment/.test(value))return["financial-appraisal","case-study-proof"];
  if(/before|after|comparison|transform/.test(value))return["before-after","case-study-proof"];
  if(/report|review|written|evidence/.test(value))return["report-review","planning-document"];
  if(/step|process|first|then|finally/.test(value))return["process-explanation","technical-blueprint"];
  if(/proof|result|approved|case study/.test(value))return["case-study-proof","before-after"];
  return beat==="hook"?["premium-editorial-property","technical-blueprint","planning-document"]:["technical-blueprint","process-explanation"];
};
export const visualFingerprint=(profile:VariationProfile,assetIds:string[])=>hash(JSON.stringify({
  family:profile.dominantVisualFamily,templates:profile.templateSequence,layouts:profile.layoutSequence,
  cameras:profile.cameraSequence,transitions:profile.transitionSequence,alignment:profile.textAlignmentSequence,
  masks:profile.imageMaskSequence,pacing:profile.pacingProfile,assets:assetIds,
})).toString(16).padStart(8,"0");
export const similarity=(a:VariationProfile,b:VariationProfile)=>{
  const fields:Array<keyof VariationProfile>=["dominantVisualFamily","templateSequence","layoutSequence","cameraSequence","transitionSequence","textAlignmentSequence","imageMaskSequence","pacingProfile","ctaTreatment"];
  return fields.reduce((sum,key)=>sum+(JSON.stringify(a[key])===JSON.stringify(b[key])?1:0),0)/fields.length;
};
export class VariationPlanner {
  plan(project:CreativeProject,seedValue:string,recent:VariationProfile[]=[],minimumDistance=.35):VariationProfile {
    for(let attempt=0;attempt<32;attempt++){
      const seed=`${seedValue}:${attempt}`;const numeric=hash(`${project.id}:${seed}:${project.brief.contentCategory}`);
      const dominant=pick(families,numeric,0);
      const templateSequence=project.scenes.map((scene,index)=>pick(templatesFor(scene.narration,scene.beat),numeric,index));
      const layoutSequence=project.scenes.map((scene,index)=>scene.beat==="cta"
        ? pick(["full-cta","property-cta"] as const,numeric,index)
        : pick(layouts.filter((layout)=>index===0||layout!==pick(layouts,numeric,index-1)),numeric,index));
      const profile:VariationProfile={version:"1.0",seed,dominantVisualFamily:dominant,
        templateSequence,layoutSequence,textAlignmentSequence:project.scenes.map((_,i)=>pick(["left","center","right"] as const,numeric,i)),
        headlineTreatmentSequence:project.scenes.map((_,i)=>pick(["editorial","underline","architectural-rule","minimal"] as const,numeric,i)),
        mediaFramingStrategy:pick(["full","contained","architectural-crop"],numeric,2),imageMaskSequence:project.scenes.map((_,i)=>pick(["none","circle","curve","split"],numeric,i)),
        cameraSequence:project.scenes.map((_,i)=>pick(cameras,numeric,i)),transitionSequence:project.scenes.map((_,i)=>pick(transitions,numeric,i)),
        captionTreatment:pick(["cream-bar","navy-subtitle","minimal-active-word"],numeric,4),overlayDensity:[.2,.35,.5][numeric%3]!,
        motionIntensity:[.35,.5,.65][numeric%3]!,pacingProfile:pick(["measured","balanced","brisk"] as const,numeric,5),
        typographyScale:[.9,1,1.1][numeric%3]!,ctaTreatment:pick(["minimal","property-background","contact-panel","report-led"],numeric,6),
        safeZoneProfile:project.brief.aspectRatio==="9:16"?"vertical":project.brief.aspectRatio==="1:1"?"square":"horizontal",
        assetDiversityRules:{maximumRepeats:1,minimumUniqueRatio:.75}};
      if(recent.every((item)=>1-similarity(profile,item)>=minimumDistance
        && item.templateSequence.join("|")!==profile.templateSequence.join("|")))return profile;
    }
    throw new Error("Unable to produce a sufficiently distinct variation profile.");
  }
}
