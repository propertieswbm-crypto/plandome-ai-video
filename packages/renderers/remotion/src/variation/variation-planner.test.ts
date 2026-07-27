import {describe,expect,it} from "vitest";
import {createCreativeProject} from "../../../../creative-project/src/engine";
import type {VariationProfile} from "../project-schema";
import {similarity,VariationPlanner,visualFingerprint} from "./variation-planner";
const project=createCreativeProject({id:"golden",jobId:"golden",projectId:"campaign",script:"Your extension needs the right checks. Poor foundations create risk. We inspect the structure. You receive a clear route. Book your Plandome review.",segments:["Your extension needs the right checks.","Poor foundations create risk.","We inspect the structure.","You receive a clear route.","Book your Plandome review."],durationSeconds:15,format:"portrait",quality:"production",seed:"golden"});
describe("VariationPlanner",()=>{
  it("is deterministic for the same seed",()=>expect(new VariationPlanner().plan(project,"a")).toEqual(new VariationPlanner().plan(project,"a")));
  it("produces distinct accepted profiles",()=>{
    const planner=new VariationPlanner(),profiles:VariationProfile[]=[];for(let index=0;index<5;index++)profiles.push(planner.plan(project,`variant-${index}`,profiles,.2));
    expect(new Set(profiles.map((profile)=>visualFingerprint(profile,[]))).size).toBe(5);
    expect(new Set(profiles.map((profile)=>profile.templateSequence.join("|"))).size).toBe(5);
    for(let a=0;a<profiles.length;a++)for(let b=a+1;b<profiles.length;b++)expect(similarity(profiles[a]!,profiles[b]!)).toBeLessThanOrEqual(.8);
  });
  it("avoids consecutive duplicate layouts",()=>{
    const profile=new VariationPlanner().plan(project,"layout");
    expect(profile.layoutSequence.every((layout,index)=>index===0||layout!==profile.layoutSequence[index-1])).toBe(true);
  });
});
