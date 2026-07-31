"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { trackPublicFunnel } from "@/lib/product/public-analytics";
import styles from "./public-home.module.css";

export function HeroActionLink({ children, href, kind, target }: { children: ReactNode; href: string; kind: "primary" | "secondary"; target: "access_request" | "how_it_works" }) {
  return (
    <Link className={kind === "primary" ? styles.primaryAction : styles.secondaryAction} href={href} onClick={() => trackPublicFunnel("funnel.hero_cta", { target })}>
      {children}{kind === "primary" ? <ArrowRight aria-hidden="true" /> : null}
    </Link>
  );
}
