import type { ReactNode } from "react";

export function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={className}><span>{label}</span>{children}</label>;
}
