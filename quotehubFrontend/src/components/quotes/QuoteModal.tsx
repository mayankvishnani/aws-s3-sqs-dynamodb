import { useEffect, useState } from "react";
import type { Quote, QuoteInput, QuoteSummary } from "../../types/quote";
import { Icon } from "../ui/Icon";
import { QuoteDetails } from "./QuoteDetails";
import { QuoteForm } from "../overview/QuoteForm";
import "./QuoteModal.css";

export function QuoteModal({
  quote,
  summary,
  refreshing,
  updating,
  onRefresh,
  onUpdateQuote,
  onClose,
}: {
  quote: Quote;
  summary?: QuoteSummary;
  refreshing: boolean;
  updating: boolean;
  onRefresh: () => void;
  onUpdateQuote: (quoteId: string, input: QuoteInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`quote-modal ${editing ? "quote-modal-editing" : ""}`} role="dialog" aria-modal="true" aria-label={`${editing ? "Edit quote" : "Quote details for"} ${quote.input?.businessName ?? "selected business"}`}>
        <div className="modal-heading">
          <div><span className="section-kicker">{editing ? "EDIT QUOTE" : "QUOTE OVERVIEW"}</span><h2>{quote.input?.businessName ?? summary?.businessName ?? "Quote details"}</h2></div>
          <button className="modal-close" onClick={onClose} aria-label="Close quote details"><Icon name="close" size={18} /></button>
        </div>
        {editing && quote.input ? (
          <QuoteForm
            key={quote.quoteId}
            loading={updating}
            initialInput={quote.input}
            onSubmit={(input) => onUpdateQuote(quote.quoteId, input)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <QuoteDetails quote={quote} summary={summary} refreshing={refreshing} onRefresh={onRefresh} onEdit={() => setEditing(true)} />
        )}
      </section>
    </div>
  );
}
