export * from "../../creative-project/src/provider-router";

export interface ProviderObservation {
  providerId: string; operation: string; success: boolean; latencyMs: number;
  costUsd: number; observedAt: string; errorCode?: string;
}
export interface ProviderLimits { concurrency: number; requestsPerMinute: number; maximumCostUsd: number; }

export class ProviderControlPlane {
  private readonly observations: ProviderObservation[] = [];
  private readonly inFlight = new Map<string, number>();
  constructor(private readonly limits: Record<string, ProviderLimits>) {}
  canStart(providerId: string) {
    const limit = this.limits[providerId];
    if (!limit) return false;
    return (this.inFlight.get(providerId) ?? 0) < limit.concurrency;
  }
  start(providerId: string) {
    if (!this.canStart(providerId)) throw new Error(`Provider ${providerId} has reached its concurrency limit.`);
    this.inFlight.set(providerId, (this.inFlight.get(providerId) ?? 0) + 1);
  }
  finish(observation: ProviderObservation) {
    this.inFlight.set(observation.providerId, Math.max(0, (this.inFlight.get(observation.providerId) ?? 1) - 1));
    this.observations.push(observation);
    if (this.observations.length > 1_000) this.observations.shift();
  }
  health(providerId: string) {
    const recent = this.observations.filter((item) => item.providerId === providerId).slice(-50);
    if (!recent.length) return { successRate:1, averageLatencyMs:0, samples:0 };
    return {
      successRate:recent.filter((item) => item.success).length / recent.length,
      averageLatencyMs:recent.reduce((sum,item) => sum+item.latencyMs,0) / recent.length,
      samples:recent.length,
    };
  }
}
