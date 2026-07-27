import { describe, expect, it } from "vitest";
import { ProviderRouter, type MediaProvider } from "./provider-router";

describe("ProviderRouter", () => {
  it("rejects geographically wrong candidates and explains the selected match", async () => {
    const provider:MediaProvider = {
      id:"fixture",capabilities:{media:["video"],aspectRatios:["9:16"],licensing:"fixture",supportsReferences:false},
      health:async()=>({available:true,latencyMs:10,quality:.9,checkedAt:new Date().toISOString()}),
      estimateCost:()=>0,
      search:async()=>[
        {id:"us",uri:"us.mp4",mediaType:"video",license:"fixture",width:1080,height:1920,description:"American house",country:"United States",qualityScore:.95,estimatedCostUsd:0},
        {id:"uk",uri:"uk.mp4",mediaType:"video",license:"fixture",width:1080,height:1920,description:"Victorian UK loft",country:"United Kingdom",qualityScore:.9,estimatedCostUsd:0},
      ],
    };
    const router = new ProviderRouter([provider],{score:async(_requirement,candidate)=>({score:candidate.id==="uk"?.96:.9,reason:`${candidate.description} matches the requested UK architecture.`})});
    const decision = await router.resolve({sceneId:"scene-01",aspectRatio:"9:16",prompt:"UK loft",excludedAssetIds:[],requirement:{media:"video",subject:"loft",location:"United Kingdom",architecture:"Victorian",mustInclude:["loft"],mustExclude:["wrong country"],minimumWidth:1080,minimumHeight:1920}});
    expect(decision?.assetId).toBe("uk");
    expect(decision?.reason).toContain("matches");
  });
});
