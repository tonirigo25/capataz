"use client";

import { useRouter } from "next/navigation";
import { HardHat } from "lucide-react";

export function DemoEntry() {
  const router = useRouter();

  function enterDemo() {
    localStorage.setItem("capataz-demo", "true");
    router.push("/hoy");
  }

  return (
    <button type="button" onClick={enterDemo} className="primary-button w-full">
      <HardHat size={18} />
      Entrar en demo
    </button>
  );
}
