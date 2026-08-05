import type { HoldingDraft } from "../types";

export function createEmptyHolding(
  portfolioId: number,
  currency = "USD",
): HoldingDraft {
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
