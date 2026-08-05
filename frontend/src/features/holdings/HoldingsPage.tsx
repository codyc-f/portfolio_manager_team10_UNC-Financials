import {
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  PieChart,
  Plus,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AssetType, Holding, Position, Portfolio } from "../../types";
import type { Page } from "../../app/types";
import { assetTypes } from "../../constants/portfolio";
import { CompanyLogo } from "../../components/common/CompanyLogo";
import { FilterSelect } from "../../components/common/FilterSelect";
import { MetricCard } from "../../components/common/MetricCard";
import { formatCurrency, formatPercent, gainLossClass } from "../../utils/formatters";

interface HoldingsPageProps {
  portfolio: Portfolio | null;
  holdings: Holding[];
  positions: Position[];
  visiblePositions: Position[];
  positionsLastUpdated: string;
  loading: boolean;
  query: string;
  assetFilter: AssetType | "All";
  invested: number;
  setQuery: (query: string) => void;
  setAssetFilter: (filter: AssetType | "All") => void;
  clearFilters: () => void;
  createHolding: () => void;
  sellPosition: (position: Position) => void;
  openPositionTransactions: (position: Position) => void;
  openAllTransactions: () => void;
  navigate: (page: Page) => void;
}

export function HoldingsPage({ portfolio, holdings, positions, visiblePositions, positionsLastUpdated, loading, query, assetFilter, invested, setQuery, setAssetFilter, clearFilters, createHolding, sellPosition, openPositionTransactions, openAllTransactions, navigate }: HoldingsPageProps) {
  return (
    <>
      <section className="page-heading">
        <div><div className="eyebrow"><span className="status-dot" /> PORTFOLIO ACTIVE</div><h1>Holdings</h1><p>Review active positions in {portfolio?.name}.</p></div>
        <button className="primary-button" onClick={createHolding}><Plus size={18} /> Add holding</button>
      </section>

      <section className="metrics-grid" aria-label="Portfolio summary">
        <MetricCard className="metric-card--primary" icon={<WalletCards size={20} />} label="Cash balance" value={formatCurrency(portfolio?.balance ?? 0, portfolio?.baseCurrency)} note="Available funds for new buys" />
        <MetricCard className="metric-card--blue" icon={<CircleDollarSign size={20} />} label="Net invested" value={formatCurrency(invested, portfolio?.baseCurrency)} note="Open position cost basis" />
        <MetricCard className="metric-card--amber" icon={<BriefcaseBusiness size={20} />} label="Open assets" value={String(positions.length)} note="Unique tickers in this portfolio" />
        <MetricCard className="metric-card--blue" icon={<Clock3 size={20} />} label="Total transactions" value={String(holdings.length)} note="Buy and sell records" />
      </section>

      <section className="holdings-card" aria-busy={loading}>
        <div className="card-heading">
          <div><h2>All holdings</h2><p>{visiblePositions.length} active positions shown{positionsLastUpdated && ` • Last updated ${positionsLastUpdated}`}</p></div>
          <div className="filters">
            <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search holdings" aria-label="Search holdings" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}</label>
            <FilterSelect label="Asset type" value={assetFilter} onChange={(value) => setAssetFilter(value as AssetType | "All")} options={["All", ...assetTypes]} allLabel="All assets" />
          </div>
        </div>

        {loading ? (
          <div className="table-loading"><LoaderCircle className="spin" size={23} />Loading holdings…</div>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Asset</th><th>Type</th><th>Quantity</th><th>Avg cost</th><th>Current price</th><th>Cost basis</th><th>Market value</th><th>Unrealized gain</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {visiblePositions.map((position) => (
                    <tr key={`${position.ticker}-${position.currency}`} className="clickable-row" tabIndex={0} onClick={() => openPositionTransactions(position)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPositionTransactions(position); } }} aria-label={`View ${position.ticker} transaction history`}>
                      <td><div className="asset-cell"><CompanyLogo ticker={position.ticker} logoUrl={position.logoUrl} assetType={position.assetType} /><div><strong>{position.ticker}</strong><span>{position.assetName}</span></div></div></td>
                      <td><span className="type-pill">{position.assetType}</span></td>
                      <td>{position.quantityOwned.toLocaleString()}</td>
                      <td>{formatCurrency(position.averageCost, position.currency)}</td>
                      <td>{position.currentPrice === null ? "Unavailable" : formatCurrency(position.currentPrice, position.currency)}</td>
                      <td className="value-cell">{formatCurrency(position.costBasis, position.currency)}</td>
                      <td>{position.marketValue === null ? "Unavailable" : formatCurrency(position.marketValue, position.currency)}</td>
                      <td>{position.unrealizedGain === null ? "Unavailable" : <span className={gainLossClass(position.unrealizedGain)}><span>{formatCurrency(position.unrealizedGain, position.currency)}</span>{position.unrealizedGainPercent !== null && <small>{formatPercent(position.unrealizedGainPercent)}</small>}</span>}</td>
                      <td><div className="row-actions"><button className="sell-action" onClick={(event) => { event.stopPropagation(); sellPosition(position); }} aria-label={`Sell ${position.ticker}`}>Sell</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visiblePositions.length === 0 && (
              <div className="empty-state"><div><BriefcaseBusiness size={22} /></div><h3>{positions.length ? "No holdings found" : "No active positions"}</h3><p>{positions.length ? "Try changing your search or filters." : "Add a buy transaction to create an active position."}</p><button onClick={positions.length ? clearFilters : createHolding}>{positions.length ? "Clear filters" : "Add a holding"}</button></div>
            )}
            <div className="table-footer"><span>Showing {visiblePositions.length} of {positions.length} positions from {holdings.length} transactions</span><button className="table-footer__action" onClick={openAllTransactions} disabled={holdings.length === 0}>List all transactions</button></div>
          </>
        )}
      </section>

      <section className="future-panels">
        <FuturePanel icon={<BarChart3 size={19} />} title="Performance analytics" description="View the recent market value of your open positions." onClick={() => navigate("performance")} chart />
        <FuturePanel icon={<PieChart size={19} />} title="Asset allocation" description="See how your current market value is divided among stocks." onClick={() => navigate("allocation")} />
      </section>
    </>
  );
}

function FuturePanel({ icon, title, description, chart, onClick }: { icon: ReactNode; title: string; description: string; chart?: boolean; onClick: () => void }) {
  return <button type="button" className="future-panel-card" onClick={onClick}><div className="future-panel-icon">{icon}</div><div><span className="coming-soon">VIEW PAGE</span><h3>{title}</h3><p>{description}</p></div>{chart ? <div className="chart-skeleton" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div> : <div className="donut-skeleton" aria-hidden="true" />}</button>;
}
