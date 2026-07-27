import type { CreativeProject, QualityFinding } from "./types";

export interface RenderObservation {
  sceneId: string;
  ocrText: string[];
  detectedLogos: string[];
  dominantColours: string[];
  visualDescription: string;
  duplicateOfSceneId?: string;
  blackFrameRatio: number;
  safeZoneViolations: string[];
  compositionScore: number;
  readabilityScore: number;
}

export function evaluateRender(project: CreativeProject, observations: RenderObservation[]): QualityFinding[] {
  const findings: QualityFinding[] = [];
  for (const observation of observations) {
    const scene = project.scenes.find((item) => item.id === observation.sceneId);
    if (!scene) continue;
    if (observation.blackFrameRatio > .02) findings.push({id:`black-${scene.id}`,stage:"render",sceneId:scene.id,check:"black-frames",severity:"error",message:"Black or empty frames exceed tolerance.",repairAction:"Re-render this scene."});
    if (observation.safeZoneViolations.length) findings.push({id:`safe-${scene.id}`,stage:"render",sceneId:scene.id,check:"safe-zones",severity:"error",message:`Safe-zone violations: ${observation.safeZoneViolations.join(", ")}.`,repairAction:"Reflow text and protected brand elements."});
    if (observation.duplicateOfSceneId) findings.push({id:`duplicate-${scene.id}`,stage:"render",sceneId:scene.id,check:"duplicate-visual",severity:"error",message:`Visual duplicates ${observation.duplicateOfSceneId}.`,repairAction:"Resolve a different asset for this scene."});
    if (!observation.detectedLogos.some((logo)=>/plandome/i.test(logo)) && project.brand.mandatory) findings.push({id:`brand-${scene.id}`,stage:"render",sceneId:scene.id,check:"brand-logo",severity:"error",message:"Required Plandome branding was not detected.",repairAction:"Restore the protected logo layer."});
    if (observation.readabilityScore < .8) findings.push({id:`readability-${scene.id}`,stage:"render",sceneId:scene.id,check:"readability",severity:"error",message:"Text readability is below target.",repairAction:"Increase contrast, size or display duration."});
    if (observation.compositionScore < .75) findings.push({id:`composition-${scene.id}`,stage:"render",sceneId:scene.id,check:"composition",severity:"warning",message:"Composition balance is below target.",repairAction:"Reframe the asset or change the template."});
  }
  return findings;
}
