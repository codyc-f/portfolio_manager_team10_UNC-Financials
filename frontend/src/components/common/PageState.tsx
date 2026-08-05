import { AlertCircle, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

interface PageStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  loading?: boolean;
  error?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export function PageState({ icon, title, description, loading, error, actionLabel, onAction }: PageStateProps) {
  return (
    <section className={`page-panel-state ${error ? "page-panel-state--error" : ""}`}>
      {loading ? <LoaderCircle className="spin" size={24} /> : icon ?? <AlertCircle size={24} />}
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction && <button className="secondary-button" onClick={onAction}>{actionLabel}</button>}
    </section>
  );
}
