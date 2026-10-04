import { useState, type FormEvent } from "react";
import type { Quote, QuoteSummary } from "../../types/quote";
import { relativeTime } from "../../utils/quoteFormat";
import { Icon } from "../ui/Icon";
import { StatusBadge } from "../ui/StatusBadge";
import { EmptyQuoteList } from "./EmptyQuoteList";
import "./QuotesPage.css";

export function QuotesPage({
  quotes,
  now,
  loading,
  onFindQuote,
  onSelectQuote,
  onCreateQuote,
}: {
  quotes: Quote[];
  now: number;
  loading: boolean;
  onFindQuote: (quoteId: string) => Promise<void>;
  onSelectQuote: (quoteId: string) => void;
  onCreateQuote: () => void;
}) {
  const [searchId, setSearchId] = useState("");
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = searchId.trim();
    if (!id) return;
    void onFindQuote(id);
    setSearchId("");
  };

  return (
    <section className="quotes-view">
      <div className="quotes-title-row">
        <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE</div><h1>My quotes<span className="title-period">.</span></h1><p>All your quote requests, together in one place.</p></div>
        <button className="button-primary" onClick={onCreateQuote}>New quote <Icon name="plus" size={16} /></button>
      </div>
      <form className="search-form" onSubmit={submitSearch}>
        <Icon name="search" size={17} /><input value={searchId} onChange={(event) => setSearchId(event.target.value)} placeholder="Paste a quote ID to look it up" aria-label="Quote ID" />
        <button type="submit">Find quote <Icon name="arrow" size={14} /></button>
      </form>
      <div className="panel all-quotes-panel">
        <div className="list-heading"><div><span className="section-kicker">QUOTE HISTORY</span><h2>All requests <span>{quotes.length}</span></h2></div><span className="auto-refresh"><span /> Auto-updating</span></div>
        {loading && quotes.length === 0 ? <div className="quotes-loading"><span className="spinner small" /> Loading all quotes…</div> : quotes.length === 0 ? <EmptyQuoteList onCreate={onCreateQuote} /> : <div className="quote-list">{quotes.map((item) => {
          const businessName = item.input?.businessName ?? "Business quote";
          const summary: QuoteSummary = {
            quoteId: item.quoteId,
            status: item.status,
            businessName,
            industry: item.input?.industry ?? "—",
            createdAt: item.createdAt ? Date.parse(item.createdAt) : now,
          };
          return (
            <button className="quote-row" key={item.quoteId} onClick={() => onSelectQuote(item.quoteId)}>
              <span className="business-avatar">{businessName.slice(0, 1).toUpperCase()}</span>
              <span className="quote-main"><b>{businessName}</b><small>{summary.industry} <span>·</span> {item.quoteId}</small></span>
              <StatusBadge status={item.status} />
              <span className="quote-date">{relativeTime(summary.createdAt, now)}</span>
              <Icon name="chevron" size={15} />
            </button>
          );
        })}</div>}
      </div>
    </section>
  );
}
