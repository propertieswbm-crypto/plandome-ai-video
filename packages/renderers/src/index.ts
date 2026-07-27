export type RendererId = "hyperframes" | "remotion";
export interface RendererDescriptor {
  id: RendererId;
  production: boolean;
  available: boolean;
  projectNeutral: boolean;
  reason?: string;
}
export interface RendererArtifact {
  path:string; mimeType:string; codec:string; width:number; height:number; fps:number;
  durationSeconds:number; sizeBytes:number; contentHash:string;
}
export interface RendererAdapter<TInput=unknown> {
  readonly descriptor:RendererDescriptor;
  validate(input:TInput):void;
  render(input:TInput,options?:{onProgress?:(progress:number)=>void;signal?:AbortSignal}):Promise<RendererArtifact>;
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
  select(requested:RendererId,allowFallback=true) {
    const renderer=this.get(requested);
    if(renderer?.available)return renderer;
    if(allowFallback){const fallback=this.get("hyperframes");if(fallback?.available)return fallback;}
    throw new Error(renderer?.reason??`Renderer ${requested} is unavailable and fallback is disabled.`);
  }
}
export const rendererRegistry = new RendererRegistry()
  .register({ id:"hyperframes", production:true, available:true, projectNeutral:true })
  .register({
    id:"remotion",production:process.env.REMOTION_VALIDATED==="true",
    available:process.env.REMOTION_VALIDATED==="true",projectNeutral:true,
    ...(process.env.REMOTION_VALIDATED==="true"?{}:{reason:"Remotion is unavailable because the official runtime has not passed MP4 validation. Set REMOTION_VALIDATED=true only after the validation suite passes."}),
  });
