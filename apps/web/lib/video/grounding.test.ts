import { describe,expect,it } from "vitest";
import { createVisualBrief, validateVideoPlan } from "../../../../scripts/video-quality";

describe("UK property grounding",()=>{
 it("grounds a Victorian rear extension in required UK concepts",()=>{const brief=createVisualBrief("Before drawings, check the planning route for a Victorian rear extension.",0);expect(brief.country).toBe("United Kingdom");expect(brief.requiredVisualTerms.join(" ")).toMatch(/Victorian/i);expect(brief.requiredVisualTerms.join(" ")).toMatch(/rear extension/i);expect(brief.searchQuery).toMatch(/United Kingdom/i);});
 it("forbids common irrelevant architecture and footage",()=>{const brief=createVisualBrief("Plan a Victorian rear extension.",0);expect(brief.forbiddenVisualTerms.join(" ")).toMatch(/American suburb/i);expect(brief.forbiddenVisualTerms.join(" ")).toMatch(/skyscraper/i);expect(brief.forbiddenVisualTerms.join(" ")).toMatch(/restaurant/i);});
 it("accepts a line-matched HyperFrames UK motion visual when stock is throttled",()=>{const text="Plan a Victorian rear extension";const report=validateVideoPlan([{text,headline:text,start:0,duration:3.2,kind:"property",brief:createVisualBrief(text,0),motionVisual:"victorian-rear-extension",visualFailure:"Stock provider HTTP 429"}]);expect(report.passed).toBe(true);expect(report.scenes[0]?.visualMatchScore).toBeGreaterThanOrEqual(.9);expect(report.scenes[0]?.qualityScore).toBeGreaterThanOrEqual(.9);});
});
