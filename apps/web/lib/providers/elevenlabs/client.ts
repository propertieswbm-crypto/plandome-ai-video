import { logger } from "@openvideo/observability";

const API_BASE = "https://api.elevenlabs.io";
const VOICE_CACHE_TTL_MS = 15 * 60 * 1_000;
const voiceNames = { ella: "Ella" } as const;
type VoiceKey = keyof typeof voiceNames;

type VoiceSearchResponse = {
  voices?: Array<{ voice_id?: string; name?: string }>;
};

type CachedVoice = { id: string; expiresAt: number };
const voiceCache = new Map<VoiceKey, CachedVoice>();

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "voice_not_found" | "rate_limited" | "provider_error",
    readonly status: number,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new ElevenLabsError("ElevenLabs is not configured.", "not_configured", 503);
  return key;
}

async function resolveVoiceId(voice: VoiceKey, signal: AbortSignal): Promise<string> {
  const configured = process.env.ELEVENLABS_ELLA_VOICE_ID;
  if (configured) return configured;

  const cached = voiceCache.get(voice);
  if (cached && cached.expiresAt > Date.now()) return cached.id;

  const expectedName = voiceNames[voice];
  const url = new URL("/v2/voices", API_BASE);
  url.searchParams.set("search", expectedName);
  url.searchParams.set("page_size", "20");
  url.searchParams.set("include_total_count", "false");

  const response = await fetch(url, { headers: { "xi-api-key": apiKey() }, signal, cache: "no-store" });
  if (!response.ok) throwProviderError(response.status, "voice lookup");
  const payload = (await response.json()) as VoiceSearchResponse;
  const match = payload.voices?.find((item) => item.name?.trim().toLocaleLowerCase() === expectedName.toLocaleLowerCase());
  if (!match?.voice_id) {
    throw new ElevenLabsError(`The ${expectedName} voice is not available in this ElevenLabs workspace.`, "voice_not_found", 422);
  }
  voiceCache.set(voice, { id: match.voice_id, expiresAt: Date.now() + VOICE_CACHE_TTL_MS });
  logger.info({ event: "elevenlabs.voice_resolved", voice }, "ElevenLabs voice resolved");
  return match.voice_id;
}

function throwProviderError(status: number, operation: string): never {
  if (status === 429) throw new ElevenLabsError("ElevenLabs is rate-limiting requests. Try again shortly.", "rate_limited", 429);
  throw new ElevenLabsError(`ElevenLabs ${operation} failed.`, "provider_error", 502);
}

export async function streamNarration(input: {
  text: string;
  voice: VoiceKey;
  quality: "preview" | "production";
  signal: AbortSignal;
}): Promise<{ body: ReadableStream<Uint8Array>; requestId: string | null; characterCost: string | null }> {
  const voiceId = await resolveVoiceId(input.voice, input.signal);
  const modelId = input.quality === "preview" ? "eleven_flash_v2_5" : "eleven_multilingual_v2";
  const url = new URL(`/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`, API_BASE);
  url.searchParams.set("output_format", "mp3_44100_128");
  url.searchParams.set("optimize_streaming_latency", "2");

  const response = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: input.text,
      model_id: modelId,
      voice_settings: { stability: 0.55, similarity_boost: 0.78, style: 0.25, use_speaker_boost: true, speed: 1 },
    }),
    signal: input.signal,
    cache: "no-store",
  });
  if (!response.ok || !response.body) throwProviderError(response.status, "speech generation");
  return {
    body: response.body,
    requestId: response.headers.get("request-id"),
    characterCost: response.headers.get("character-cost"),
  };
}
