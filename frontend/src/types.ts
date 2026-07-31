export type AssetType = "Stock" | "ETF" | "Bond" | "Crypto" | "Cash";
export type TradeType = "BUY" | "SELL";

export interface Portfolio {
  id: number;
  name: string;
  baseCurrency: string;
  balance: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortfolioDraft {
  name: string;
  baseCurrency: string;
  balance: number;
}

export interface Holding {
  id: number;
  portfolioId: number;
  ticker: string;
  assetName: string;
  assetType: AssetType;
  currency: string;
  tradeType: TradeType;
  quantity: number;
  pricePerUnit: number;
  feeAmount: number;
  tradedAt: string;
}

export type HoldingDraft = Omit<Holding, "id">;

export interface Position {
  ticker: string;
  assetName: string;
  assetType: AssetType;
  currency: string;
  quantityOwned: number;
  averageCost: number;
  costBasis: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedGain: number | null;
  unrealizedGainPercent: number | null;
}

export interface StockOption {
  ticker: string;
  name: string;
  currentPrice: number;
}

export interface PerformancePoint {
  date: string;
  value: number;
  stockValues: PerformanceStockValue[];
}

export interface PortfolioPerformance {
  currency: string;
  period: string;
  points: PerformancePoint[];
}

export interface NewsArticle {
  headline: string;
  publisher: string;
  publishedAt: string | null;
  description: string | null;
  imageUrl: string | null;
  url: string;
}

export interface PerformanceStockPrice {
  ticker: string;
  assetName: string;
  currency: string;
  close: number;
}

export interface PerformanceStockValue {
  ticker: string;
  assetName: string;
  currency: string;
  quantity: number;
  close: number;
  value: number;
}

export interface PerformancePoint {
  date: string;
  value: number;
  stockValues: PerformanceStockValue[];
}