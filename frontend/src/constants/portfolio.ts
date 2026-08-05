import type { AssetType, PortfolioDraft } from "../types";

export const assetTypes: AssetType[] = ["Stock", "ETF", "Bond", "Crypto", "Cash"];

export const emptyPortfolio: PortfolioDraft = {
  name: "",
  baseCurrency: "USD",
  balance: 0,
};
