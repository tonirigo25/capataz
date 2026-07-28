"use client";

import { useEffect, useState } from "react";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";

const STORAGE_KEY = "orqena-consent-v1";
const POLICY_VERSION = "1.0";

type ConsentChoice = "accepted" | "rejected" | null;

export function ConsentManager({ analyticsAvailable }: { analyticsAvailable: boolean }) {
  const [choice, setChoice] = useState<ConsentChoice>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!analyticsAvailable) {
      setReady(true);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { analytics?: boolean; policyVersion?: string } | null;
      if (stored?.policyVersion === POLICY_VERSION && typeof stored.analytics === "boolean") {
        setChoice(stored.analytics ? "accepted" : "rejected");
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, [analyticsAvailable]);

  if (!analyticsAvailable || !ready) return null;

  const save = (analytics: boolean) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics, policyVersion: POLICY_VERSION }));
    setChoice(analytics ? "accepted" : "rejected");
    setEditing(false);
  };

  return (
    <>
      {choice === "accepted" ? <WebVitalsReporter /> : null}
      {choice === null || editing ? (
        <section
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-5 text-slate-900 shadow-2xl"
          aria-labelledby="consent-title"
          aria-live="polite"
          data-consent-policy={POLICY_VERSION}
        >
          <h2 id="consent-title" className="text-base font-black">Analítica opcional</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Las funciones esenciales siempre están activas. La analítica propia y agregada solo se inicia si la aceptas; no usamos publicidad ni marketing.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="primary-button" type="button" onClick={() => save(true)}>Aceptar analítica</button>
            <button className="secondary-button" type="button" onClick={() => save(false)}>Solo esenciales</button>
          </div>
        </section>
      ) : (
        <button
          className="fixed bottom-3 left-3 z-[90] rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-lg"
          type="button"
          onClick={() => setEditing(true)}
        >
          Privacidad
        </button>
      )}
    </>
  );
}
