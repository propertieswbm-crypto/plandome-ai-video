export type RendererId = "hyperframes" | "remotion";
export interface RendererDescriptor {
  id: RendererId;
  production: boolean;
  available: boolean;
  projectNeutral: boolean;
  reason?: string;
}
export class RendererRegistry {
  private readonly renderers = new Map<RendererId, RendererDescriptor>();
  register(renderer: RendererDescriptor) { this.renderers.set(renderer.id, renderer); return this; }
  get(id: RendererId) { return this.renderers.get(id); }
  requireAvailable(id: RendererId) {
    const renderer = this.get(id);
    if (!renderer?.available) throw new Error(renderer?.reason ?? `Renderer ${id} is unavailable.`);
    return renderer;
  }
  production() { return [...this.renderers.values()].find((item) => item.production && item.available); }
}
export const rendererRegistry = new RendererRegistry()
  .register({ id:"hyperframes", production:true, available:true, projectNeutral:true })
  .register({ id:"remotion", production:false, available:false, projectNeutral:true, reason:"External Remotion template library is not installed." });
