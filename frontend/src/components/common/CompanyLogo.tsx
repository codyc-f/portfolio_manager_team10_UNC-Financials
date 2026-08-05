import { useState } from "react";
import type { AssetType } from "../../types";

export function CompanyLogo({ ticker, logoUrl, assetType }: { ticker: string; logoUrl: string | null; assetType: AssetType }) {
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
