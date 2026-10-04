import type { QuoteStats } from "../../types/quote";
import { Icon } from "../ui/Icon";
import "./StatsCards.css";

export function StatsCards({ stats }: { stats: QuoteStats }) {
  return (
    <section className="stats-grid" aria-label="Quote summary">
      <div className="stat-card"><span className="stat-icon purple"><Icon name="file" size={17} /></span><span className="stat-label">TOTAL REQUESTS</span><strong>{stats.total}</strong><small>Quotes in your workspace</small></div>
      <div className="stat-card"><span className="stat-icon green"><Icon name="check" size={17} /></span><span className="stat-label">READY TO REVIEW</span><strong>{stats.complete}</strong><small>Carrier options received</small></div>
      <div className="stat-card"><span className="stat-icon amber"><Icon name="clock" size={17} /></span><span className="stat-label">IN PROGRESS</span><strong>{stats.pending}</strong><small>Waiting on carriers</small></div>
      <div className="stat-card stat-tip"><span className="tip-icon"><Icon name="spark" size={17} /></span><span className="stat-label">A LITTLE TIP</span><p>Have a policy document? Attach it to give carriers a fuller picture.</p></div>
    </section>
  );
}
