import { publicRequestContext } from "@/lib/platform/request-boundary";
import { NextResponse } from "next/server";
import { requestProductDemo } from "@/lib/commercial/demo-service";

export async function POST(request: Request) {
  return publicRequestContext("POST /api/demo-requests", request, async () => {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 16_384) {
    return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("form")) {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }
  const input = contentType.includes("application/json")
    ? await request.json() as Record<string, unknown>
    : Object.fromEntries((await request.formData()).entries());
  if (clean(input.website, 200) || looksAutomated(clean(input.message ?? input.need, 1500))) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }
  try {
    await requestProductDemo({
      email: clean(input.email, 320) ?? "",
      displayName: clean(input.displayName ?? input.name, 100) ?? "",
      companyName: clean(input.companyName ?? input.company, 140) ?? "",
      phone: clean(input.phone, 40),
      teamSize: clean(input.teamSize ?? input.companySize, 40),
      sectorKey: clean(input.sectorKey ?? input.sector, 60),
      message: clean(input.message ?? input.need, 1500),
      consent: input.consent === true || input.consent === "true" || input.consent === "on",
      sourceAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      source: clean(input.source ?? input.kind, 40),
      tracking: {
        utmSource: clean(input.utmSource, 100),
        utmMedium: clean(input.utmMedium, 100),
        utmCampaign: clean(input.utmCampaign, 160),
        utmTerm: clean(input.utmTerm, 160),
        utmContent: clean(input.utmContent, 160),
        landingPath: clean(input.landingPath, 240),
        referrerHost: clean(input.referrerHost, 200),
        consentVersion: clean(input.consentVersion, 40),
      },
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_DEMO_REQUEST";
    return NextResponse.json({ ok: false, error: code === "DEMO_RATE_LIMITED" ? "RATE_LIMITED" : "INVALID_REQUEST" }, { status: code === "DEMO_RATE_LIMITED" ? 429 : 400 });
  }

  });
}

function clean(value: unknown, max: number) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function looksAutomated(message: string | undefined) {
  if (!message) return false;
  const links = message.match(/https?:\/\//giu)?.length ?? 0;
  return links > 3 || /(.)\1{30,}/u.test(message);
}
