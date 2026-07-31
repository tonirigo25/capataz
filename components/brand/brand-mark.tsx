import Image from "next/image";
import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { brand } from "@/lib/brand";

const OFFICIAL_SYMBOL = "/brand/orqena/orqena-simbolo-oficial.png";

export function BrandLogo({
  className,
  title,
  style
}: {
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src={OFFICIAL_SYMBOL}
      alt={title ?? ""}
      width={64}
      height={64}
      sizes="64px"
      className={clsx("brand-mark", className)}
      style={style}
      priority
    />
  );
}

export const BrandMark = BrandLogo;

export function BrandLockup({
  compact = false,
  inverse = false,
  className
}: {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={clsx("brand-lockup", inverse && "brand-lockup--inverse", className)}>
      <span className="brand-lockup__tile"><BrandMark /></span>
      <span className="min-w-0">
        <strong className="brand-lockup__name">{brand.companyName}</strong>
        {!compact ? <span className="brand-lockup__tagline">{brand.tagline}</span> : null}
      </span>
    </span>
  );
}

export function BrandCandidate({
  className,
  style
}: {
  candidate: "relay" | "weave" | "bridge";
  className?: string;
  style?: CSSProperties;
}) {
  return <BrandMark className={className} style={style} />;
}
