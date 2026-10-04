import type { QuoteView } from "../../types/quote";
import { Icon } from "../ui/Icon";
import "./Sidebar.css";

export function Sidebar({
  activeView,
  quoteCount,
  onNavigate,
}: {
  activeView: QuoteView;
  quoteCount: number;
  onNavigate: (view: QuoteView) => void;
}) {
  const startQuote = () => {
    onNavigate("overview");
    document.getElementById("quote-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="QuoteHub home" onClick={() => onNavigate("overview")}>
        <span className="brand-mark"><Icon name="shield" size={21} /></span>
        <span>quote<span className="brand-accent">hub</span></span>
      </a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={`nav-item ${activeView === "overview" ? "active" : ""}`} onClick={() => onNavigate("overview")}>
          <Icon name="grid" size={17} /> Overview
        </button>
        <button className={`nav-item ${activeView === "quotes" ? "active" : ""}`} onClick={() => onNavigate("quotes")}>
          <Icon name="file" size={17} /> My quotes
          {quoteCount > 0 && <span className="nav-count">{quoteCount}</span>}
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <span className="help-icon"><Icon name="spark" size={16} /></span>
          <strong>Clear coverage starts here.</strong>
          <p>Compare options from multiple carriers in one place.</p>
          <button onClick={startQuote}>Start a quote <Icon name="arrow" size={14} /></button>
        </div>
        <div className="profile">
          <span className="avatar">Q</span>
          <span className="profile-name">QuoteHub <small>Business workspace</small></span>
          <span className="profile-dots">···</span>
        </div>
      </div>
    </aside>
  );
}
