import { BriefcaseBusiness, CircleDollarSign, PieChart, WalletCards } from "lucide-react";
import { useState } from "react";
import { MetricCard } from "../../components/common/MetricCard";
import { PageState } from "../../components/common/PageState";
import type { Portfolio, Position } from "../../types";
import { formatCurrency } from "../../utils/formatters";

const allocationColors = [
  "#4b9cd3", "#f28e2b", "#59a14f", "#af7aa1", "#e15759", "#edc948",
  "#00a6a6", "#ff7aa2", "#7668c9", "#8c6d45", "#76b7b2", "#d66fb1",
];

interface AllocationPageProps {
  portfolio: Portfolio | null;
  positions: Position[];
  loading: boolean;
  error: string;
  retry: () => void;
}

export function AllocationPage({ portfolio, positions, loading, error, retry }: AllocationPageProps) {
  const allocatedPositions = positions.filter((position) => position.marketValue !== null && position.marketValue > 0);
  const investedValue = allocatedPositions.reduce((sum, position) => sum + (position.marketValue ?? 0), 0);
  const totalValue = investedValue + (portfolio?.balance ?? 0);

  return (
    <>
      <section className="page-heading"><div><div className="eyebrow"><span className="status-dot" /> LIVE MARKET VALUES</div><h1>Allocation</h1><p>See how {portfolio?.name ?? "your portfolio"} is divided among its stocks.</p></div></section>
      {!portfolio ? (
        <PageState icon={<PieChart size={24} />} title="No portfolio selected" description="Select a portfolio to view its allocation." />
      ) : loading ? (
        <PageState loading title="Loading allocation" description="Refreshing current holding values…" />
      ) : error ? (
        <PageState error title="Allocation unavailable" description={error} actionLabel="Try again" onAction={retry} />
      ) : positions.length === 0 ? (
        <PageState icon={<PieChart size={24} />} title="This portfolio has no holdings" description="Add a buy transaction to see its allocation." />
      ) : allocatedPositions.length === 0 ? (
        <PageState error title="Market values are unavailable" description="Current prices could not be loaded for this portfolio's holdings." actionLabel="Try again" onAction={retry} />
      ) : (
        <>
          <section className="allocation-summary" aria-label="Portfolio value summary">
            <MetricCard icon={<CircleDollarSign size={20} />} label="Invested market value" value={formatCurrency(investedValue, portfolio.baseCurrency)} note="Current value of priced positions" />
            <MetricCard icon={<WalletCards size={20} />} label="Cash balance" value={formatCurrency(portfolio.balance, portfolio.baseCurrency)} note="Available portfolio cash" />
            <MetricCard className="metric-card--primary" icon={<BriefcaseBusiness size={20} />} label="Total portfolio value" value={formatCurrency(totalValue, portfolio.baseCurrency)} note="Market value plus cash" />
          </section>
          <section className="analytics-card allocation-card">
            <div className="analytics-card__heading"><div><h2>Stock allocation</h2><p>Percentage of current invested market value</p></div><strong>{formatCurrency(investedValue, portfolio.baseCurrency)}</strong></div>
            <div className="allocation-layout">
              <AllocationDonut positions={allocatedPositions} total={investedValue} />
              <div className="allocation-legend">
                {allocatedPositions.map((position, index) => {
                  const value = position.marketValue ?? 0;
                  const percentage = (value / investedValue) * 100;
                  return <div className="allocation-row" key={`${position.ticker}-${position.currency}`}><span className="allocation-swatch" style={{ background: allocationColors[index % allocationColors.length] }} /><div><strong>{position.ticker}</strong><span>{position.assetName}</span></div><span>{formatCurrency(value, position.currency)}</span><strong>{percentage.toFixed(1)}%</strong></div>;
                })}
              </div>
            </div>
            {allocatedPositions.length < positions.length && <p className="analytics-note">Holdings without a current Yahoo price are excluded from the chart.</p>}
          </section>
        </>
      )}
    </>
  );
}

function AllocationDonut({ positions, total }: { positions: Position[]; total: number }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const activePosition = activeIndex === null ? null : positions[activeIndex];
  const activeValue = activePosition?.marketValue ?? 0;

  return (
    <div className="allocation-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={`Doughnut chart showing ${positions.length} stock allocations`}>
        <circle className="allocation-donut__track" cx="60" cy="60" r={radius} />
        {positions.map((position, index) => {
          const value = position.marketValue ?? 0;
          const percentage = value / total;
          const offset = accumulated;
          accumulated += percentage;
          const label = `${position.ticker}, ${formatCurrency(value, position.currency)}, ${(percentage * 100).toFixed(1)}%`;
          return <circle className="allocation-donut__segment" key={`${position.ticker}-${position.currency}`} cx="60" cy="60" r={radius} pathLength={circumference} stroke={allocationColors[index % allocationColors.length]} strokeDasharray={`${percentage * circumference} ${circumference}`} strokeDashoffset={-offset * circumference} tabIndex={0} aria-label={label} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}><title>{label}</title></circle>;
        })}
      </svg>
      <div className="allocation-donut__center"><strong>{positions.length}</strong><span>positions</span></div>
      {activePosition && <div className="allocation-tooltip" role="tooltip"><strong>{activePosition.ticker}</strong><span>{activePosition.assetName}</span><span>{formatCurrency(activeValue, activePosition.currency)} · {((activeValue / total) * 100).toFixed(1)}%</span></div>}
    </div>
  );
}
