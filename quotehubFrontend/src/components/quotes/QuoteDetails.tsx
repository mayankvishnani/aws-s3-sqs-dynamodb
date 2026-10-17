import type { Quote, QuoteSummary } from "../../types/quote";
import { money } from "../../utils/quoteFormat";
import { Icon } from "../ui/Icon";
import { StatusBadge } from "../ui/StatusBadge";
import "./QuoteDetails.css";

export function QuoteDetails({
  quote,
  summary,
  refreshing,
  onRefresh,
  onEdit,
}: {
  quote: Quote;
  summary?: QuoteSummary;
  refreshing: boolean;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const business = quote.input?.businessName ?? summary?.businessName ?? "Business quote";
  const editable = quote.status === "COMPLETED" || quote.status === "FAILED";
  return (
    <div className="panel details-panel">
      <div className="details-header"><div><span className="section-kicker">QUOTE DETAILS</span><button className="icon-button" onClick={onRefresh} aria-label="Refresh quote status"><Icon name="refresh" size={16} /></button></div><StatusBadge status={quote.status} /></div>
      <h3>{business}</h3>
      <p className="details-industry">{quote.input?.industry ?? summary?.industry ?? "—"}{quote.input?.state ? ` · ${quote.input.state}` : ""}</p>
      {quote.input && <div className="details-meta">
        <span><small>ANNUAL REVENUE</small><b>{money(quote.input.annualRevenue)}</b></span>
        <span><small>STATE</small><b>{quote.input.state}</b></span>
      </div>}
      {editable && quote.input && <button className="button-secondary edit-quote-button" onClick={onEdit}><Icon name="edit" size={14} /> Edit quote details</button>}
      <div className="quote-id-box"><span>QUOTE ID</span><code>{quote.quoteId}</code></div>
      {quote.documentUrl && <a className="document-link" href={quote.documentUrl} target="_blank" rel="noreferrer"><Icon name="file" size={15} /> View attached document <Icon name="external" size={13} /></a>}
      <div className="carrier-heading"><b>Carrier options</b><span>{quote.results.length} received</span></div>
      {quote.results.length > 0 ? <div className="carrier-list">{quote.results.map((result) => <div className="carrier-row" key={result.carrier}>
        <span className="carrier-icon"><Icon name="shield" size={15} /></span><span className="carrier-name">{result.carrier}<small>{money(result.coverageLimit, result.currency)} coverage</small></span><b>{money(result.premium, result.currency)}<small>annual premium</small></b>
      </div>)}</div> : <div className="carrier-empty">{quote.status === "COMPLETED" ? "No carrier results were returned for this request." : quote.status === "FAILED" ? "This request could not be completed. Please submit a new quote." : <><span className={`spinner small ${refreshing ? "" : "spinner-muted"}`} /> Waiting for carrier responses<span className="processing-note">This updates automatically</span></>}</div>}
      <button className="refresh-link" onClick={onRefresh} disabled={refreshing}><Icon name="refresh" size={14} /> {refreshing ? "Refreshing…" : "Refresh status"}</button>
    </div>
  );
}
