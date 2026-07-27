import {describe,expect,it} from "vitest";
import {remotionTemplates} from "./registry";
describe("Remotion templates",()=>it("maps the production templates to real components",()=>{
  expect(remotionTemplates.length).toBeGreaterThanOrEqual(10);
  expect(remotionTemplates.every((template)=>typeof template.component==="function")).toBe(true);
}));
