import type { CreateVideoJobInput, VideoJobStatus } from "@openvideo/contracts";

export type VideoJob = {
  id: string;
  input: CreateVideoJobInput;
  status: VideoJobStatus;
  progress: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  outputUrl?: string;
  canvaUrl?: string;
  generationId: string;
  variationSeed: string;
  projectId: string;
  creativeFingerprint?: string;
  inspectorUrl?: string;
  canvaDesignId?: string;
  canvaEditUrl?: string;
  error?: { code: string; message: string };
};
