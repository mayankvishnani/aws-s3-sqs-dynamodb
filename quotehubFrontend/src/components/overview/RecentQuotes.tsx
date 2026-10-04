import type { QuoteSummary } from "../../types/quote";
import { relativeTime } from "../../utils/quoteFormat";
import { Icon } from "../ui/Icon";
import { StatusBadge } from "../ui/StatusBadge";
import "./RecentQuotes.css";

export function RecentQuotes({
  quotes,
  onSelect,
  onSeeAll,
}: {
  quotes: QuoteSummary[];
  onSelect: (quoteId: string) => void;
  onSeeAll: () => void;
}) {
  return (
    <section className="recent-section">
      <div className="section-heading-row"><div><span className="section-kicker">PICK UP WHERE YOU LEFT OFF</span><h2>Recent requests</h2></div><button className="text-button" onClick={onSeeAll}>View all quotes <Icon name="arrow" size={14} /></button></div>
      {quotes.length === 0 ? <div className="empty-recent"><span className="empty-icon"><Icon name="file" size={19} /></span><span><b>Your quote activity will show up here.</b><small>Start your first request above to see it in your workspace.</small></span></div> : <div className="recent-grid">{quotes.map((item) => <button className="recent-card" key={item.quoteId} onClick={() => onSelect(item.quoteId)}>
        <span className="recent-card-top"><span className="business-avatar">{item.businessName.slice(0, 1).toUpperCase()}</span><StatusBadge status={item.status} /></span>
        <b className="recent-business">{item.businessName}</b>
        <span className="recent-industry">{item.industry}</span>
        <span className="recent-card-bottom"><span>{relativeTime(item.createdAt, Date.now())}</span><Icon name="arrow" size={14} /></span>
      </button>)}</div>}
    </section>
  );
}
