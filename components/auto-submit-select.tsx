"use client";

import type { ReactNode } from "react";

export function AutoSubmitSelect({
  name,
  defaultValue,
  label,
  children,
}: {
  name: string;
  defaultValue: string;
  label: string;
  children: ReactNode;
}) {
  return <select
    name={name}
    defaultValue={defaultValue}
    aria-label={label}
    onChange={(event) => event.currentTarget.form?.requestSubmit()}
  >{children}</select>;
}
