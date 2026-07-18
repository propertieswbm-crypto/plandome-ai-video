import { describe,expect,it } from "vitest";
import { createVisualBrief } from "../../../../scripts/video-quality";

describe("UK property grounding",()=>{
 it("grounds a Victorian rear extension in required UK concepts",()=>{const brief=createVisualBrief("Before drawings, check the planning route for a Victorian rear extension.",0);expect(brief.country).toBe("United Kingdom");expect(brief.requiredVisualTerms.join(" ")).toMatch(/Victorian/i);expect(brief.requiredVisualTerms.join(" ")).toMatch(/rear extension/i);expect(brief.searchQuery).toMatch(/United Kingdom/i);});
 it("forbids common irrelevant architecture and footage",()=>{const brief=createVisualBrief("Plan a Victorian rear extension.",0);expect(brief.forbiddenVisualTerms.join(" ")).toMatch(/American suburb/i);expect(brief.forbiddenVisualTerms.join(" ")).toMatch(/skyscraper/i);expect(brief.forbiddenVisualTerms.join(" ")).toMatch(/restaurant/i);});
});
