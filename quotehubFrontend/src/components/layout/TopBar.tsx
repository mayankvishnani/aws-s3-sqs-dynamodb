import { Icon } from "../ui/Icon";
import "./TopBar.css";

export function TopBar({ pageTitle, now }: { pageTitle: string; now: number }) {
  return (
    <header className="topbar">
      <div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{pageTitle}</strong></div>
      <div className="topbar-right">
        <span className="secure-indicator"><span className="secure-dot" /> Secure workspace</span>
        <span className="topbar-divider" />
        <span className="date-label">{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now)}</span>
        <span className="top-avatar">Q</span>
      </div>
    </header>
  );
}
