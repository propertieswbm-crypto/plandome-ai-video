import { describe,expect,it } from "vitest";
import { createCreativeProject } from "../../creative-project/src/engine";
import { PreRenderQualityGate } from "./index";

describe("PreRenderQualityGate",()=>{
  it("rejects projects without a mandatory logo",()=>{
    const project=createCreativeProject({id:"p",jobId:"j",projectId:"account",script:"A Victorian loft deserves expert planning. Book today.",segments:["A Victorian loft deserves expert planning.","Book today."],durationSeconds:10,format:"portrait",quality:"production",seed:"1"});
    project.brand.logoUri="";
    expect(new PreRenderQualityGate().evaluate(project).decision).toBe("reject");
  });
  it("scores all eight measurable dimensions",()=>{
    const project=createCreativeProject({id:"p",jobId:"j",projectId:"account",script:"A Victorian loft deserves expert planning. Book today.",segments:["A Victorian loft deserves expert planning.","Book today."],durationSeconds:10,format:"portrait",quality:"production",seed:"1"});
    const result=new PreRenderQualityGate().evaluate(project);
    expect(Object.keys(result.scenes[0]!.scores)).toHaveLength(8);
  });
});
