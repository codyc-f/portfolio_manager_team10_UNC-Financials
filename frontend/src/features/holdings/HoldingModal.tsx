import { AlertCircle, Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../../api";
import { FormError } from "../../components/common/FormError";
import { Field } from "../../components/forms/Field";
import { assetTypes } from "../../constants/portfolio";
import type { AssetType, HoldingDraft, Position, StockOption, TradeType } from "../../types";
import { formatCurrency, roundPrice } from "../../utils/formatters";

interface HoldingModalProps {
  draft: HoldingDraft;
  setDraft: (draft: HoldingDraft) => void;
  positions: Position[];
  stockOptions: StockOption[];
  stockOptionsError: string;
  availableCash: number;
  editing: boolean;
  submitting: boolean;
  error: string;
  close: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function HoldingModal({ draft, setDraft, positions, stockOptions, stockOptionsError, availableCash, editing, submitting, error, close, onSubmit }: HoldingModalProps) {
  const [tickerQuery, setTickerQuery] = useState(draft.ticker);
  const [tickerDropdownOpen, setTickerDropdownOpen] = useState(false);
  const [tickerLookupError, setTickerLookupError] = useState("");
  const filteredStockOptions = useMemo(() => {
    const query = tickerQuery.trim().toLowerCase();
    if (!query) return stockOptions;
    return stockOptions.filter((stock) => stock.ticker.toLowerCase().includes(query) || stock.name.toLowerCase().includes(query));
  }, [stockOptions, tickerQuery]);

  async function selectTicker(ticker: string) {
    try {
      const stock = await api.getStockDetails(ticker, draft.currency);
      setTickerQuery(stock.ticker);
      setDraft({ ...draft, ticker: stock.ticker, assetName: stock.name, assetType: "Stock", pricePerUnit: roundPrice(stock.currentPrice), currency: draft.currency });
      setTickerLookupError("");
      setTickerDropdownOpen(false);
    } catch (error) {
      console.error("Unable to find ticker:", error);
      setTickerLookupError(`No stock information was found for ${ticker}.`);
      setTickerDropdownOpen(false);
    }
  }

  async function searchTicker() {
    const ticker = tickerQuery.trim().toUpperCase();
    if (!ticker) return;
    await selectTicker(ticker);
  }

  const activePosition = positions.find((position) => position.ticker === draft.ticker && position.currency === draft.currency);
  const sellQuantityMax = draft.tradeType === "SELL" ? activePosition?.quantityOwned : undefined;
  const modalTitle = editing ? "Edit holding" : draft.tradeType === "SELL" ? "Sell holding" : "Add a holding";
  const submitLabel = editing ? "Save changes" : draft.tradeType === "SELL" ? "Record sale" : "Add holding";
  const estimatedValue = draft.tradeType === "SELL" ? Math.max(draft.quantity * draft.pricePerUnit - draft.feeAmount, 0) : draft.quantity * draft.pricePerUnit + draft.feeAmount;
  const headerValue = draft.tradeType === "SELL" ? (activePosition?.quantityOwned ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 }) : formatCurrency(availableCash, draft.currency);

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="holding-title">
        <header className="modal-header"><div className="modal-header__copy"><span className="modal-kicker">{editing ? "UPDATE TRANSACTION" : draft.tradeType === "SELL" ? "SELL POSITION" : "NEW TRANSACTION"}</span><h2 id="holding-title">{modalTitle}</h2><p>Record the trade details for your portfolio.</p></div><div className="modal-header__context"><span>{draft.tradeType === "SELL" ? "Shares owned" : "Available cash"}</span><strong>{headerValue}</strong></div><button onClick={close} aria-label="Close"><X size={20} /></button></header>
        <form onSubmit={onSubmit}>
          {error && <FormError message={error} />}
          {stockOptionsError && <FormError message={stockOptionsError} />}
          <div className="form-grid">
            <div className="ticker-field">
              <label htmlFor="ticker-search">Ticker symbol</label>
              <div className="ticker-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTickerDropdownOpen(false); }}>
                <div className="ticker-search">
                  <Search size={17} />
                  <input id="ticker-search" type="text" value={tickerQuery} placeholder={stockOptions.length ? "Search ticker or company" : "Loading tickers..."} autoComplete="off" required role="combobox" aria-expanded={tickerDropdownOpen} aria-controls="ticker-options" aria-invalid={Boolean(tickerLookupError)} aria-describedby={tickerLookupError ? "ticker-lookup-error" : undefined} onClick={() => setTickerDropdownOpen(true)} onFocus={() => setTickerDropdownOpen(true)} onChange={(event) => { const value = event.target.value; setTickerQuery(value); setTickerLookupError(""); setTickerDropdownOpen(true); setDraft({ ...draft, ticker: "", assetName: "", pricePerUnit: 0 }); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchTicker(); } if (event.key === "Escape") setTickerDropdownOpen(false); }} />
                  <ChevronDown className={tickerDropdownOpen ? "ticker-chevron--open" : ""} size={17} />
                </div>
                {tickerDropdownOpen && <div className="ticker-options" id="ticker-options" role="listbox">{filteredStockOptions.length > 0 ? filteredStockOptions.map((stock) => <button key={stock.ticker} type="button" className="ticker-option" onMouseDown={(event) => { event.preventDefault(); void selectTicker(stock.ticker); }}><strong>{stock.ticker}</strong><span>{stock.name}</span></button>) : <div className="ticker-options__empty">No matching stocks found</div>}</div>}
              </div>
              {tickerLookupError && <div className="ticker-feedback" id="ticker-lookup-error" role="status"><AlertCircle size={14} /><span>{tickerLookupError}</span></div>}
            </div>
            <Field label="Asset name"><input value={draft.assetName} onChange={(event) => setDraft({ ...draft, assetName: event.target.value })} placeholder="e.g. Apple Inc." maxLength={255} required /></Field>
            <Field label="Asset type"><select value={draft.assetType} onChange={(event) => setDraft({ ...draft, assetType: event.target.value as AssetType })}>{assetTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
            <Field label="Trade type"><div className="segmented-control">{(["BUY", "SELL"] as TradeType[]).map((type) => <button key={type} type="button" className={draft.tradeType === type ? "selected" : ""} onClick={() => setDraft({ ...draft, tradeType: type })}>{draft.tradeType === type && <Check size={14} />}{type === "BUY" ? "Buy" : "Sell"}</button>)}</div></Field>
            <Field label="Quantity"><input type="number" value={draft.quantity || ""} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} min="0.000001" max={sellQuantityMax} step="any" placeholder="0.00" required /></Field>
            <Field label="Price per unit"><div className="input-prefix input-prefix--currency"><span>{draft.currency}</span><input type="number" value={draft.pricePerUnit || ""} onChange={(event) => setDraft({ ...draft, pricePerUnit: Number(event.target.value) })} min="0" step="0.001" placeholder="0.000" required /></div></Field>
            <div className="currency-display"><span>Currency</span><div><strong>{draft.currency}</strong><small>Portfolio base currency</small></div></div>
            <Field label="Trading fee"><div className="input-prefix input-prefix--currency"><span>{draft.currency}</span><input type="number" value={draft.feeAmount || ""} onChange={(event) => setDraft({ ...draft, feeAmount: Number(event.target.value) })} min="0" step="0.01" placeholder="0.00" /></div></Field>
            <Field label="Trade date & time" className="form-span"><input type="datetime-local" value={draft.tradedAt} onChange={(event) => setDraft({ ...draft, tradedAt: event.target.value })} required /></Field>
          </div>
          <div className="trade-summary"><span>{draft.tradeType === "SELL" ? "Estimated sale proceeds" : "Estimated transaction value"}</span><strong>{formatCurrency(estimatedValue, draft.currency)}</strong></div>
          <footer className="modal-footer"><button className="secondary-button" type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary-button" disabled={submitting}>{submitting && <LoaderCircle className="spin" size={15} />}{submitLabel}</button></footer>
        </form>
      </section>
    </div>
  );
}
