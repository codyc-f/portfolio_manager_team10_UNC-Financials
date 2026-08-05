import { X } from "lucide-react";
import { useEffect } from "react";
import type { TransactionHistoryTarget } from "../../app/types";
import type { Holding } from "../../types";
import { formatCurrency, formatDateTime } from "../../utils/formatters";

export function TransactionHistoryModal({ target, holdings, close }: { target: TransactionHistoryTarget; holdings: Holding[]; close: () => void }) {
  const allTransactions = target === "all";
  const transactions = holdings.filter((holding) => allTransactions || (holding.ticker === target.ticker && holding.currency === target.currency)).sort((first, second) => new Date(second.tradedAt).getTime() - new Date(first.tradedAt).getTime());
  const title = allTransactions ? "All transactions" : target.ticker;
  const description = allTransactions
    ? `${transactions.length} holding transaction${transactions.length === 1 ? "" : "s"}`
    : `${target.assetName} • ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") close(); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  return (
    <div className="modal-backdrop">
      <section className="modal transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-history-title">
        <header className="modal-header"><div><span className="modal-kicker">TRANSACTION HISTORY</span><h2 id="transaction-history-title">{title}</h2><p>{description}</p></div><button onClick={close} aria-label="Close"><X size={20} /></button></header>
        <div className="transaction-list">
          {transactions.map((transaction) => {
            const grossValue = transaction.quantity * transaction.pricePerUnit;
            const totalValue = transaction.tradeType === "SELL" ? Math.max(grossValue - transaction.feeAmount, 0) : grossValue + transaction.feeAmount;
            return <article className="transaction-row" key={transaction.id}><div><span className={`trade-pill trade-pill--${transaction.tradeType.toLowerCase()}`}>{transaction.tradeType === "BUY" ? "Buy" : "Sell"}</span><strong>{formatCurrency(totalValue, transaction.currency)}</strong>{allTransactions && <span className="transaction-asset">{transaction.ticker} • {transaction.assetName}</span>}<time dateTime={transaction.tradedAt}>{formatDateTime(transaction.tradedAt)}</time></div><dl><div><dt>Quantity</dt><dd>{transaction.quantity.toLocaleString()}</dd></div><div><dt>Price</dt><dd>{formatCurrency(transaction.pricePerUnit, transaction.currency)}</dd></div><div><dt>Fee</dt><dd>{formatCurrency(transaction.feeAmount, transaction.currency)}</dd></div></dl></article>;
          })}
        </div>
      </section>
    </div>
  );
}
