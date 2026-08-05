import { ChevronDown, Menu, Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import type { Portfolio } from "../../types";
import type { Theme } from "../../app/types";

interface TopbarProps {
  portfolios: Portfolio[];
  selectedPortfolioId: number | null;
  selectedPortfolio: Portfolio | null;
  theme: Theme;
  openNavigation: () => void;
  selectPortfolio: (id: number) => void;
  editPortfolio: () => void;
  createPortfolio: () => void;
  deletePortfolio: (portfolio: Portfolio) => void;
  toggleTheme: () => void;
}

export function Topbar({ portfolios, selectedPortfolioId, selectedPortfolio, theme, openNavigation, selectPortfolio, editPortfolio, createPortfolio, deletePortfolio, toggleTheme }: TopbarProps) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={openNavigation} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="portfolio-picker">
        <span>Portfolio</span>
        <label className="portfolio-select">
          <select value={selectedPortfolioId ?? ""} onChange={(event) => selectPortfolio(Number(event.target.value))} aria-label="Selected portfolio">
            {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
        <button className="topbar-text-action" onClick={editPortfolio}><Pencil size={14} /> <span className="topbar-action-label">Edit</span></button>
        <button className="topbar-text-action" onClick={createPortfolio}><Plus size={14} /> <span className="topbar-action-label">New</span></button>
        <button className="topbar-text-action topbar-text-action--danger" onClick={() => selectedPortfolio && deletePortfolio(selectedPortfolio)}>
          <Trash2 size={14} /> <span className="topbar-action-label">Delete</span>
        </button>
      </div>
      <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </header>
  );
}
