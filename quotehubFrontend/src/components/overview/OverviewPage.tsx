import type { QuoteInput, QuoteStats, QuoteSummary } from "../../types/quote";
import { CoverageGuide } from "./CoverageGuide";
import { HeroBanner } from "./HeroBanner";
import { QuoteForm } from "./QuoteForm";
import { RecentQuotes } from "./RecentQuotes";
import { StatsCards } from "./StatsCards";
import "./OverviewPage.css";

export function OverviewPage({
  stats,
  quotes,
  loading,
  onSubmitQuote,
  onSelectQuote,
  onSeeAllQuotes,
}: {
  stats: QuoteStats;
  quotes: QuoteSummary[];
  loading: boolean;
  onSubmitQuote: (input: QuoteInput, file?: File) => Promise<boolean>;
  onSelectQuote: (quoteId: string) => void;
  onSeeAllQuotes: () => void;
}) {
  const startQuote = () => document.getElementById("quote-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <>
      <HeroBanner onStartQuote={startQuote} />
      <StatsCards stats={stats} />
      <section className="work-grid">
        <QuoteForm loading={loading} onSubmit={onSubmitQuote} />
        <CoverageGuide />
      </section>
      <RecentQuotes quotes={quotes.slice(0, 4)} onSelect={onSelectQuote} onSeeAll={onSeeAllQuotes} />
    </>
  );
}
