import Image from "next/image";
import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { brand } from "@/lib/brand";

const OFFICIAL_SYMBOL = "/brand/orqena/orqena-simbolo-oficial-v2.png";
const OFFICIAL_DARK_LOCKUP = "/brand/orqena/orqena-logo-oficial-sobre-oscuro.png";

type BrandLogoVariant = "sidebar" | "light" | "symbol";
type BrandLogoSize = "sm" | "md" | "lg";

export function BrandLogo({
  className,
  variant = "symbol",
  size = "md",
  title,
  style
}: {
  className?: string;
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  title?: string;
  style?: CSSProperties;
}) {
  if (variant === "sidebar") {
    return (
      <span
        className={clsx("brand-logo brand-logo--sidebar", `brand-logo--${size}`, className)}
        style={style}
        role={title ? "img" : undefined}
        aria-label={title}
      >
        <Image
          src={OFFICIAL_DARK_LOCKUP}
          alt=""
          width={220}
          height={78}
          sizes="220px"
          className="brand-logo__sidebar-image"
          unoptimized
          priority
        />
      </span>
    );
  }

  const symbol = (
    <Image
      src={OFFICIAL_SYMBOL}
      alt=""
      width={60}
      height={60}
      sizes="60px"
      className="brand-logo__symbol"
      unoptimized
      priority
    />
  );

  if (variant === "light") {
    return (
      <span
        className={clsx("brand-logo brand-logo--light", `brand-logo--${size}`, className)}
        style={style}
        role={title ? "img" : undefined}
        aria-label={title}
      >
        {symbol}
        <strong className="brand-logo__wordmark" aria-hidden="true">{brand.companyName}</strong>
      </span>
    );
  }

  return (
    <span
      className={clsx("brand-logo brand-logo--symbol brand-mark", `brand-logo--${size}`, className)}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {symbol}
    </span>
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
  if (inverse) {
    return <BrandLogo variant="sidebar" size="lg" title={brand.companyName} className={clsx("brand-lockup brand-lockup--inverse", className)} />;
  }

  return (
    <span className={clsx("brand-lockup", className)}>
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
