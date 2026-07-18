import { z } from "zod";

export const workspaceRoleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(128),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2).max(100),
  workspaceName: z.string().trim().min(2).max(80),
});

export const magicLinkSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export const narrationVoiceSchema = z.literal("ella");
export const narrationQualitySchema = z.enum(["preview", "production"]);
export const createNarrationSchema = z.object({
  text: z.string().trim().min(1).max(5_000),
  voice: narrationVoiceSchema.default("ella"),
  quality: narrationQualitySchema.default("preview"),
});
export type CreateNarrationInput = z.infer<typeof createNarrationSchema>;

export const createVideoJobSchema = z.object({
  script: z.string().trim().min(20).max(3_000),
  format: z.enum(["portrait", "landscape"]).default("portrait"),
  quality: z.enum(["preview", "production"]).default("preview"),
  useAvatar: z.boolean().default(true),
});
export type CreateVideoJobInput = z.infer<typeof createVideoJobSchema>;

export const videoJobStatusSchema = z.enum(["queued", "planning", "narrating", "avatar", "composing", "rendering", "completed", "failed"]);
export type VideoJobStatus = z.infer<typeof videoJobStatusSchema>;

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  requestId: string;
  errors?: Record<string, string[]>;
};
