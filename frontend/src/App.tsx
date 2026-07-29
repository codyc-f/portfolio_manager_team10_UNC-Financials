import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
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
  Position,
  Portfolio,
  PortfolioDraft,
  StockOption,
  TradeType,
} from "./types";

const assetTypes: AssetType[] = ["Stock", "ETF", "Bond", "Crypto", "Cash"];
const emptyPortfolio: PortfolioDraft = {
  name: "",
  baseCurrency: "USD",
  balance: 0,
};

function createEmptyHolding(portfolioId: number): HoldingDraft {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return {
    portfolioId,
    ticker: "",
    assetName: "",
    assetType: "Stock",
    currency: "USD",
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

export default function App() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(
    null,
  );
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
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

  const [holdingFormOpen, setHoldingFormOpen] = useState(false);
  const [holdingDraft, setHoldingDraft] = useState<HoldingDraft>(
    createEmptyHolding(1),
  );
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);

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
    } catch (error) {
      setConnectionError(errorMessage(error));
      setHoldings([]);
      setPositions([]);
    } finally {
      setHoldingsLoading(false);
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

  useEffect(() => {
    void refreshPortfolios();
    void refreshStockOptions();
  }, []);

  useEffect(() => {
    if (selectedPortfolioId === null) {
      setHoldings([]);
      setPositions([]);
      return;
    }
    setQuery("");
    setAssetFilter("All");
    setTradeFilter("All");
    void refreshHoldings(selectedPortfolioId);
  }, [selectedPortfolioId]);

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
      createEmptyHolding(selectedPortfolioId),
    );
    setHoldingFormOpen(true);
  }

  function openEditHolding(holding: Holding) {
    const { id, ...draft } = holding;
    setEditingHoldingId(id);
    setHoldingDraft(draft);
    setMutationError("");
    setHoldingFormOpen(true);
  }

  async function saveHolding(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMutationError("");
    try {
      if (editingHoldingId === null) {
        await api.createHolding(holdingDraft);
        setToast(`${holdingDraft.ticker.toUpperCase()} was added`);
      } else {
        await api.updateHolding(editingHoldingId, holdingDraft);
        setToast(`${holdingDraft.ticker.toUpperCase()} was updated`);
      }
      setHoldingFormOpen(false);
      await refreshHoldings(holdingDraft.portfolioId);
      await refreshPortfolios(holdingDraft.portfolioId);
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
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <button className="help-button">Help &amp; support</button>
          </div>
        </header>

        <div className="page">
          {connectionError && (
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
            <article className="metric-card metric-card--future">
              <div className="metric-card__topline">
                <span>Portfolio return</span>
                <span className="coming-soon">COMING SOON</span>
              </div>
              <div className="future-value">—</div>
              <small>Market data integration planned</small>
            </article>
          </section>

          <section className="holdings-card" aria-busy={holdingsLoading}>
            <div className="card-heading">
              <div>
                <h2>All holdings</h2>
                <p>{visiblePositions.length} active positions shown</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePositions.map((position) => (
                        <tr key={`${position.ticker}-${position.currency}`}>
                          <td>
                            <div className="asset-cell">
                              <span className={`asset-badge asset-badge--${position.assetType.toLowerCase()}`}>
                                {position.ticker.slice(0, 2)}
                              </span>
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
                  <button className="text-button" disabled>View activity history <ArrowRight size={15} /></button>
                </div>
              </>
            )}
          </section>

          <section className="future-panels">
            <FuturePanel icon={<BarChart3 size={19} />} title="Performance analytics" description="Track returns, benchmark comparisons, and portfolio growth over time." chart />
            <FuturePanel icon={<PieChart size={19} />} title="Asset allocation" description="Understand diversification by asset class, sector, and currency." />
          </section>
        </div>
      </main>

      {holdingFormOpen && (
        <HoldingModal
          draft={holdingDraft}
          setDraft={setHoldingDraft}
          stockOptions={stockOptions}
          stockOptionsError={stockOptionsError}
          editing={editingHoldingId !== null}
          submitting={submitting}
          error={mutationError}
          close={() => setHoldingFormOpen(false)}
          onSubmit={saveHolding}
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
          description="A portfolio can only be deleted after all of its holding transactions have been removed."
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

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><TrendingUp size={20} strokeWidth={2.4} /></div>
        <div><strong>UNC Financials</strong><span>Portfolio manager</span></div>
        <button className="mobile-close" onClick={close} aria-label="Close navigation"><X size={20} /></button>
      </div>
      <nav className="main-nav" aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        <NavItem icon={<LayoutDashboard size={19} />} label="Overview" future />
        <NavItem icon={<BriefcaseBusiness size={19} />} label="Holdings" active />
        <NavItem icon={<BarChart3 size={19} />} label="Performance" future />
        <NavItem icon={<PieChart size={19} />} label="Allocation" future />
        <p className="nav-label nav-label--secondary">Manage</p>
        <NavItem icon={<ArrowDownToLine size={19} />} label="Activity" future />
        <NavItem icon={<Settings size={19} />} label="Settings" future />
      </nav>
      <div className="sidebar-footer">
        <div className="secure-note"><ShieldCheck size={18} /><div><strong>Database connected</strong><span>Changes save to MySQL</span></div></div>
        <div className="profile"><span className="avatar">NT</span><div><strong>Nifty Team</strong><span>Portfolio admin</span></div><MoreHorizontal size={18} /></div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, future }: { icon: React.ReactNode; label: string; active?: boolean; future?: boolean }) {
  return <button className={`nav-item ${active ? "nav-item--active" : ""} ${future ? "nav-item--future" : ""}`}>{icon}<span>{label}</span>{future && <small>Soon</small>}</button>;
}

function MetricCard({ icon, label, value, note, className }: { icon: React.ReactNode; label: string; value: string; note: string; className?: string }) {
  return <article className={`metric-card ${className ?? ""}`}><div className="metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function FilterSelect({ label, value, options, allLabel, onChange }: { label: string; value: string; options: string[]; allLabel: string; onChange: (value: string) => void }) {
  return <label className="select-field"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option === "All" ? allLabel : option === "BUY" ? "Buys" : option === "SELL" ? "Sells" : option}</option>)}</select><ChevronDown size={15} /></label>;
}

function FuturePanel({ icon, title, description, chart }: { icon: React.ReactNode; title: string; description: string; chart?: boolean }) {
  return <article><div className="future-panel-icon">{icon}</div><div><span className="coming-soon">COMING SOON</span><h3>{title}</h3><p>{description}</p></div>{chart ? <div className="chart-skeleton" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div> : <div className="donut-skeleton" aria-hidden="true" />}</article>;
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

function HoldingModal({ draft, setDraft, stockOptions, stockOptionsError, editing, submitting, error, close, onSubmit }: {
  draft: HoldingDraft;
  setDraft: (draft: HoldingDraft) => void;
  stockOptions: StockOption[];
  stockOptionsError: string;
  editing: boolean;
  submitting: boolean;
  error: string;
  close: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  function selectTicker(ticker: string) {
    const selectedStock = stockOptions.find((stock) => stock.ticker === ticker);
    if (!selectedStock) {
      setDraft({ ...draft, ticker });
      return;
    }

    setDraft({
      ...draft,
      ticker: selectedStock.ticker,
      assetName: selectedStock.name,
      assetType: "Stock",
      pricePerUnit: selectedStock.currentPrice,
      currency: "USD",
    });
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="holding-title">
        <header className="modal-header"><div><span className="modal-kicker">{editing ? "UPDATE TRANSACTION" : "NEW TRANSACTION"}</span><h2 id="holding-title">{editing ? "Edit holding" : "Add a holding"}</h2><p>Record the trade details for your portfolio.</p></div><button onClick={close} aria-label="Close"><X size={20} /></button></header>
        <form onSubmit={onSubmit}>
          {error && <FormError message={error} />}
          {stockOptionsError && <FormError message={stockOptionsError} />}
          <div className="form-grid">
            <Field label="Ticker symbol"><select value={draft.ticker} onChange={(event) => selectTicker(event.target.value)} required autoFocus><option value="" disabled>{stockOptions.length ? "Select a ticker" : "Loading tickers..."}</option>{stockOptions.map((stock) => <option key={stock.ticker} value={stock.ticker}>{stock.ticker} - {stock.name}</option>)}</select></Field>
            <Field label="Asset name"><input value={draft.assetName} onChange={(event) => setDraft({ ...draft, assetName: event.target.value })} placeholder="e.g. Apple Inc." maxLength={255} required /></Field>
            <Field label="Asset type"><select value={draft.assetType} onChange={(event) => setDraft({ ...draft, assetType: event.target.value as AssetType })}>{assetTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
            <Field label="Trade type"><div className="segmented-control">{(["BUY", "SELL"] as TradeType[]).map((type) => <button key={type} type="button" className={draft.tradeType === type ? "selected" : ""} onClick={() => setDraft({ ...draft, tradeType: type })}>{draft.tradeType === type && <Check size={14} />}{type === "BUY" ? "Buy" : "Sell"}</button>)}</div></Field>
            <Field label="Quantity"><input type="number" value={draft.quantity || ""} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} min="0.000001" step="any" placeholder="0.00" required /></Field>
            <Field label="Price per unit"><div className="input-prefix"><span>$</span><input type="number" value={draft.pricePerUnit || ""} onChange={(event) => setDraft({ ...draft, pricePerUnit: Number(event.target.value) })} min="0" step="0.01" placeholder="0.00" required /></div></Field>
            <Field label="Currency"><input value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} maxLength={3} pattern="[A-Za-z]{3}" required /></Field>
            <Field label="Trading fee"><div className="input-prefix"><span>$</span><input type="number" value={draft.feeAmount || ""} onChange={(event) => setDraft({ ...draft, feeAmount: Number(event.target.value) })} min="0" step="0.01" placeholder="0.00" /></div></Field>
            <Field label="Trade date & time" className="form-span"><input type="datetime-local" value={draft.tradedAt} onChange={(event) => setDraft({ ...draft, tradedAt: event.target.value })} required /></Field>
          </div>
          <div className="trade-summary"><span>Estimated transaction value</span><strong>{formatCurrency(draft.quantity * draft.pricePerUnit + draft.feeAmount, draft.currency || "USD")}</strong></div>
          <footer className="modal-footer"><button className="secondary-button" type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary-button" disabled={submitting}>{submitting && <LoaderCircle className="spin" size={15} />}{editing ? "Save changes" : "Add holding"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span>{label}</span>{children}</label>;
}

function FormError({ message }: { message: string }) {
  return <div className="form-error"><AlertCircle size={16} /><span>{message}</span></div>;
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
