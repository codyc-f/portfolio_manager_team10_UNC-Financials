import { AlertCircle, Check, LoaderCircle, RefreshCw, TrendingUp } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Page, Theme, TransactionHistoryTarget } from "./app/types";
import { ConfirmModal } from "./components/modals/ConfirmModal";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { emptyPortfolio } from "./constants/portfolio";
import { AllocationPage } from "./features/allocation/AllocationPage";
import { HoldingModal } from "./features/holdings/HoldingModal";
import { HoldingsPage } from "./features/holdings/HoldingsPage";
import { TransactionHistoryModal } from "./features/holdings/TransactionHistoryModal";
import { PerformancePage } from "./features/performance/PerformancePage";
import { PortfolioForm } from "./features/portfolios/PortfolioForm";
import { PortfolioModal } from "./features/portfolios/PortfolioModal";
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
import { createEmptyHolding } from "./utils/drafts";
import { errorMessage } from "./utils/errors";
import { roundPrice } from "./utils/formatters";

function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem("unc-financials-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
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
  const [, setTradeFilter] = useState<TradeType | "All">("All");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [activePage, setActivePage] = useState<Page>("holdings");
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState("");
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");

  const [holdingFormOpen, setHoldingFormOpen] = useState(false);
  const [holdingDraft, setHoldingDraft] = useState<HoldingDraft>(createEmptyHolding(1));
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);
  const [transactionHistoryTarget, setTransactionHistoryTarget] = useState<TransactionHistoryTarget | null>(null);

  const [portfolioFormOpen, setPortfolioFormOpen] = useState(false);
  const [portfolioDraft, setPortfolioDraft] = useState<PortfolioDraft>(emptyPortfolio);
  const [editingPortfolioId, setEditingPortfolioId] = useState<number | null>(null);
  const [deletingPortfolio, setDeletingPortfolio] = useState<Portfolio | null>(null);

  const selectedPortfolio = portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null;

  async function refreshPortfolios(preferredId?: number) {
    setConnectionError("");
    try {
      const nextPortfolios = await api.listPortfolios();
      setPortfolios(nextPortfolios);
      setSelectedPortfolioId((current) => {
        if (preferredId && nextPortfolios.some((portfolio) => portfolio.id === preferredId)) return preferredId;
        if (current && nextPortfolios.some((portfolio) => portfolio.id === current)) return current;
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
      const [nextHoldings, nextPositions] = await Promise.all([api.listHoldings(portfolioId), api.listPositions(portfolioId)]);
      setHoldings(nextHoldings);
      setPositions(nextPositions);
      setPositionsLastUpdated(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }));
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
      setPositionsLastUpdated(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }));
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
    const intervalId = window.setInterval(() => { void refreshPositions(selectedPortfolioId); }, 30_000);
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
      const matchesQuery = !normalizedQuery || `${position.ticker} ${position.assetName} ${position.assetType}`.toLowerCase().includes(normalizedQuery);
      return matchesQuery && (assetFilter === "All" || position.assetType === assetFilter);
    });
  }, [assetFilter, positions, query]);

  const invested = useMemo(() => positions.reduce((sum, position) => sum + position.costBasis, 0), [positions]);

  function openCreateHolding() {
    if (!selectedPortfolioId) return;
    setEditingHoldingId(null);
    setMutationError("");
    setHoldingDraft(createEmptyHolding(selectedPortfolioId, selectedPortfolio?.baseCurrency ?? "USD"));
    setHoldingFormOpen(true);
  }

  function openEditHolding(holding: Holding) {
    const { id, ...draft } = holding;
    setEditingHoldingId(id);
    setHoldingDraft({ ...draft, currency: selectedPortfolio?.baseCurrency ?? draft.currency });
    setMutationError("");
    setHoldingFormOpen(true);
  }

  function openSellPosition(position: Position) {
    if (!selectedPortfolioId) return;
    setEditingHoldingId(null);
    setMutationError("");
    setHoldingDraft({ portfolioId: selectedPortfolioId, ticker: position.ticker, assetName: position.assetName, assetType: position.assetType, currency: selectedPortfolio?.baseCurrency ?? position.currency, tradeType: "SELL", quantity: 0, pricePerUnit: roundPrice(position.currentPrice ?? position.averageCost), feeAmount: 0, tradedAt: createEmptyHolding(selectedPortfolioId).tradedAt });
    setHoldingFormOpen(true);
  }

  async function saveHolding(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMutationError("");
    const normalizedHoldingDraft = { ...holdingDraft, pricePerUnit: roundPrice(holdingDraft.pricePerUnit) };
    try {
      if (editingHoldingId === null) {
        await api.createHolding(normalizedHoldingDraft);
        setToast(`${normalizedHoldingDraft.tradeType === "BUY" ? "Purchased" : "Sold"} ${normalizedHoldingDraft.ticker.toUpperCase()} successfully`);
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
    setPortfolioDraft({ name: selectedPortfolio.name, baseCurrency: selectedPortfolio.baseCurrency, balance: selectedPortfolio.balance });
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
    return <div className="app-state"><LoaderCircle className="spin" size={28} /><h1>Connecting to your portfolio</h1><p>Loading data from UNC Financials…</p></div>;
  }

  if (connectionError && portfolios.length === 0) {
    return <div className="app-state app-state--error"><AlertCircle size={30} /><h1>We couldn’t connect</h1><p>{connectionError}</p><button className="primary-button" onClick={() => { setInitialLoading(true); void refreshPortfolios(); }}><RefreshCw size={16} /> Try again</button></div>;
  }

  if (portfolios.length === 0) {
    return <div className="onboarding-shell"><div className="onboarding-brand"><div className="brand-mark"><TrendingUp size={21} /></div><strong>UNC Financials</strong></div><section className="onboarding-card"><span className="modal-kicker">WELCOME TO UNC FINANCIALS</span><h1>Create your first portfolio</h1><p>A portfolio groups your holding transactions and determines the currency used in your dashboard.</p><PortfolioForm draft={portfolioDraft} setDraft={setPortfolioDraft} onSubmit={savePortfolio} submitting={submitting} error={mutationError} submitLabel="Create portfolio" /></section></div>;
  }

  return (
    <div className="app-shell">
      <Sidebar open={mobileNavOpen} close={() => setMobileNavOpen(false)} activePage={activePage} onNavigate={(page) => { setActivePage(page); setMobileNavOpen(false); }} />
      {mobileNavOpen && <button className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      <main className="workspace">
        <Topbar portfolios={portfolios} selectedPortfolioId={selectedPortfolioId} selectedPortfolio={selectedPortfolio} theme={theme} openNavigation={() => setMobileNavOpen(true)} selectPortfolio={setSelectedPortfolioId} editPortfolio={openEditPortfolio} createPortfolio={openCreatePortfolio} deletePortfolio={setDeletingPortfolio} toggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")} />
        <div className="page">
          {connectionError && activePage === "holdings" && <div className="inline-alert"><AlertCircle size={17} /><span>{connectionError}</span>{selectedPortfolioId && <button onClick={() => void refreshHoldings(selectedPortfolioId)}>Try again</button>}</div>}
          {activePage === "holdings" && <HoldingsPage portfolio={selectedPortfolio} holdings={holdings} positions={positions} visiblePositions={visiblePositions} positionsLastUpdated={positionsLastUpdated} loading={holdingsLoading} query={query} assetFilter={assetFilter} invested={invested} setQuery={setQuery} setAssetFilter={setAssetFilter} clearFilters={() => { setQuery(""); setAssetFilter("All"); setTradeFilter("All"); }} createHolding={openCreateHolding} sellPosition={openSellPosition} openPositionTransactions={setTransactionHistoryTarget} openAllTransactions={() => setTransactionHistoryTarget("all")} navigate={setActivePage} />}
          {activePage === "allocation" && <AllocationPage portfolio={selectedPortfolio} positions={positions} loading={holdingsLoading} error={connectionError} retry={() => { if (selectedPortfolioId !== null) void refreshHoldings(selectedPortfolioId); }} />}
          {activePage === "performance" && <PerformancePage portfolio={selectedPortfolio} performance={performance} loading={performanceLoading} error={performanceError} retry={() => { if (selectedPortfolioId !== null) void refreshPerformance(selectedPortfolioId); }} news={news} newsLoading={newsLoading} newsError={newsError} retryNews={() => void refreshNews()} />}
        </div>
      </main>

      {holdingFormOpen && <HoldingModal draft={holdingDraft} setDraft={setHoldingDraft} positions={positions} stockOptions={stockOptions} stockOptionsError={stockOptionsError} availableCash={selectedPortfolio?.balance ?? 0} editing={editingHoldingId !== null} submitting={submitting} error={mutationError} close={() => setHoldingFormOpen(false)} onSubmit={saveHolding} />}
      {transactionHistoryTarget && <TransactionHistoryModal target={transactionHistoryTarget} holdings={holdings} close={() => setTransactionHistoryTarget(null)} />}
      {portfolioFormOpen && <PortfolioModal draft={portfolioDraft} setDraft={setPortfolioDraft} onSubmit={savePortfolio} submitting={submitting} error={mutationError} editing={editingPortfolioId !== null} close={() => setPortfolioFormOpen(false)} />}
      {deletingHolding && <ConfirmModal title={`Remove ${deletingHolding.ticker}?`} description={`This removes the transaction for ${deletingHolding.assetName}. This action cannot be undone.`} cancelLabel="Keep holding" confirmLabel="Remove transaction" submitting={submitting} error={mutationError} cancel={() => { setDeletingHolding(null); setMutationError(""); }} confirm={() => void deleteHolding()} />}
      {deletingPortfolio && <ConfirmModal title={`Delete ${deletingPortfolio.name}?`} description="A portfolio can only be deleted after all of its positions have been fully sold." cancelLabel="Keep portfolio" confirmLabel="Delete portfolio" submitting={submitting} error={mutationError} cancel={() => { setDeletingPortfolio(null); setMutationError(""); }} confirm={() => void deletePortfolio()} />}
      {toast && <div className="toast" role="status"><span><Check size={14} /></span>{toast}</div>}
    </div>
  );
}
