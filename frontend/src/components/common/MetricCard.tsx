import type { ReactNode } from "react";

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  className?: string;
}

export function MetricCard({ icon, label, value, note, className }: MetricCardProps) {
  return (
    <article className={`metric-card ${className ?? ""}`}>
      <div className="metric-icon">{icon}</div>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}
