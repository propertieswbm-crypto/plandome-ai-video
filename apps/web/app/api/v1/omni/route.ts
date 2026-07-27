import { createOmniSchema, type ProblemDetails } from "@openvideo/contracts";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

function problem(requestId: string, status: number, code: string, detail: string) {
    const body: ProblemDetails = {
        type: "about:blank",
        title: "Omni request failed",
        status,
        code,
        detail,
        requestId
    };

    return NextResponse.json(body, {
        status,
        headers: { "content-type": "application/problem+json" }
    });
}

export async function POST(request: NextRequest) {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return problem(requestId, 400, "invalid_json", "The request body must be valid JSON.");
    }

    const parsed = createOmniSchema.safeParse(payload);
    if (!parsed.success) {
        return problem(requestId, 422, "validation_failed", "The request body failed validation.");
    }

    return NextResponse.json(
        {
            success: true,
            requestId,
            payload: parsed.data,
            message: "Omni route enabled. Use POST /api/v1/omni with a valid payload."
        },
        { status: 200 }
    );
}
