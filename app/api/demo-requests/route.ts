import { NextResponse } from "next/server";
import { requestProductDemo } from "@/lib/commercial/demo-service";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json") ? await request.json() as Record<string, unknown> : Object.fromEntries((await request.formData()).entries());
  try {
    const created = await requestProductDemo({
      email: clean(input.email, 320) ?? "",
      displayName: clean(input.displayName ?? input.name, 100) ?? "",
      companyName: clean(input.companyName ?? input.company, 140) ?? "",
      phone: clean(input.phone, 40),
      teamSize: clean(input.teamSize ?? input.companySize, 40),
      sectorKey: clean(input.sectorKey ?? input.sector, 60),
      message: clean(input.message ?? input.need, 1500),
      consent: input.consent === true || input.consent === "true" || input.consent === "on",
      sourceAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    });
    return NextResponse.json({ ok: true, requestId: created.id }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_DEMO_REQUEST";
    return NextResponse.json({ ok: false, error: code === "DEMO_RATE_LIMITED" ? "RATE_LIMITED" : "INVALID_REQUEST" }, { status: code === "DEMO_RATE_LIMITED" ? 429 : 400 });
  }
}

function clean(value: unknown, max: number) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}
