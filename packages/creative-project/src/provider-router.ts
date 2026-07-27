import type { AspectRatio, AssetDecision, AssetRequirement } from "./types";

export interface ProviderCapabilities {
  media: Array<"video" | "image" | "audio" | "avatar">;
  aspectRatios: AspectRatio[];
  licensing: string;
  supportsReferences: boolean;
}

export interface ProviderHealth {
  available: boolean;
  latencyMs: number;
  quality: number;
  checkedAt: string;
}

export interface ProviderRequest {
  sceneId: string;
  requirement: AssetRequirement;
  aspectRatio: AspectRatio;
  prompt: string;
  excludedAssetIds: string[];
}

export interface ProviderCandidate {
  id: string;
  uri: string;
  mediaType: "video" | "image" | "audio";
  sourceUrl?: string;
  license: string;
  width: number;
  height: number;
  description: string;
  country?: string;
  qualityScore: number;
  estimatedCostUsd: number;
}

export interface MediaProvider {
  id: string;
  capabilities: ProviderCapabilities;
  health(): Promise<ProviderHealth>;
  estimateCost(request: ProviderRequest): number;
  search(request: ProviderRequest): Promise<ProviderCandidate[]>;
}

export interface SemanticReranker {
  score(requirement: AssetRequirement, candidate: ProviderCandidate): Promise<{ score:number; reason:string }>;
}

export class ProviderRouter {
  constructor(
    private readonly providers: MediaProvider[],
    private readonly reranker: SemanticReranker,
    private readonly maximumCostUsd = 2,
  ) {}

  async resolve(request: ProviderRequest): Promise<AssetDecision | null> {
    const health = await Promise.all(this.providers.map(async (provider) => ({ provider, health:await provider.health() })));
    const eligible = health
      .filter(({provider,health:item}) => item.available
        && provider.capabilities.media.includes(request.requirement.media === "graphic" || request.requirement.media === "document" ? "image" : request.requirement.media)
        && provider.capabilities.aspectRatios.includes(request.aspectRatio)
        && provider.estimateCost(request) <= this.maximumCostUsd)
      .sort((a,b) => b.health.quality-a.health.quality || a.health.latencyMs-b.health.latencyMs);
    const results: Array<{ provider:MediaProvider; candidate:ProviderCandidate; semantic:{score:number;reason:string} }> = [];
    for (const {provider} of eligible) {
      for (const candidate of await provider.search(request)) {
        if (request.excludedAssetIds.includes(candidate.id)) continue;
        if (candidate.width < request.requirement.minimumWidth || candidate.height < request.requirement.minimumHeight) continue;
        if (candidate.country && /united kingdom/i.test(request.requirement.location) && !/uk|united kingdom|england|scotland|wales/i.test(candidate.country)) continue;
        const semantic = await this.reranker.score(request.requirement,candidate);
        if (semantic.score >= .72) results.push({provider,candidate,semantic});
      }
    }
    const selected = results.sort((a,b) => (b.semantic.score+b.candidate.qualityScore)-(a.semantic.score+a.candidate.qualityScore))[0];
    if (!selected) return null;
    return {
      assetId:selected.candidate.id,sceneId:request.sceneId,uri:selected.candidate.uri,provider:selected.provider.id,
      mediaType:selected.candidate.mediaType,semanticScore:selected.semantic.score,qualityScore:selected.candidate.qualityScore,
      reason:selected.semantic.reason,license:selected.candidate.license,
      ...(selected.candidate.sourceUrl ? {sourceUrl:selected.candidate.sourceUrl} : {}),
    };
  }
}
