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
  script: z.string().trim().min(20).max(30_000),
  workflow: z.enum(["short-form", "long-form"]).default("short-form"),
  targetDurationSeconds: z.number().int().min(60).max(1_200).optional(),
  canvaBridgeMode: z.enum(["standard", "longform-native"]).default("standard"),
  format: z.enum(["portrait", "landscape", "hz", "sqr"]).default("portrait"),
  quality: z.enum(["preview", "production"]).default("preview"),
  useAvatar: z.boolean().default(true),
  sceneMediaUrls: z.array(
    z.union([z.url({ protocol: /^https?$/ }), z.literal("")])
  ).max(30).default([]),
  driveFolderUrl: z.union([
    z.url({ protocol: /^https$/ }).refine((value) => {
      try {
        const url = new URL(value);
        return /(^|\.)drive\.google\.com$/i.test(url.hostname) && (/\/folders\/[a-zA-Z0-9_-]+/.test(url.pathname) || Boolean(url.searchParams.get("id")));
      } catch {
        return false;
      }
    }, "Use a Google Drive folder link, not an individual file link."),
    z.literal(""),
  ]).default(""),
  slideDeckUrl: z.union([
    z.url({ protocol: /^https$/ }).refine((value) => /(?:docs\.google\.com\/presentation\/d\/|drive\.google\.com\/(?:file\/d\/|open\?id=))/i.test(value), "Use a shared Google Slides, PowerPoint, or PDF Drive file link."),
    z.literal(""),
  ]).default(""),
  renderer: z.enum(["hyperframes","remotion"]).default("hyperframes"),
  campaignId: z.string().trim().min(1).max(120).optional(),
  campaignFamily: z.string().trim().min(1).max(120).optional(),
  service: z.string().trim().min(1).max(160).optional(),
  variationSeed: z.string().trim().min(1).max(160).optional(),
  visualFamily: z.enum(["editorial-property","technical-blueprint","planning-document","premium-corporate","case-study","construction-risk","financial-analysis"]).optional(),
  designSystemId: z.enum([
    "plandome-fa381-editorial-v1",
  ]).optional(),
  excludedTemplates: z.array(z.string().trim().min(1)).max(20).default([]),
  allowedTemplates: z.array(z.string().trim().min(1)).max(20).default([]),
  minimumVariationDistance: z.number().min(0).max(1).default(.35),
  allowRendererFallback: z.boolean().default(true),
});
export type CreateVideoJobInput = z.infer<typeof createVideoJobSchema>;

export const createVideoBatchSchema=createVideoJobSchema.extend({
  scriptId:z.string().trim().min(1).max(120),
  numberOfVariants:z.number().int().min(1).max(20).default(1),
  baseSeed:z.string().trim().min(1).max(160),
  outputFilenamePattern:z.string().trim().min(1).max(180).default("{scriptId}-{variant}.mp4"),
});
export type CreateVideoBatchInput=z.infer<typeof createVideoBatchSchema>;

export const createOmniSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
  channel: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type CreateOmniInput = z.infer<typeof createOmniSchema>;

export const videoJobStatusSchema = z.enum(["queued", "planning", "narrating", "avatar", "composing", "rendering", "completed", "failed", "cancelled"]);
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
