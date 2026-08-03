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

interface ApiErrorBody {
  error?: string;
}

interface PortfolioResponse {
  id: number;
  name: string;
  base_currency: string;
  balance: number | string;
  created_at?: string;
  updated_at?: string;
}

interface HoldingResponse {
  id: number;
  portfolio_id: number;
  ticker: string;
  asset_name: string;
  asset_type: string;
  currency: string;
  trade_type: TradeType;
  quantity: number | string;
  price_per_unit: number | string;
  fee_amount: number | string;
  traded_at: string;
}

interface PositionResponse {
  ticker: string;
  asset_name: string;
  asset_type: string;
  logo_url?: string | null;
  currency: string;
  quantity_owned: number | string;
  average_cost: number | string;
  cost_basis: number | string;
  current_price: number | string | null;
  market_value: number | string | null;
  unrealized_gain: number | string | null;
  unrealized_gain_percent: number | string | null;
}

interface StockOptionResponse {
  ticker: string;
  name?: string;
  currentPrice?: number | string;
}

interface StockDetailsResponse {
  ticker: string;
  name: string;
  current_price: number | string;
}

interface PerformanceResponse {
  currency: string;
  period: string;
  points: Array<{
    date: string;
    value: number | string;
    stock_values: Array<{
      ticker: string;
      asset_name: string;
      currency: string;
      quantity: number | string;
      close: number | string;
      value: number | string;
    }>;
  }>;
}

interface NewsArticleResponse {
  headline: string;
  publisher: string;
  published_at: string | null;
  description: string | null;
  image_url: string | null;
  url: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Unable to reach the API. Make sure Docker Compose is running.",
      0,
    );
  }

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      body.error || `The request failed with status ${response.status}.`,
      response.status,
    );
  }

  return body as T;
}

function mapPortfolio(portfolio: PortfolioResponse): Portfolio {
  return {
    id: portfolio.id,
    name: portfolio.name,
    baseCurrency: portfolio.base_currency,
    balance: Number(portfolio.balance),
    createdAt: portfolio.created_at,
    updatedAt: portfolio.updated_at,
  };
}

function normalizeAssetType(value: string): AssetType {
  const normalized = value.toLowerCase();
  const knownTypes: Record<string, AssetType> = {
    stock: "Stock",
    etf: "ETF",
    bond: "Bond",
    crypto: "Crypto",
    cash: "Cash",
  };
  return knownTypes[normalized] ?? "Stock";
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace(" ", "T").slice(0, 16);
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function mapHolding(holding: HoldingResponse): Holding {
  return {
    id: holding.id,
    portfolioId: holding.portfolio_id,
    ticker: holding.ticker,
    assetName: holding.asset_name,
    assetType: normalizeAssetType(holding.asset_type),
    currency: holding.currency,
    tradeType: holding.trade_type,
    quantity: Number(holding.quantity),
    pricePerUnit: Number(holding.price_per_unit),
    feeAmount: Number(holding.fee_amount),
    tradedAt: toLocalDateTime(holding.traded_at),
  };
}

function nullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}

function mapPosition(position: PositionResponse): Position {
  return {
    ticker: position.ticker,
    assetName: position.asset_name,
    assetType: normalizeAssetType(position.asset_type),
    logoUrl: position.logo_url ?? null,
    currency: position.currency,
    quantityOwned: Number(position.quantity_owned),
    averageCost: Number(position.average_cost),
    costBasis: Number(position.cost_basis),
    currentPrice: nullableNumber(position.current_price),
    marketValue: nullableNumber(position.market_value),
    unrealizedGain: nullableNumber(position.unrealized_gain),
    unrealizedGainPercent: nullableNumber(position.unrealized_gain_percent),
  };
}

function mapStockOption(stock: StockOptionResponse): StockOption {
  return {
    ticker: stock.ticker,
    name: stock.name || stock.ticker,
    currentPrice: Number(stock.currentPrice ?? 0),
  };
}

function holdingPayload(holding: HoldingDraft) {
  const tradedAt = holding.tradedAt.replace("T", " ");
  return {
    portfolio_id: holding.portfolioId,
    ticker: holding.ticker.trim().toUpperCase(),
    asset_name: holding.assetName.trim(),
    asset_type: holding.assetType.toUpperCase(),
    currency: holding.currency.trim().toUpperCase(),
    trade_type: holding.tradeType,
    quantity: holding.quantity,
    price_per_unit: holding.pricePerUnit,
    fee_amount: holding.feeAmount,
    traded_at: tradedAt.length === 16 ? `${tradedAt}:00` : tradedAt,
  };
}

export const api = {
  async listMostActiveStocks() {
    const stocks = await request<StockOptionResponse[]>(
      "/api/stocks/most-active",
    );
    return stocks.map(mapStockOption);
  },

  async getStockDetails(ticker: string): Promise<StockOption> {
  const stock = await request<StockDetailsResponse>(
    `/api/stocks/${encodeURIComponent(ticker.trim().toUpperCase())}/price`,
  );

  return {
    ticker: stock.ticker,
    name: stock.name,
    currentPrice: Number(stock.current_price),
  };
},

  async listMarketNews(): Promise<NewsArticle[]> {
    const articles = await request<NewsArticleResponse[]>("/api/stocks/news");
    return articles.map((article) => ({
      headline: article.headline,
      publisher: article.publisher,
      publishedAt: article.published_at,
      description: article.description,
      imageUrl: article.image_url,
      url: article.url,
    }));
  },

  async listPortfolios() {
    const portfolios = await request<PortfolioResponse[]>("/api/portfolios");
    return portfolios.map(mapPortfolio);
  },

  async getPortfolio(id: number) {
    const portfolio = await request<PortfolioResponse>(`/api/portfolios/${id}`);
    return mapPortfolio(portfolio);
  },

  async createPortfolio(draft: PortfolioDraft) {
    return request<PortfolioResponse>("/api/portfolios", {
      method: "POST",
      body: JSON.stringify({
        name: draft.name.trim(),
        base_currency: draft.baseCurrency.trim().toUpperCase(),
        balance: draft.balance,
      }),
    });
  },

  async updatePortfolio(id: number, draft: PortfolioDraft) {
    return request<PortfolioResponse>(`/api/portfolios/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: draft.name.trim(),
        base_currency: draft.baseCurrency.trim().toUpperCase(),
        balance: draft.balance,
      }),
    });
  },

  async deletePortfolio(id: number) {
    return request<{ message: string }>(`/api/portfolios/${id}`, {
      method: "DELETE",
    });
  },

  async listHoldings(portfolioId: number) {
    const holdings = await request<HoldingResponse[]>(
      `/api/holdings?portfolio_id=${portfolioId}`,
    );
    return holdings.map(mapHolding);
  },

  async listPositions(portfolioId: number) {
    const positions = await request<PositionResponse[]>(
      `/api/portfolios/${portfolioId}/positions`,
    );
    return positions.map(mapPosition);
  },

async getPortfolioPerformance(
  portfolioId: number,
): Promise<PortfolioPerformance> {
  const performance = await request<PerformanceResponse>(
    `/api/portfolios/${portfolioId}/performance`,
  );

  return {
    currency: performance.currency,
    period: performance.period,
    points: performance.points.map((point) => ({
      date: point.date,
      value: Number(point.value),
      stockValues: point.stock_values.map((stock) => ({
      ticker: stock.ticker,
      assetName: stock.asset_name,
      currency: stock.currency,
      quantity: Number(stock.quantity),
      close: Number(stock.close),
      value: Number(stock.value),
    })),
  })),
  };
},

  async getHolding(id: number) {
    const holding = await request<HoldingResponse>(`/api/holdings/${id}`);
    return mapHolding(holding);
  },

  async createHolding(holding: HoldingDraft) {
    return request<{ id: number; message: string }>("/api/holdings", {
      method: "POST",
      body: JSON.stringify(holdingPayload(holding)),
    });
  },

  async updateHolding(id: number, holding: HoldingDraft) {
    return request<{ id: number; message: string }>(`/api/holdings/${id}`, {
      method: "PUT",
      body: JSON.stringify(holdingPayload(holding)),
    });
  },

  async deleteHolding(id: number) {
    return request<{ message: string }>(`/api/holdings/${id}`, {
      method: "DELETE",
    });
  },
};
