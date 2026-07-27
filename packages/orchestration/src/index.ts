import type {
  CreativeProject, CreativeScene,
} from "../../creative-project/src/types";
import type {
  ProjectQualityScorecard, QualityDimension, QualityThresholds, SceneQualityScore,
} from "../../domain/src";
import { ContinuityManager } from "../../creative-engine/src";
import { TemplateRegistry } from "../../templates/src";

export const productionQualityThresholds: QualityThresholds = {
  overall:82,
  dimensions:{
    semanticRelevance:78, visualConsistency:80, brandCompliance:90, typography:82,
    motion:78, pacing:76, assetQuality:78, renderingReliability:90,
  },
};
const weights: Record<QualityDimension,number> = {
  semanticRelevance:.2, visualConsistency:.14, brandCompliance:.14, typography:.1,
  motion:.12, pacing:.1, assetQuality:.12, renderingReliability:.08,
};
const clamp = (value:number) => Math.max(0,Math.min(100,Math.round(value)));
const weighted = (scores:Record<QualityDimension,number>) =>
  clamp((Object.keys(weights) as QualityDimension[]).reduce((sum,key)=>sum+scores[key]*weights[key],0));

export class PreRenderQualityGate {
  constructor(
    private readonly templates = new TemplateRegistry(),
    private readonly thresholds = productionQualityThresholds,
  ) {}
  evaluate(project: CreativeProject, repairAttempts=0): ProjectQualityScorecard {
    const scenes = project.scenes.filter((scene)=>scene.enabled).map((scene,index,all)=>
      this.evaluateScene(project,scene,index,all));
    const overall = scenes.length ? clamp(scenes.reduce((sum,scene)=>sum+scene.overall,0)/scenes.length) : 0;
    const hardReject = scenes.some((scene)=>scene.decision==="reject");
    const needsRepair = overall < this.thresholds.overall || scenes.some((scene)=>scene.decision==="repair");
    return {
      schemaVersion:"1.0", evaluatedAt:new Date().toISOString(), thresholds:this.thresholds,
      scenes, overall, decision:hardReject || (needsRepair && repairAttempts>=2) ? "reject" : needsRepair ? "repair" : "accept",
      repairAttempts,
    };
  }
  repair(project: CreativeProject, scorecard: ProjectQualityScorecard) {
    new ContinuityManager().repair(project.scenes);
    for (const result of scorecard.scenes) {
      const scene = project.scenes.find((item)=>item.id===result.sceneId);
      if (!scene || scene.locked) continue;
      const template = this.templates.require(scene.templateId);
      if (scene.headline.length > template.capabilities.maxCopyCharacters) {
        scene.headline = scene.headline.slice(0,template.capabilities.maxCopyCharacters).replace(/\s+\S*$/,"");
      }
      scene.motion.energy = Math.max(.32,Math.min(.82,scene.motion.energy));
    }
    project.updatedAt = new Date().toISOString();
    return project;
  }
  run(project: CreativeProject, maximumRepairs=2) {
    let scorecard = this.evaluate(project,0);
    while (scorecard.decision==="repair" && scorecard.repairAttempts<maximumRepairs) {
      this.repair(project,scorecard);
      scorecard=this.evaluate(project,scorecard.repairAttempts+1);
    }
    return scorecard;
  }
  private evaluateScene(project:CreativeProject,scene:CreativeScene,index:number,all:CreativeScene[]):SceneQualityScore {
    const asset = project.assets.find((item)=>item.assetId===scene.selectedAssetId || item.sceneId===scene.id);
    const template = this.templates.get(scene.templateId);
    const previous = all[index-1];
    const scores:Record<QualityDimension,number> = {
      semanticRelevance:clamp(asset ? asset.semanticScore*100 : 62),
      visualConsistency:clamp(94-(previous?.camera.shotSize===scene.camera.shotSize ? 18:0)-(scene.referenceStyle!==project.artDirection.name ? 18:0)),
      brandCompliance:clamp(project.brand.mandatory && !project.brand.logoUri ? 0 : 96),
      typography:clamp(template && scene.headline.length<=template.capabilities.maxCopyCharacters ? 92:62),
      motion:clamp(template?.capabilities.supportedCameraMoves.includes(scene.camera.move) && scene.motion.energy>=.25 && scene.motion.energy<=.9 ? 90:65),
      pacing:clamp(template && scene.duration>=Math.max(1,template.capabilities.preferredDuration[0]-1.5) && scene.duration<=template.capabilities.preferredDuration[1]+1.5 ? 90:68),
      assetQuality:clamp(asset ? asset.qualityScore*100 : 60),
      renderingReliability:clamp(template && scene.duration>0 && scene.start>=0 ? 96:30),
    };
    const repairs=(Object.keys(scores) as QualityDimension[])
      .filter((key)=>scores[key]<this.thresholds.dimensions[key])
      .map((key)=>`Repair ${key} (${scores[key]}/${this.thresholds.dimensions[key]}).`);
    const overall=weighted(scores);
    const critical=scores.brandCompliance<this.thresholds.dimensions.brandCompliance-20
      || scores.renderingReliability<this.thresholds.dimensions.renderingReliability-20;
    return { sceneId:scene.id,scores,overall,decision:critical?"reject":repairs.length?"repair":"accept",repairs };
  }
}

export interface StageCache {
  has(stage:string,inputHash:string):Promise<boolean>;
  mark(stage:string,inputHash:string,artifactUri:string):Promise<void>;
}
export class DurableRenderOrchestrator {
  constructor(private readonly cache:StageCache) {}
  async executeStage(stage:string,inputHash:string,run:()=>Promise<string>) {
    if (await this.cache.has(stage,inputHash)) return { reused:true };
    const artifactUri=await run();
    await this.cache.mark(stage,inputHash,artifactUri);
    return { reused:false,artifactUri };
  }
}
