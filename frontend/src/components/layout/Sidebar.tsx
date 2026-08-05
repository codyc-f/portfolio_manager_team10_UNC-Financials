import {
  BarChart3,
  BriefcaseBusiness,
  PieChart,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Page } from "../../app/types";

interface SidebarProps {
  open: boolean;
  close: () => void;
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ open, close, activePage, onNavigate }: SidebarProps) {
  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><TrendingUp size={20} strokeWidth={2.4} /></div>
        <div><strong>UNC Financials</strong><span>Portfolio manager</span></div>
        <button className="mobile-close" onClick={close} aria-label="Close navigation"><X size={20} /></button>
      </div>
      <nav className="main-nav" aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        <NavItem icon={<BriefcaseBusiness size={19} />} label="Holdings" active={activePage === "holdings"} onClick={() => onNavigate("holdings")} />
        <NavItem icon={<BarChart3 size={19} />} label="Performance" active={activePage === "performance"} onClick={() => onNavigate("performance")} />
        <NavItem icon={<PieChart size={19} />} label="Allocation" active={activePage === "allocation"} onClick={() => onNavigate("allocation")} />
      </nav>
      <div className="sidebar-footer">
        <div className="secure-note"><ShieldCheck size={18} /><div><strong>Database connected</strong><span>Changes save to MySQL</span></div></div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, future, onClick }: { icon: ReactNode; label: string; active?: boolean; future?: boolean; onClick?: () => void }) {
  return <button className={`nav-item ${active ? "nav-item--active" : ""} ${future ? "nav-item--future" : ""}`} onClick={onClick} disabled={future}>{icon}<span>{label}</span>{future && <small>Soon</small>}</button>;
}
