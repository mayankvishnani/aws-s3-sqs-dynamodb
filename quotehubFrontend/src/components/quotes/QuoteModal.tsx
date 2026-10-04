import { useEffect } from "react";
import type { Quote, QuoteSummary } from "../../types/quote";
import { Icon } from "../ui/Icon";
import { QuoteDetails } from "./QuoteDetails";
import "./QuoteModal.css";

export function QuoteModal({
  quote,
  summary,
  refreshing,
  onRefresh,
  onClose,
}: {
  quote: Quote;
  summary?: QuoteSummary;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
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
      <section className="quote-modal" role="dialog" aria-modal="true" aria-label={`Quote details for ${quote.input?.businessName ?? "selected business"}`}>
        <div className="modal-heading">
          <div><span className="section-kicker">QUOTE OVERVIEW</span><h2>{quote.input?.businessName ?? summary?.businessName ?? "Quote details"}</h2></div>
          <button className="modal-close" onClick={onClose} aria-label="Close quote details"><Icon name="close" size={18} /></button>
        </div>
        <QuoteDetails quote={quote} summary={summary} refreshing={refreshing} onRefresh={onRefresh} />
      </section>
    </div>
  );
}
