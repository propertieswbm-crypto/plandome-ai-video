import { describe,expect,it } from "vitest";
import { rendererRegistry } from "./index";
describe("RendererRegistry",()=>{
  it("keeps Hyperframes active while Remotion stays neutral and unavailable",()=>{
    expect(rendererRegistry.production()?.id).toBe("hyperframes");
    expect(rendererRegistry.get("remotion")).toMatchObject({available:false,projectNeutral:true});
  });
  it("falls back safely while Remotion validation is incomplete",()=>{
    expect(rendererRegistry.select("remotion",true).id).toBe("hyperframes");
    expect(()=>rendererRegistry.select("remotion",false)).toThrow(/unavailable/i);
  });
});
