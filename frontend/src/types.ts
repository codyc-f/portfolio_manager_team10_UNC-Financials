export type AssetType = "Stock" | "ETF" | "Bond" | "Crypto" | "Cash";
export type TradeType = "BUY" | "SELL";

export interface Portfolio {
  id: number;
  name: string;
  baseCurrency: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortfolioDraft {
  name: string;
  baseCurrency: string;
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
