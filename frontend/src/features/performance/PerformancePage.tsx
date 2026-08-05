import { AlertCircle, BarChart3, CircleDollarSign, ExternalLink, LoaderCircle, Newspaper, RefreshCw, TrendingUp } from "lucide-react";
import { useState } from "react";
import { MetricCard } from "../../components/common/MetricCard";
import { PageState } from "../../components/common/PageState";
import type { NewsArticle, Portfolio, PortfolioPerformance } from "../../types";
import { formatCurrency, formatDate, formatNewsDate, formatPercent, gainLossClass } from "../../utils/formatters";

interface PerformancePageProps {
  portfolio: Portfolio | null;
  performance: PortfolioPerformance | null;
  loading: boolean;
  error: string;
  retry: () => void;
  news: NewsArticle[];
  newsLoading: boolean;
  newsError: string;
  retryNews: () => void;
}

export function PerformancePage({ portfolio, performance, loading, error, retry, news, newsLoading, newsError, retryNews }: PerformancePageProps) {
  const points = performance?.points ?? [];
  const firstValue = points[0]?.value ?? 0;
  const currentValue = points[points.length - 1]?.value ?? 0;
  const valueChange = currentValue - firstValue;
  const percentChange = firstValue ? (valueChange / firstValue) * 100 : 0;

  return (
    <>
      <section className="page-heading">
        <div><div className="eyebrow"><span className="status-dot" /> YAHOO FINANCE · 1 MONTH</div><h1>Performance</h1><p>Recent market value for {portfolio?.name ?? "the selected portfolio"}.</p></div>
        {portfolio && <button className="secondary-button refresh-button" onClick={retry} disabled={loading}><RefreshCw size={15} /> Refresh</button>}
      </section>
      {!portfolio ? (
        <PageState icon={<BarChart3 size={24} />} title="No portfolio selected" description="Select a portfolio to view its performance." />
      ) : loading ? (
        <PageState loading title="Loading performance" description="Getting recent prices from Yahoo Finance…" />
      ) : error ? (
        <PageState error title="Performance unavailable" description={error} actionLabel="Try again" onAction={retry} />
      ) : points.length === 0 ? (
        <PageState icon={<BarChart3 size={24} />} title="No performance data yet" description="This portfolio needs an active holding before a performance chart can be calculated." />
      ) : (
        <>
          <section className="performance-metrics">
            <MetricCard className="metric-card--primary" icon={<CircleDollarSign size={20} />} label="Latest position value" value={formatCurrency(currentValue, performance?.currency)} note="Latest available Yahoo close" />
            <MetricCard icon={<TrendingUp size={20} />} label="One-month change" value={formatCurrency(valueChange, performance?.currency)} note={formatPercent(percentChange)} />
          </section>
          <section className="analytics-card">
            <div className="analytics-card__heading"><div><h2>Portfolio value over time</h2><p>Daily closing value of current open positions</p></div><span className={gainLossClass(valueChange)}>{formatPercent(percentChange)}</span></div>
            <PerformanceLineChart points={points} currency={performance?.currency ?? portfolio.baseCurrency} />
            <p className="analytics-note">This first version applies today's open quantities to the last month of Yahoo closing prices. It excludes cash and does not reconstruct quantities at each historical trade date.</p>
          </section>
        </>
      )}
      <section className="news-section">
        <div className="section-heading"><div><Newspaper size={18} /><h2>Recent Stock News You May Be Interested In</h2></div><button onClick={retryNews} disabled={newsLoading}><RefreshCw className={newsLoading ? "spin" : ""} size={14} /> Refresh</button></div>
        {newsLoading ? (
          <div className="news-state"><LoaderCircle className="spin" size={20} /> Loading recent news…</div>
        ) : newsError ? (
          <div className="news-state news-state--error"><AlertCircle size={18} /><span>{newsError}</span><button onClick={retryNews}>Try again</button></div>
        ) : news.length === 0 ? (
          <div className="news-state">No recent articles are available.</div>
        ) : (
          <div className="news-grid">{news.map((article) => <article className="news-card" key={article.url}><NewsThumbnail article={article} /><div className="news-meta"><span>{article.publisher}</span>{article.publishedAt && <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>}</div><h3>{article.headline}</h3>{article.description && <p>{article.description}</p>}<a href={article.url} target="_blank" rel="noreferrer">Read original article <ExternalLink size={13} /></a></article>)}</div>
        )}
      </section>
    </>
  );
}

function NewsThumbnail({ article }: { article: NewsArticle }) {
  const [failed, setFailed] = useState(false);
  return <div className="news-image">{article.imageUrl && !failed ? <img src={article.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <div className="news-image__fallback" aria-hidden="true"><Newspaper size={24} /></div>}</div>;
}

function PerformanceLineChart({ points, currency }: { points: PortfolioPerformance["points"]; currency: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 900;
  const height = 280;
  const padding = 28;
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const coordinates = points.map((point, index) => ({ x: padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2), y: padding + ((maximum - point.value) / range) * (height - padding * 2) }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const mouseX = ((event.clientX - bounds.left) / bounds.width) * width;
    let nearestIndex = 0;
    let smallestDistance = Math.abs(coordinates[0].x - mouseX);
    coordinates.forEach((coordinate, index) => {
      const distance = Math.abs(coordinate.x - mouseX);
      if (distance < smallestDistance) { smallestDistance = distance; nearestIndex = index; }
    });
    setActiveIndex(nearestIndex);
  }

  const activeCoordinate = activeIndex === null ? null : coordinates[activeIndex];
  const activePoint = activeIndex === null ? null : points[activeIndex];
  return (
    <div className="line-chart">
      <div className="line-chart__range"><span>{formatCurrency(maximum, currency)}</span><span>{formatCurrency(minimum, currency)}</span></div>
      <div className="line-chart__visual">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart of daily portfolio market value over the last month" onMouseMove={handleMouseMove} onMouseLeave={() => setActiveIndex(null)}>
          <defs><linearGradient id="performance-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4b9cd3" stopOpacity=".24" /><stop offset="100%" stopColor="#4b9cd3" stopOpacity="0" /></linearGradient></defs>
          <path className="line-chart__area" d={`${path} L ${coordinates[coordinates.length - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`} />
          <path className="line-chart__line" d={path} />
          {activeCoordinate && <><line className="line-chart__guide" x1={activeCoordinate.x} x2={activeCoordinate.x} y1={padding} y2={height - padding} /><circle className="line-chart__active-dot" cx={activeCoordinate.x} cy={activeCoordinate.y} r="6" /></>}
        </svg>
        {activeCoordinate && activePoint && <div className="line-chart__tooltip" role="tooltip" style={{ left: `${(activeCoordinate.x / width) * 100}%`, top: `${(activeCoordinate.y / height) * 100}%` }}><div className="line-chart__tooltip-heading"><strong>{formatDate(activePoint.date)}</strong><span>Portfolio value: {formatCurrency(activePoint.value, currency)}</span></div><div className="line-chart__stock-prices">{activePoint.stockValues.map((stock) => <div className="line-chart__stock-price" key={stock.ticker}><div className="line-chart__stock-info"><strong>{stock.ticker}</strong><span>{stock.quantity} shares × {formatCurrency(stock.close, stock.currency)}</span></div><strong>{formatCurrency(stock.value, stock.currency)}</strong></div>)}</div></div>}
      </div>
      <div className="line-chart__dates"><span>{formatDate(points[0].date)}</span><span>{formatDate(points[points.length - 1].date)}</span></div>
    </div>
  );
}
