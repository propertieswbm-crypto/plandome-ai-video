export type {
  ArtDirection, AssetDecision, AssetRequirement, CaptionPhrase, CreativeBrief,
  CreativeMemory, CreativeProject, CreativeScene, PipelineCheckpoint, PipelineStage,
  QualityFinding, TemplateDefinition, TimelineClip,
} from "../../creative-project/src/types";

export type QualityDimension =
  | "semanticRelevance" | "visualConsistency" | "brandCompliance" | "typography"
  | "motion" | "pacing" | "assetQuality" | "renderingReliability";

export interface QualityThresholds {
  overall: number;
  dimensions: Record<QualityDimension, number>;
}

export interface SceneQualityScore {
  sceneId: string;
  scores: Record<QualityDimension, number>;
  overall: number;
  decision: "accept" | "repair" | "reject";
  repairs: string[];
}

export interface ProjectQualityScorecard {
  schemaVersion: "1.0";
  evaluatedAt: string;
  thresholds: QualityThresholds;
  scenes: SceneQualityScore[];
  overall: number;
  decision: "accept" | "repair" | "reject";
  repairAttempts: number;
}
