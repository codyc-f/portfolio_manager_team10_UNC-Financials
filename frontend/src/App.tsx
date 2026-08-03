import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Menu,
  Moon,
  Newspaper,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "./api";
import type {
  AssetType,
  Holding,
  HoldingDraft,
  NewsArticle,
  Position,
  Portfolio,
  PortfolioDraft,
  PortfolioPerformance,
  StockOption,
  TradeType,
} from "./types";

type Page = "holdings" | "performance" | "allocation";
type Theme = "light" | "dark";
type TransactionHistoryTarget = Position | "all";

const assetTypes: AssetType[] = ["Stock", "ETF", "Bond", "Crypto", "Cash"];
const emptyPortfolio: PortfolioDraft = {
  name: "",
  baseCurrency: "USD",
  balance: 0,
};

function createEmptyHolding(portfolioId: number, currency = "USD"): HoldingDraft {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return {
    portfolioId,
    ticker: "",
    assetName: "",
    assetType: "Stock",
    currency,
    tradeType: "BUY",
    quantity: 0,
    pricePerUnit: 0,
    feeAmount: 0,
    tradedAt: now.toISOString().slice(0, 16),
  };
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function gainLossClass(value: number | null) {
  if (value === null || value === 0) {
    return "gain-loss gain-loss--neutral";
  }

  return value > 0 ? "gain-loss gain-loss--gain" : "gain-loss gain-loss--loss";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem("unc-financials-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(
    null,
  );
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLastUpdated, setPositionsLastUpdated] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [stockOptionsError, setStockOptionsError] = useState("");
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetType | "All">("All");
  const [tradeFilter, setTradeFilter] = useState<TradeType | "All">("All");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [activePage, setActivePage] = useState<Page>("holdings");
  const [performance, setPerformance] =
    useState<PortfolioPerformance | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState("");
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");

  const [holdingFormOpen, setHoldingFormOpen] = useState(false);
  const [holdingDraft, setHoldingDraft] = useState<HoldingDraft>(
    createEmptyHolding(1),
  );
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);
  const [transactionHistoryTarget, setTransactionHistoryTarget] =
    useState<TransactionHistoryTarget | null>(null);

  const [portfolioFormOpen, setPortfolioFormOpen] = useState(false);
  const [portfolioDraft, setPortfolioDraft] =
    useState<PortfolioDraft>(emptyPortfolio);
  const [editingPortfolioId, setEditingPortfolioId] = useState<number | null>(
    null,
  );
  const [deletingPortfolio, setDeletingPortfolio] =
    useState<Portfolio | null>(null);

  const selectedPortfolio =
    portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null;

  async function refreshPortfolios(preferredId?: number) {
    setConnectionError("");
    try {
      const nextPortfolios = await api.listPortfolios();
      setPortfolios(nextPortfolios);
      setSelectedPortfolioId((current) => {
        if (
          preferredId &&
          nextPortfolios.some((portfolio) => portfolio.id === preferredId)
        ) {
          return preferredId;
        }
        if (
          current &&
          nextPortfolios.some((portfolio) => portfolio.id === current)
        ) {
          return current;
        }
        return nextPortfolios[0]?.id ?? null;
      });
    } catch (error) {
      setConnectionError(errorMessage(error));
    } finally {
      setInitialLoading(false);
    }
  }

  async function refreshHoldings(portfolioId: number) {
    setHoldingsLoading(true);
    setConnectionError("");
    try {
      const [nextHoldings, nextPositions] = await Promise.all([
        api.listHoldings(portfolioId),
        api.listPositions(portfolioId),
      ]);
      setHoldings(nextHoldings);
      setPositions(nextPositions);
      setPositionsLastUpdated(new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }));
    } catch (error) {
      setConnectionError(errorMessage(error));
      setHoldings([]);
      setPositions([]);
      setPositionsLastUpdated("");
    } finally {
      setHoldingsLoading(false);
    }
  }

  async function refreshPositions(portfolioId: number) {
    try {
      setPositions(await api.listPositions(portfolioId));
      setConnectionError("");
      setPositionsLastUpdated(new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }));
    } catch (error) {
      setConnectionError(errorMessage(error));
    }
  }

  async function refreshStockOptions() {
    setStockOptionsError("");
    try {
      setStockOptions(await api.listMostActiveStocks());
    } catch (error) {
      setStockOptions([]);
      setStockOptionsError(errorMessage(error));
    }
  }

  async function refreshPerformance(portfolioId: number) {
    setPerformanceLoading(true);
    setPerformanceError("");
    try {
      setPerformance(await api.getPortfolioPerformance(portfolioId));
    } catch (error) {
      setPerformance(null);
      setPerformanceError(errorMessage(error));
    } finally {
      setPerformanceLoading(false);
    }
  }

  async function refreshNews() {
    setNewsLoading(true);
    setNewsError("");
    try {
      setNews(await api.listMarketNews());
    } catch (error) {
      setNews([]);
      setNewsError(errorMessage(error));
    } finally {
      setNewsLoading(false);
    }
  }

  useEffect(() => {
    void refreshPortfolios();
    void refreshStockOptions();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("unc-financials-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (selectedPortfolioId === null) {
      setHoldings([]);
      setPositions([]);
      setPositionsLastUpdated("");
      return;
    }
    setQuery("");
    setAssetFilter("All");
    setTradeFilter("All");
    void refreshHoldings(selectedPortfolioId);
  }, [selectedPortfolioId]);

  useEffect(() => {
    if (selectedPortfolioId === null) return;

    // TODO: Add server-side 30-second price caching before supporting
    // multiple users or browser tabs that poll yfinance-backed endpoints.
    const intervalId = window.setInterval(() => {
      void refreshPositions(selectedPortfolioId);
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [selectedPortfolioId]);

  useEffect(() => {
    if (activePage !== "performance" || selectedPortfolioId === null) return;
    void refreshPerformance(selectedPortfolioId);
    void refreshNews();
  }, [activePage, selectedPortfolioId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const visiblePositions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return positions.filter((position) => {
      const matchesQuery =
        !normalizedQuery ||
        `${position.ticker} ${position.assetName} ${position.assetType}`
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        (assetFilter === "All" || position.assetType === assetFilter)
      );
    });
  }, [assetFilter, positions, query]);

  const totals = useMemo(() => {
    const invested = positions.reduce(
      (sum, position) => sum + position.costBasis,
      0,
    );
    return {
      invested,
      positions: positions.length,
      transactions: holdings.length,
    };
  }, [holdings, positions]);

  function openCreateHolding() {
    if (!selectedPortfolioId) return;
    setEditingHoldingId(null);
    setMutationError("");
    setHoldingDraft(
      createEmptyHolding(
        selectedPortfolioId,
        selectedPortfolio?.baseCurrency ?? "USD",
      ),
    );
    setHoldingFormOpen(true);
  }

  function openEditHolding(holding: Holding) {
    const { id, ...draft } = holding;
    setEditingHoldingId(id);
    setHoldingDraft({
      ...draft,
      currency: selectedPortfolio?.baseCurrency ?? draft.currency,
    });
    setMutationError("");
    setHoldingFormOpen(true);
  }

  function openSellPosition(position: Position) {
    if (!selectedPortfolioId) return;
    setEditingHoldingId(null);
    setMutationError("");
    setHoldingDraft({
      portfolioId: selectedPortfolioId,
      ticker: position.ticker,
      assetName: position.assetName,
      assetType: position.assetType,
      currency: selectedPortfolio?.baseCurrency ?? position.currency,
      tradeType: "SELL",
      quantity: 0,
      pricePerUnit: roundPrice(position.currentPrice ?? position.averageCost),
      feeAmount: 0,
      tradedAt: createEmptyHolding(selectedPortfolioId).tradedAt,
    });
    setHoldingFormOpen(true);
  }

  function openPositionTransactions(position: Position) {
    setTransactionHistoryTarget(position);
  }

  function openAllTransactions() {
    setTransactionHistoryTarget("all");
  }

  async function saveHolding(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMutationError("");
    const normalizedHoldingDraft = {
      ...holdingDraft,
      pricePerUnit: roundPrice(holdingDraft.pricePerUnit),
    };
    try {
      if (editingHoldingId === null) {
        await api.createHolding(normalizedHoldingDraft);
        setToast(
          `${normalizedHoldingDraft.tradeType === "BUY" ? "Purchased" : "Sold"} ` +
          `${normalizedHoldingDraft.ticker.toUpperCase()} successfully`,
        );
      } else {
        await api.updateHolding(editingHoldingId, normalizedHoldingDraft);
        setToast(`${normalizedHoldingDraft.ticker.toUpperCase()} was updated`);
      }
      setHoldingFormOpen(false);
      await refreshHoldings(normalizedHoldingDraft.portfolioId);
      await refreshPortfolios(normalizedHoldingDraft.portfolioId);
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteHolding() {
    if (!deletingHolding || !selectedPortfolioId) return;
    setSubmitting(true);
    setMutationError("");
    try {
      await api.deleteHolding(deletingHolding.id);
      setToast(`${deletingHolding.ticker} was removed`);
      setDeletingHolding(null);
      await refreshHoldings(selectedPortfolioId);
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openCreatePortfolio() {
    setEditingPortfolioId(null);
    setPortfolioDraft(emptyPortfolio);
    setMutationError("");
    setPortfolioFormOpen(true);
  }

  function openEditPortfolio() {
    if (!selectedPortfolio) return;
    setEditingPortfolioId(selectedPortfolio.id);
    setPortfolioDraft({
      name: selectedPortfolio.name,
      baseCurrency: selectedPortfolio.baseCurrency,
      balance: selectedPortfolio.balance,
    });
    setMutationError("");
    setPortfolioFormOpen(true);
  }

  async function savePortfolio(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMutationError("");
    try {
      let preferredId = editingPortfolioId ?? undefined;
      if (editingPortfolioId === null) {
        const created = await api.createPortfolio(portfolioDraft);
        preferredId = created.id;
        setToast(`${portfolioDraft.name.trim()} was created`);
      } else {
        await api.updatePortfolio(editingPortfolioId, portfolioDraft);
        setToast(`${portfolioDraft.name.trim()} was updated`);
      }
      setPortfolioFormOpen(false);
      await refreshPortfolios(preferredId);
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePortfolio() {
    if (!deletingPortfolio) return;
    setSubmitting(true);
    setMutationError("");
    try {
      await api.deletePortfolio(deletingPortfolio.id);
      setToast(`${deletingPortfolio.name} was deleted`);
      setDeletingPortfolio(null);
      await refreshPortfolios();
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="app-state">
        <LoaderCircle className="spin" size={28} />
        <h1>Connecting to your portfolio</h1>
        <p>Loading data from UNC Financials…</p>
      </div>
    );
  }

  if (connectionError && portfolios.length === 0) {
    return (
      <div className="app-state app-state--error">
        <AlertCircle size={30} />
        <h1>We couldn’t connect</h1>
        <p>{connectionError}</p>
        <button
          className="primary-button"
          onClick={() => {
            setInitialLoading(true);
            void refreshPortfolios();
          }}
        >
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-brand">
          <div className="brand-mark"><TrendingUp size={21} /></div>
          <strong>UNC Financials</strong>
        </div>
        <section className="onboarding-card">
          <span className="modal-kicker">WELCOME TO UNC FINANCIALS</span>
          <h1>Create your first portfolio</h1>
          <p>
            A portfolio groups your holding transactions and determines the
            currency used in your dashboard.
          </p>
          <PortfolioForm
            draft={portfolioDraft}
            setDraft={setPortfolioDraft}
            onSubmit={savePortfolio}
            submitting={submitting}
            error={mutationError}
            submitLabel="Create portfolio"
          />
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        open={mobileNavOpen}
        close={() => setMobileNavOpen(false)}
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page);
          setMobileNavOpen(false);
        }}
      />
      {mobileNavOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="workspace">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div className="portfolio-picker">
            <span>Portfolio</span>
            <label className="portfolio-select">
              <select
                value={selectedPortfolioId ?? ""}
                onChange={(event) =>
                  setSelectedPortfolioId(Number(event.target.value))
                }
                aria-label="Selected portfolio"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="topbar-text-action" onClick={openEditPortfolio}>
              <Pencil size={14} /> <span className="topbar-action-label">Edit</span>
            </button>
            <button className="topbar-text-action" onClick={openCreatePortfolio}>
              <Plus size={14} /> <span className="topbar-action-label">New</span>
            </button>
            <button
              className="topbar-text-action topbar-text-action--danger"
              onClick={() => selectedPortfolio && setDeletingPortfolio(selectedPortfolio)}
            >
              <Trash2 size={14} /> <span className="topbar-action-label">Delete</span>
            </button>
          </div>
          <button
            className="icon-button theme-toggle"
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>

        <div className="page">
          {connectionError && activePage === "holdings" && (
            <div className="inline-alert">
              <AlertCircle size={17} />
              <span>{connectionError}</span>
              {selectedPortfolioId && (
                <button onClick={() => void refreshHoldings(selectedPortfolioId)}>
                  Try again
                </button>
              )}
            </div>
          )}

          {activePage === "holdings" && (
            <>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="status-dot" /> PORTFOLIO ACTIVE
              </div>
              <h1>Holdings</h1>
              <p>
                Review active positions in {selectedPortfolio?.name}.
              </p>
            </div>
            <button className="primary-button" onClick={openCreateHolding}>
              <Plus size={18} /> Add holding
            </button>
          </section>

          <section className="metrics-grid" aria-label="Portfolio summary">
            <MetricCard
              className="metric-card--primary"
              icon={<WalletCards size={20} />}
              label="Cash balance"
              value={formatCurrency(
                selectedPortfolio?.balance ?? 0,
                selectedPortfolio?.baseCurrency,
              )}
              note="Available funds for new buys"
            />
            <MetricCard
              className="metric-card--blue"
              icon={<CircleDollarSign size={20} />}
              label="Net invested"
              value={formatCurrency(
                totals.invested,
                selectedPortfolio?.baseCurrency,
              )}
              note="Open position cost basis"
            />
            <MetricCard
              className="metric-card--amber"
              icon={<BriefcaseBusiness size={20} />}
              label="Open assets"
              value={String(totals.positions)}
              note="Unique tickers in this portfolio"
            />
            <MetricCard
              className="metric-card--blue"
              icon={<Clock3 size={20} />}
              label="Total transactions"
              value={String(totals.transactions)}
              note="Buy and sell records"
            />
          </section>

          <section className="holdings-card" aria-busy={holdingsLoading}>
            <div className="card-heading">
              <div>
                <h2>All holdings</h2>
                <p>
                  {visiblePositions.length} active positions shown
                  {positionsLastUpdated && ` • Last updated ${positionsLastUpdated}`}
                </p>
              </div>
              <div className="filters">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search holdings"
                    aria-label="Search holdings"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} aria-label="Clear search">
                      <X size={15} />
                    </button>
                  )}
                </label>
                <FilterSelect
                  label="Asset type"
                  value={assetFilter}
                  onChange={(value) => setAssetFilter(value as AssetType | "All")}
                  options={["All", ...assetTypes]}
                  allLabel="All assets"
                />
              </div>
            </div>

            {holdingsLoading ? (
              <div className="table-loading">
                <LoaderCircle className="spin" size={23} />
                Loading holdings…
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Asset</th><th>Type</th><th>Quantity</th>
                        <th>Avg cost</th><th>Current price</th><th>Cost basis</th>
                        <th>Market value</th><th>Unrealized gain</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePositions.map((position) => (
                        <tr
                          key={`${position.ticker}-${position.currency}`}
                          className="clickable-row"
                          tabIndex={0}
                          onClick={() => openPositionTransactions(position)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPositionTransactions(position);
                            }
                          }}
                          aria-label={`View ${position.ticker} transaction history`}
                        >
                          <td>
                            <div className="asset-cell">
                              <CompanyLogo
                                ticker={position.ticker}
                                logoUrl={position.logoUrl}
                                assetType={position.assetType}
                              />
                              <div><strong>{position.ticker}</strong><span>{position.assetName}</span></div>
                            </div>
                          </td>
                          <td><span className="type-pill">{position.assetType}</span></td>
                          <td>{position.quantityOwned.toLocaleString()}</td>
                          <td>{formatCurrency(position.averageCost, position.currency)}</td>
                          <td>{position.currentPrice === null ? "Unavailable" : formatCurrency(position.currentPrice, position.currency)}</td>
                          <td className="value-cell">{formatCurrency(position.costBasis, position.currency)}</td>
                          <td>{position.marketValue === null ? "Unavailable" : formatCurrency(position.marketValue, position.currency)}</td>
                          <td>
                            {position.unrealizedGain === null ? (
                              "Unavailable"
                            ) : (
                              <span className={gainLossClass(position.unrealizedGain)}>
                                <span>{formatCurrency(position.unrealizedGain, position.currency)}</span>
                                {position.unrealizedGainPercent !== null && (
                                  <small>{formatPercent(position.unrealizedGainPercent)}</small>
                                )}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="sell-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openSellPosition(position);
                                }}
                                aria-label={`Sell ${position.ticker}`}
                              >
                                Sell
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visiblePositions.length === 0 && (
                  <div className="empty-state">
                    <div><BriefcaseBusiness size={22} /></div>
                    <h3>{positions.length ? "No holdings found" : "No active positions"}</h3>
                    <p>{positions.length ? "Try changing your search or filters." : "Add a buy transaction to create an active position."}</p>
                    <button onClick={positions.length ? () => {
                      setQuery(""); setAssetFilter("All"); setTradeFilter("All");
                    } : openCreateHolding}>
                      {positions.length ? "Clear filters" : "Add a holding"}
                    </button>
                  </div>
                )}
                <div className="table-footer">
                  <span>Showing {visiblePositions.length} of {positions.length} positions from {holdings.length} transactions</span>
                  <button
                    className="table-footer__action"
                    onClick={openAllTransactions}
                    disabled={holdings.length === 0}
                  >
                    List all transactions
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="future-panels">
            <FuturePanel
              icon={<BarChart3 size={19} />}
              title="Performance analytics"
              description="View the recent market value of your open positions."
              onClick={() => setActivePage("performance")}
              chart
            />
            <FuturePanel
              icon={<PieChart size={19} />}
              title="Asset allocation"
              description="See how your current market value is divided among stocks."
              onClick={() => setActivePage("allocation")}
            />
          </section>
            </>
          )}

          {activePage === "allocation" && (
            <AllocationPage
              portfolio={selectedPortfolio}
              positions={positions}
              loading={holdingsLoading}
              error={connectionError}
              retry={() => {
                if (selectedPortfolioId !== null) {
                  void refreshHoldings(selectedPortfolioId);
                }
              }}
            />
          )}

          {activePage === "performance" && (
            <PerformancePage
              portfolio={selectedPortfolio}
              performance={performance}
              loading={performanceLoading}
              error={performanceError}
              retry={() => {
                if (selectedPortfolioId !== null) {
                  void refreshPerformance(selectedPortfolioId);
                }
              }}
              news={news}
              newsLoading={newsLoading}
              newsError={newsError}
              retryNews={() => void refreshNews()}
            />
          )}
        </div>
      </main>

      {holdingFormOpen && (
        <HoldingModal
          draft={holdingDraft}
          setDraft={setHoldingDraft}
          positions={positions}
          stockOptions={stockOptions}
          stockOptionsError={stockOptionsError}
          availableCash={selectedPortfolio?.balance ?? 0}
          editing={editingHoldingId !== null}
          submitting={submitting}
          error={mutationError}
          close={() => setHoldingFormOpen(false)}
          onSubmit={saveHolding}
        />
      )}

      {transactionHistoryTarget && (
        <TransactionHistoryModal
          target={transactionHistoryTarget}
          holdings={holdings}
          close={() => setTransactionHistoryTarget(null)}
        />
      )}

      {portfolioFormOpen && (
        <div className="modal-backdrop">
          <section className="modal modal--compact" role="dialog" aria-modal="true">
            <header className="modal-header">
              <div>
                <span className="modal-kicker">{editingPortfolioId ? "EDIT PORTFOLIO" : "NEW PORTFOLIO"}</span>
                <h2>{editingPortfolioId ? "Portfolio details" : "Create a portfolio"}</h2>
                <p>Choose a clear name and three-letter base currency.</p>
              </div>
              <button onClick={() => setPortfolioFormOpen(false)} aria-label="Close"><X size={20} /></button>
            </header>
            <PortfolioForm
              draft={portfolioDraft}
              setDraft={setPortfolioDraft}
              onSubmit={savePortfolio}
              submitting={submitting}
              error={mutationError}
              submitLabel={editingPortfolioId ? "Save changes" : "Create portfolio"}
              cancel={() => setPortfolioFormOpen(false)}
            />
          </section>
        </div>
      )}

      {deletingHolding && (
        <ConfirmModal
          title={`Remove ${deletingHolding.ticker}?`}
          description={`This removes the transaction for ${deletingHolding.assetName}. This action cannot be undone.`}
          cancelLabel="Keep holding"
          confirmLabel="Remove transaction"
          submitting={submitting}
          error={mutationError}
          cancel={() => { setDeletingHolding(null); setMutationError(""); }}
          confirm={() => void deleteHolding()}
        />
      )}

      {deletingPortfolio && (
        <ConfirmModal
          title={`Delete ${deletingPortfolio.name}?`}
          description="A portfolio can only be deleted after all of its positions have been fully sold."
          cancelLabel="Keep portfolio"
          confirmLabel="Delete portfolio"
          submitting={submitting}
          error={mutationError}
          cancel={() => { setDeletingPortfolio(null); setMutationError(""); }}
          confirm={() => void deletePortfolio()}
        />
      )}

      {toast && <div className="toast" role="status"><span><Check size={14} /></span>{toast}</div>}
    </div>
  );
}

function Sidebar({
  open,
  close,
  activePage,
  onNavigate,
}: {
  open: boolean;
  close: () => void;
  activePage: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><TrendingUp size={20} strokeWidth={2.4} /></div>
        <div><strong>UNC Financials</strong><span>Portfolio manager</span></div>
        <button className="mobile-close" onClick={close} aria-label="Close navigation"><X size={20} /></button>
      </div>
      <nav className="main-nav" aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        <NavItem
          icon={<BriefcaseBusiness size={19} />}
          label="Holdings"
          active={activePage === "holdings"}
          onClick={() => onNavigate("holdings")}
        />
        <NavItem
          icon={<BarChart3 size={19} />}
          label="Performance"
          active={activePage === "performance"}
          onClick={() => onNavigate("performance")}
        />
        <NavItem
          icon={<PieChart size={19} />}
          label="Allocation"
          active={activePage === "allocation"}
          onClick={() => onNavigate("allocation")}
        />
        <p className="nav-label nav-label--secondary">Manage</p>
        <NavItem icon={<Settings size={19} />} label="Settings" future />
      </nav>
      <div className="sidebar-footer">
        <div className="secure-note"><ShieldCheck size={18} /><div><strong>Database connected</strong><span>Changes save to MySQL</span></div></div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, future, onClick }: { icon: React.ReactNode; label: string; active?: boolean; future?: boolean; onClick?: () => void }) {
  return <button className={`nav-item ${active ? "nav-item--active" : ""} ${future ? "nav-item--future" : ""}`} onClick={onClick} disabled={future}>{icon}<span>{label}</span>{future && <small>Soon</small>}</button>;
}

function MetricCard({ icon, label, value, note, className }: { icon: React.ReactNode; label: string; value: string; note: string; className?: string }) {
  return <article className={`metric-card ${className ?? ""}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function FilterSelect({ label, value, options, allLabel, onChange }: { label: string; value: string; options: string[]; allLabel: string; onChange: (value: string) => void }) {
  return <label className="select-field"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "All" ? allLabel : option === "BUY" ? "Buys" : option === "SELL" ? "Sells" : option}</option>)}</select><ChevronDown size={15} /></label>;
}

function FuturePanel({ icon, title, description, chart, onClick }: { icon: React.ReactNode; title: string; description: string; chart?: boolean; onClick: () => void }) {
  return <button type="button" className="future-panel-card" onClick={onClick}><div className="future-panel-icon">{icon}</div><div><span className="coming-soon">VIEW PAGE</span><h3>{title}</h3><p>{description}</p></div>{chart ? <div className="chart-skeleton" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div> : <div className="donut-skeleton" aria-hidden="true" />}</button>;
}

const allocationColors = [
  "#4b9cd3",
  "#f28e2b",
  "#59a14f",
  "#af7aa1",
  "#e15759",
  "#edc948",
  "#00a6a6",
  "#ff7aa2",
  "#7668c9",
  "#8c6d45",
  "#76b7b2",
  "#d66fb1",
];

function AllocationPage({
  portfolio,
  positions,
  loading,
  error,
  retry,
}: {
  portfolio: Portfolio | null;
  positions: Position[];
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const allocatedPositions = positions.filter(
    (position) => position.marketValue !== null && position.marketValue > 0,
  );
  const investedValue = allocatedPositions.reduce(
    (sum, position) => sum + (position.marketValue ?? 0),
    0,
  );
  const totalValue = investedValue + (portfolio?.balance ?? 0);

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="status-dot" /> LIVE MARKET VALUES</div>
          <h1>Allocation</h1>
          <p>See how {portfolio?.name ?? "your portfolio"} is divided among its stocks.</p>
        </div>
      </section>

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
            <div className="analytics-card__heading">
              <div><h2>Stock allocation</h2><p>Percentage of current invested market value</p></div>
              <strong>{formatCurrency(investedValue, portfolio.baseCurrency)}</strong>
            </div>
            <div className="allocation-layout">
              <AllocationDonut
                positions={allocatedPositions}
                total={investedValue}
              />
              <div className="allocation-legend">
                {allocatedPositions.map((position, index) => {
                  const value = position.marketValue ?? 0;
                  const percentage = (value / investedValue) * 100;
                  return (
                    <div className="allocation-row" key={`${position.ticker}-${position.currency}`}>
                      <span className="allocation-swatch" style={{ background: allocationColors[index % allocationColors.length] }} />
                      <div><strong>{position.ticker}</strong><span>{position.assetName}</span></div>
                      <span>{formatCurrency(value, position.currency)}</span>
                      <strong>{percentage.toFixed(1)}%</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            {allocatedPositions.length < positions.length && (
              <p className="analytics-note">Holdings without a current Yahoo price are excluded from the chart.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}

function AllocationDonut({
  positions,
  total,
}: {
  positions: Position[];
  total: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const activePosition =
    activeIndex === null ? null : positions[activeIndex];
  const activeValue = activePosition?.marketValue ?? 0;

  return (
    <div className="allocation-donut">
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Doughnut chart showing ${positions.length} stock allocations`}
      >
        <circle className="allocation-donut__track" cx="60" cy="60" r={radius} />
        {positions.map((position, index) => {
          const value = position.marketValue ?? 0;
          const percentage = value / total;
          const offset = accumulated;
          accumulated += percentage;
          const label = `${position.ticker}, ${formatCurrency(value, position.currency)}, ${(percentage * 100).toFixed(1)}%`;

          return (
            <circle
              className="allocation-donut__segment"
              key={`${position.ticker}-${position.currency}`}
              cx="60"
              cy="60"
              r={radius}
              pathLength={circumference}
              stroke={allocationColors[index % allocationColors.length]}
              strokeDasharray={`${percentage * circumference} ${circumference}`}
              strokeDashoffset={-offset * circumference}
              tabIndex={0}
              aria-label={label}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            >
              <title>{label}</title>
            </circle>
          );
        })}
      </svg>
      <div className="allocation-donut__center">
        <strong>{positions.length}</strong><span>positions</span>
      </div>
      {activePosition && (
        <div className="allocation-tooltip" role="tooltip">
          <strong>{activePosition.ticker}</strong>
          <span>{activePosition.assetName}</span>
          <span>{formatCurrency(activeValue, activePosition.currency)} · {((activeValue / total) * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function PerformancePage({
  portfolio,
  performance,
  loading,
  error,
  retry,
  news,
  newsLoading,
  newsError,
  retryNews,
}: {
  portfolio: Portfolio | null;
  performance: PortfolioPerformance | null;
  loading: boolean;
  error: string;
  retry: () => void;
  news: NewsArticle[];
  newsLoading: boolean;
  newsError: string;
  retryNews: () => void;
}) {
  const points = performance?.points ?? [];
  const firstValue = points[0]?.value ?? 0;
  const currentValue = points[points.length - 1]?.value ?? 0;
  const valueChange = currentValue - firstValue;
  const percentChange = firstValue ? (valueChange / firstValue) * 100 : 0;

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="status-dot" /> YAHOO FINANCE · 1 MONTH</div>
          <h1>Performance</h1>
          <p>Recent market value for {portfolio?.name ?? "the selected portfolio"}.</p>
        </div>
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
            <div className="analytics-card__heading">
              <div><h2>Portfolio value over time</h2><p>Daily closing value of current open positions</p></div>
              <span className={gainLossClass(valueChange)}>{formatPercent(percentChange)}</span>
            </div>
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
          <div className="news-grid">
            {news.map((article) => (
              <article className="news-card" key={article.url}>
                <NewsThumbnail article={article} />
                <div className="news-meta"><span>{article.publisher}</span>{article.publishedAt && <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>}</div>
                <h3>{article.headline}</h3>
                {article.description && <p>{article.description}</p>}
                <a href={article.url} target="_blank" rel="noreferrer">Read original article <ExternalLink size={13} /></a>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function NewsThumbnail({ article }: { article: NewsArticle }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="news-image">
      {article.imageUrl && !failed ? (
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="news-image__fallback" aria-hidden="true">
          <Newspaper size={24} />
        </div>
      )}
    </div>
  );
}

function PerformanceLineChart({
  points,
  currency,
}: {
  points: PortfolioPerformance["points"];
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const width = 900;
  const height = 280;
  const padding = 28;

  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;

  const coordinates = points.map((point, index) => ({
    x:
      padding +
      (index / Math.max(points.length - 1, 1)) *
        (width - padding * 2),
    y:
      padding +
      ((maximum - point.value) / range) *
        (height - padding * 2),
  }));

  const path = coordinates
    .map(
      (point, index) =>
        `${index ? "L" : "M"} ${point.x} ${point.y}`,
    )
    .join(" ");

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();

  const mouseX =
    ((event.clientX - bounds.left) / bounds.width) * width;

  let nearestIndex = 0;
  let smallestDistance = Math.abs(coordinates[0].x - mouseX);

  coordinates.forEach((coordinate, index) => {
    const distance = Math.abs(coordinate.x - mouseX);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearestIndex = index;
    }
  });

  setActiveIndex(nearestIndex);
}

  const activeCoordinate =
    activeIndex === null ? null : coordinates[activeIndex];

  const activePoint =
    activeIndex === null ? null : points[activeIndex];

  return (
    <div className="line-chart">
      <div className="line-chart__range">
        <span>{formatCurrency(maximum, currency)}</span>
        <span>{formatCurrency(minimum, currency)}</span>
      </div>

      <div className="line-chart__visual">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Line chart of daily portfolio market value over the last month"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient
              id="performance-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#4b9cd3"
                stopOpacity=".24"
              />
              <stop
                offset="100%"
                stopColor="#4b9cd3"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <path
            className="line-chart__area"
            d={`${path} L ${
              coordinates[coordinates.length - 1].x
            } ${height - padding} L ${coordinates[0].x} ${
              height - padding
            } Z`}
          />

          <path className="line-chart__line" d={path} />

          {activeCoordinate && (
            <>
              <line
                className="line-chart__guide"
                x1={activeCoordinate.x}
                x2={activeCoordinate.x}
                y1={padding}
                y2={height - padding}
              />

              <circle
                className="line-chart__active-dot"
                cx={activeCoordinate.x}
                cy={activeCoordinate.y}
                r="6"
              />
            </>
          )}
        </svg>

        {activeCoordinate && activePoint && (
          <div
            className="line-chart__tooltip"
            role="tooltip"
            style={{
              left: `${(activeCoordinate.x / width) * 100}%`,
              top: `${(activeCoordinate.y / height) * 100}%`,
            }}
          >
            <div className="line-chart__tooltip-heading">
              <strong>{formatDate(activePoint.date)}</strong>
              <span>
                Portfolio value:{" "}
                {formatCurrency(activePoint.value, currency)}
              </span>
            </div>

            <div className="line-chart__stock-prices">
            {activePoint.stockValues.map((stock) => (
              <div className="line-chart__stock-price" key={stock.ticker}>
                <div className="line-chart__stock-info">
                  <strong>{stock.ticker}</strong>

                  <span>
                    {stock.quantity} shares ×{" "}
                    {formatCurrency(stock.close, stock.currency)}
                  </span>
                </div>

                <strong>
                  {formatCurrency(stock.value, stock.currency)}
                </strong>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      <div className="line-chart__dates">
        <span>{formatDate(points[0].date)}</span>
        <span>{formatDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

function PageState({ icon, title, description, loading, error, actionLabel, onAction }: { icon?: React.ReactNode; title: string; description: string; loading?: boolean; error?: boolean; actionLabel?: string; onAction?: () => void }) {
  return <section className={`page-panel-state ${error ? "page-panel-state--error" : ""}`}>{loading ? <LoaderCircle className="spin" size={24} /> : icon ?? <AlertCircle size={24} />}<h2>{title}</h2><p>{description}</p>{actionLabel && onAction && <button className="secondary-button" onClick={onAction}>{actionLabel}</button>}</section>;
}

function formatNewsDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function PortfolioForm({ draft, setDraft, onSubmit, submitting, error, submitLabel, cancel }: {
  draft: PortfolioDraft;
  setDraft: (draft: PortfolioDraft) => void;
  onSubmit: (event: FormEvent) => void;
  submitting: boolean;
  error: string;
  submitLabel: string;
  cancel?: () => void;
}) {
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

function HoldingModal({ draft, setDraft, positions, stockOptions, stockOptionsError, availableCash, editing, submitting, error, close, onSubmit }: {
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
}) {
  const [tickerQuery, setTickerQuery] = useState(draft.ticker);
  const [tickerDropdownOpen, setTickerDropdownOpen] = useState(false);
  const filteredStockOptions = useMemo(() => {
  const query = tickerQuery.trim().toLowerCase();

  if (!query) {
    return stockOptions;
  }

  return stockOptions.filter(
    (stock) =>
      stock.ticker.toLowerCase().includes(query) ||
      stock.name.toLowerCase().includes(query),
  );
}, [stockOptions, tickerQuery]);

async function searchTicker() {
  const ticker = tickerQuery.trim().toUpperCase();

  if (!ticker) return;

  const topStock = stockOptions.find(
    (stock) => stock.ticker.toUpperCase() === ticker,
  );

  try {
    const stock = topStock ?? (await api.getStockDetails(ticker));

    setTickerQuery(stock.ticker);

    setDraft({
      ...draft,
      ticker: stock.ticker,
      assetName: stock.name,
      assetType: "Stock",
      pricePerUnit: roundPrice(stock.currentPrice),
      currency: "USD",
    });

    setTickerDropdownOpen(false);
  } catch (error) {
    console.error("Unable to find ticker:", error);
    window.alert(`No stock information was found for ${ticker}.`);
  }
}
  const activePosition = positions.find(
    (position) =>
      position.ticker === draft.ticker && position.currency === draft.currency,
  );
  const sellQuantityMax =
    draft.tradeType === "SELL" ? activePosition?.quantityOwned : undefined;
  const modalTitle = editing
    ? "Edit holding"
    : draft.tradeType === "SELL"
      ? "Sell holding"
      : "Add a holding";
  const submitLabel = editing
    ? "Save changes"
    : draft.tradeType === "SELL"
      ? "Record sale"
      : "Add holding";
  const estimatedValue =
    draft.tradeType === "SELL"
      ? Math.max(draft.quantity * draft.pricePerUnit - draft.feeAmount, 0)
      : draft.quantity * draft.pricePerUnit + draft.feeAmount;
  const headerValue = draft.tradeType === "SELL"
    ? (activePosition?.quantityOwned ?? 0).toLocaleString(undefined, {
        maximumFractionDigits: 6,
      })
    : formatCurrency(availableCash, draft.currency);

  function selectTicker(ticker: string) {
    const selectedStock = stockOptions.find(
      (stock) => stock.ticker === ticker,
    );

    if (!selectedStock) return;

    setTickerQuery(selectedStock.ticker);

    setDraft({
      ...draft,
      ticker: selectedStock.ticker,
      assetName: selectedStock.name,
      assetType: "Stock",
      pricePerUnit: selectedStock.currentPrice,
    });

    setTickerDropdownOpen(false);
  }

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

              <div
                className="ticker-combobox"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setTickerDropdownOpen(false);
                  }
                }}
              >
                <div className="ticker-search">
                  <Search size={17} />

                  <input
                    id="ticker-search"
                    type="text"
                    value={tickerQuery}
                    placeholder={
                      stockOptions.length
                        ? "Search ticker or company"
                        : "Loading tickers..."
                    }
                    autoComplete="off"
                    required
                    role="combobox"
                    aria-expanded={tickerDropdownOpen}
                    aria-controls="ticker-options"
                    onClick={() => setTickerDropdownOpen(true)}
                    onFocus={() => setTickerDropdownOpen(true)}
                    onChange={(event) => {
                      const value = event.target.value;

                      setTickerQuery(value);
                      setTickerDropdownOpen(true);

                      setDraft({
                        ...draft,
                        ticker: "",
                        assetName: "",
                        pricePerUnit: 0,
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void searchTicker();
                      }

                      if (event.key === "Escape") {
                        setTickerDropdownOpen(false);
                      }
                    }}
                  />

                  <ChevronDown
                    className={tickerDropdownOpen ? "ticker-chevron--open" : ""}
                    size={17}
                  />
                </div>

                {tickerDropdownOpen && (
                  <div
                    className="ticker-options"
                    id="ticker-options"
                    role="listbox"
                  >
                    {filteredStockOptions.length > 0 ? (
                      filteredStockOptions.map((stock) => (
                        <button
                          key={stock.ticker}
                          type="button"
                          className="ticker-option"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectTicker(stock.ticker);
                          }}
                        >
                          <strong>{stock.ticker}</strong>
                          <span>{stock.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="ticker-options__empty">
                        No matching stocks found
                      </div>
                    )}
                  </div>
                )}
              </div>
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

function CompanyLogo({ ticker, logoUrl, assetType }: { ticker: string; logoUrl: string | null; assetType: AssetType }) {
  const [failed, setFailed] = useState(false);
  const initials = ticker.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";

  return (
    <div className={`asset-logo asset-badge--${assetType.toLowerCase()}`} aria-hidden="true">
      {logoUrl && !failed ? (
        <img src={logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : initials}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span>{label}</span>{children}</label>;
}

function FormError({ message }: { message: string }) {
  return <div className="form-error"><AlertCircle size={16} /><span>{message}</span></div>;
}

function TransactionHistoryModal({
  target,
  holdings,
  close,
}: {
  target: TransactionHistoryTarget;
  holdings: Holding[];
  close: () => void;
}) {
  const allTransactions = target === "all";
  const transactions = holdings
    .filter((holding) => {
      if (allTransactions) return true;
      return holding.ticker === target.ticker && holding.currency === target.currency;
    })
    .sort(
      (first, second) =>
        new Date(second.tradedAt).getTime() - new Date(first.tradedAt).getTime(),
    );
  const title = allTransactions ? "All transactions" : target.ticker;
  const description = allTransactions
    ? `${transactions.length} holding transaction${transactions.length === 1 ? "" : "s"}`
    : `${target.assetName} • ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  return (
    <div className="modal-backdrop">
      <section className="modal transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-history-title">
        <header className="modal-header">
          <div>
            <span className="modal-kicker">TRANSACTION HISTORY</span>
            <h2 id="transaction-history-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button onClick={close} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="transaction-list">
          {transactions.map((transaction) => {
            const grossValue = transaction.quantity * transaction.pricePerUnit;
            const totalValue =
              transaction.tradeType === "SELL"
                ? Math.max(grossValue - transaction.feeAmount, 0)
                : grossValue + transaction.feeAmount;

            return (
              <article className="transaction-row" key={transaction.id}>
                <div>
                  <span className={`trade-pill trade-pill--${transaction.tradeType.toLowerCase()}`}>
                    {transaction.tradeType === "BUY" ? "Buy" : "Sell"}
                  </span>
                  <strong>{formatCurrency(totalValue, transaction.currency)}</strong>
                  {allTransactions && (
                    <span className="transaction-asset">
                      {transaction.ticker} • {transaction.assetName}
                    </span>
                  )}
                  <time dateTime={transaction.tradedAt}>{formatDateTime(transaction.tradedAt)}</time>
                </div>
                <dl>
                  <div><dt>Quantity</dt><dd>{transaction.quantity.toLocaleString()}</dd></div>
                  <div><dt>Price</dt><dd>{formatCurrency(transaction.pricePerUnit, transaction.currency)}</dd></div>
                  <div><dt>Fee</dt><dd>{formatCurrency(transaction.feeAmount, transaction.currency)}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ConfirmModal({ title, description, cancelLabel, confirmLabel, submitting, error, cancel, confirm }: {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  submitting: boolean;
  error: string;
  cancel: () => void;
  confirm: () => void;
}) {
  return <div className="modal-backdrop"><section className="confirm-modal" role="alertdialog" aria-modal="true"><div className="delete-icon"><Trash2 size={22} /></div><h2>{title}</h2><p>{description}</p>{error && <FormError message={error} />}<div><button className="secondary-button" onClick={cancel} disabled={submitting}>{cancelLabel}</button><button className="danger-button" onClick={confirm} disabled={submitting}>{submitting && <LoaderCircle className="spin" size={14} />}{confirmLabel}</button></div></section></div>;
}
