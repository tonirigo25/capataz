"use client";

const CONSENT_KEY = "orqena-consent-v1";
const POLICY_VERSION = "1.0";

export type PublicFunnelEvent =
  | "funnel.hero_cta"
  | "funnel.quick_demo_started"
  | "funnel.quick_demo_completed"
  | "funnel.contact_form_started"
  | "funnel.contact_form_error"
  | "funnel.contact_form_success"
  | "funnel.booked_demo"
  | "funnel.resource_used"
  | "funnel.resource_cta";

export function hasAnalyticsConsent() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null") as { analytics?: boolean; policyVersion?: string } | null;
    return stored?.policyVersion === POLICY_VERSION && stored.analytics === true;
  } catch {
    return false;
  }
}

export function trackPublicFunnel(
  eventName: PublicFunnelEvent,
  properties: Record<string, string | number | boolean>,
  explicitConsent = false,
) {
  if (!explicitConsent && !hasAnalyticsConsent()) return;
  const eventId = `public:${crypto.randomUUID()}`;
  const payload = JSON.stringify({ eventId, eventName, properties, consent: true });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/metrics/funnel", new Blob([payload], { type: "application/json" }));
    return;
  }
  void fetch("/api/metrics/funnel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    credentials: "same-origin",
    keepalive: true,
  });
}
