import { LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";
import { FormError } from "../../components/common/FormError";
import type { PortfolioDraft } from "../../types";

interface PortfolioFormProps {
  draft: PortfolioDraft;
  setDraft: (draft: PortfolioDraft) => void;
  onSubmit: (event: FormEvent) => void;
  submitting: boolean;
  error: string;
  submitLabel: string;
  cancel?: () => void;
}

export function PortfolioForm({ draft, setDraft, onSubmit, submitting, error, submitLabel, cancel }: PortfolioFormProps) {
  return (
    <form className="portfolio-form" onSubmit={onSubmit}>
      {error && <FormError message={error} />}
      <label><span>Portfolio name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Growth Portfolio" maxLength={255} required autoFocus /></label>
      <label><span>Base currency</span><input value={draft.baseCurrency} onChange={(event) => setDraft({ ...draft, baseCurrency: event.target.value.toUpperCase() })} maxLength={3} pattern="[A-Za-z]{3}" required /></label>
      <label><span>Cash balance</span><input type="number" value={draft.balance || ""} onChange={(event) => setDraft({ ...draft, balance: Number(event.target.value) })} min="0" step="0.01" placeholder="0.00" required /></label>
      <footer className="modal-footer">{cancel && <button className="secondary-button" type="button" onClick={cancel}>Cancel</button>}<button className="primary-button" disabled={submitting}>{submitting && <LoaderCircle className="spin" size={15} />}{submitLabel}</button></footer>
    </form>
  );
}
