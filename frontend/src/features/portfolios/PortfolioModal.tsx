import { X } from "lucide-react";
import type { FormEvent } from "react";
import type { PortfolioDraft } from "../../types";
import { PortfolioForm } from "./PortfolioForm";

interface PortfolioModalProps {
  draft: PortfolioDraft;
  setDraft: (draft: PortfolioDraft) => void;
  onSubmit: (event: FormEvent) => void;
  submitting: boolean;
  error: string;
  editing: boolean;
  close: () => void;
}

export function PortfolioModal({ draft, setDraft, onSubmit, submitting, error, editing, close }: PortfolioModalProps) {
  return (
    <div className="modal-backdrop">
      <section className="modal modal--compact" role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <span className="modal-kicker">{editing ? "EDIT PORTFOLIO" : "NEW PORTFOLIO"}</span>
            <h2>{editing ? "Portfolio details" : "Create a portfolio"}</h2>
            <p>Choose a clear name and three-letter base currency.</p>
          </div>
          <button onClick={close} aria-label="Close"><X size={20} /></button>
        </header>
        <PortfolioForm draft={draft} setDraft={setDraft} onSubmit={onSubmit} submitting={submitting} error={error} submitLabel={editing ? "Save changes" : "Create portfolio"} cancel={close} />
      </section>
    </div>
  );
}
