import { describe, expect, it } from "vitest";
import { createNarrationSchema, signUpSchema, workspaceRoleSchema } from "./index";

describe("identity contracts", () => {
  it("normalizes a valid sign-up email", () => {
    const result = signUpSchema.parse({
      email: "  OWNER@EXAMPLE.COM ",
      password: "correct-horse-battery-staple",
      fullName: "Ada Lovelace",
      workspaceName: "Analytical Films",
    });
    expect(result.email).toBe("owner@example.com");
  });

  it("rejects unsupported workspace roles", () => {
    expect(workspaceRoleSchema.safeParse("superuser").success).toBe(false);
  });

  it("validates narration commands and defaults to preview quality", () => {
    const result = createNarrationSchema.parse({ text: "Welcome to Plandome.", voice: "ella" });
    expect(result.quality).toBe("preview");
    expect(result.voice).toBe("ella");
  });
});
