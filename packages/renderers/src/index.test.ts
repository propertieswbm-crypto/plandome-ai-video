import { describe,expect,it } from "vitest";
import { rendererRegistry } from "./index";
describe("RendererRegistry",()=>{
  it("keeps Hyperframes active while Remotion stays neutral and unavailable",()=>{
    expect(rendererRegistry.production()?.id).toBe("hyperframes");
    expect(rendererRegistry.get("remotion")).toMatchObject({available:false,projectNeutral:true});
  });
});
