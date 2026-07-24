import { clsx } from "clsx";
import type { CSSProperties, SVGProps } from "react";
import { brand } from "@/lib/brand";

export function BrandMark({
  className,
  title,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={clsx("brand-mark", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path className="brand-mark__route" d="M12 44 26 30l11 11 16-17" />
      <rect x="6" y="38" width="12" height="12" rx="4" />
      <rect x="20" y="24" width="12" height="12" rx="4" />
      <rect x="31" y="35" width="12" height="12" rx="4" />
      <rect x="47" y="18" width="12" height="12" rx="4" />
    </svg>
  );
}

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
        <strong className="brand-lockup__name">{brand.productName}</strong>
        {!compact ? <span className="brand-lockup__tagline">{brand.tagline}</span> : null}
      </span>
    </span>
  );
}

export function BrandCandidate({
  candidate,
  className,
  style
}: {
  candidate: "relay" | "weave" | "bridge";
  className?: string;
  style?: CSSProperties;
}) {
  if (candidate === "relay") return <BrandMark className={className} style={style} />;
  if (candidate === "weave") {
    return (
      <svg className={className} style={style} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M13 18v28M32 10v44M51 18v28" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        <path d="m13 25 19 14 19-14" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="7" y="9" width="20" height="20" rx="6" fill="currentColor" />
      <rect x="37" y="9" width="20" height="20" rx="6" fill="currentColor" />
      <rect x="22" y="35" width="20" height="20" rx="6" fill="currentColor" />
      <path d="M27 19h10M17 29l10 10M47 29 37 39" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
