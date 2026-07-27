import {describe,expect,it} from "vitest";
import {validateRenderInput} from "./project-schema";
describe("Remotion input validation",()=>it("rejects malformed renderer props",()=>{
  expect(()=>validateRenderInput({} as never)).toThrow();
}));
