import { createNarrationSchema, type ProblemDetails } from "@openvideo/contracts";
import { logger, toErrorContext } from "@openvideo/observability";
import { NextResponse, type NextRequest } from "next/server";
import { ElevenLabsError, streamNarration } from "@/lib/providers/elevenlabs/client";

export const runtime = "nodejs";
export const maxDuration = 60;

function problem(requestId: string, status: number, code: string, detail: string) {
  const body: ProblemDetails = { type: "about:blank", title: "Narration generation failed", status, code, detail, requestId };
  return NextResponse.json(body, { status, headers: { "content-type": "application/problem+json" } });
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let json: unknown;
  try { json = await request.json(); } catch { return problem(requestId, 400, "invalid_json", "The request body must be valid JSON."); }
  const parsed = createNarrationSchema.safeParse(json);
  if (!parsed.success) return problem(requestId, 422, "validation_failed", "Provide between 1 and 5,000 characters for Ella.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const result = await streamNarration({ ...parsed.data, signal: controller.signal });
    logger.info({ event: "narration.generated", requestId, workspace: "company", voice: parsed.data.voice, quality: parsed.data.quality, characterCost: result.characterCost }, "Narration stream started");
    return new Response(result.body, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "content-disposition": `inline; filename="${parsed.data.voice}-narration.mp3"`,
        "cache-control": "no-store",
        "x-request-id": requestId,
        ...(result.requestId ? { "x-elevenlabs-request-id": result.requestId } : {}),
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsError) return problem(requestId, error.status, error.code, error.message);
    logger.error({ event: "narration.failed", requestId, ...toErrorContext(error) }, "Narration generation failed");
    return problem(requestId, 502, "provider_error", "Narration generation is temporarily unavailable.");
  } finally { clearTimeout(timeout); }
}
