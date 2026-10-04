import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAllQuotes, fetchQuote, submitQuote } from "../api/quoteApi";
import type { Quote, QuoteInput, QuoteStats, QuoteSummary, QuoteView } from "../types/quote";
import { readSavedQuotes, saveRecentQuotes } from "../utils/quoteFormat";

export function useQuoteHub() {
  const [quotes, setQuotes] = useState<QuoteSummary[]>(readSavedQuotes);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [allQuotesLoaded, setAllQuotesLoaded] = useState(false);
  const [allQuotesLoading, setAllQuotesLoading] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState<QuoteView>("overview");
  const [now, setNow] = useState(Date.now());

  useEffect(() => saveRecentQuotes(quotes), [quotes]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const updateQuote = useCallback(async (quoteId: string, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const fresh = await fetchQuote(quoteId);
      setSelectedQuote((current) => current?.quoteId === quoteId ? fresh : current);
      setAllQuotes((current) => current.map((item) => item.quoteId === quoteId ? fresh : item));
      setQuotes((current) =>
        current.map((item) => item.quoteId === quoteId ? { ...item, status: fresh.status } : item),
      );
      if (!silent) setError("");
    } catch (caught) {
      if (!silent) setError(caught instanceof Error ? caught.message : "Could not load this quote.");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const loadAllQuotes = useCallback(async () => {
    setAllQuotesLoading(true);
    setError("");
    try {
      const fetchedQuotes = await fetchAllQuotes();
      setAllQuotes(fetchedQuotes);
      setAllQuotesLoaded(true);
      setQuotes((current) => {
        const latest = fetchedQuotes.map((quote) => ({
          quoteId: quote.quoteId,
          status: quote.status,
          businessName: quote.input?.businessName ?? "Business quote",
          industry: quote.input?.industry ?? "—",
          createdAt: quote.createdAt ? Date.parse(quote.createdAt) : Date.now(),
        }));
        return [...latest, ...current.filter((item) => !latest.some((quote) => quote.quoteId === item.quoteId))].slice(0, 12);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load quotes.");
    } finally {
      setAllQuotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === "quotes") void loadAllQuotes();
  }, [activeView, loadAllQuotes]);

  useEffect(() => {
    const pendingIds = [...quotes, ...allQuotes]
      .filter((quote) => quote.status === "PENDING" || quote.status === "PROCESSING")
      .map((quote) => quote.quoteId)
      .filter((quoteId, index, ids) => ids.indexOf(quoteId) === index);
    if (pendingIds.length === 0) return;
    const timer = window.setInterval(() => pendingIds.forEach((id) => void updateQuote(id, true)), 5000);
    return () => window.clearInterval(timer);
  }, [quotes, allQuotes, updateQuote]);

  const stats = useMemo<QuoteStats>(() => {
    const source = allQuotesLoaded ? allQuotes : quotes;
    return {
      total: source.length,
      complete: source.filter((quote) => quote.status === "COMPLETED").length,
      pending: source.filter((quote) => quote.status === "PENDING" || quote.status === "PROCESSING").length,
    };
  }, [allQuotes, allQuotesLoaded, quotes]);

  const upsertQuoteSummary = useCallback((summary: QuoteSummary) => {
    setQuotes((current) => [summary, ...current.filter((item) => item.quoteId !== summary.quoteId)].slice(0, 12));
  }, []);

  const createQuote = useCallback(async (input: QuoteInput, file?: File) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const created = await submitQuote(input, file);
      const summary: QuoteSummary = {
        quoteId: created.quoteId,
        status: created.status,
        businessName: input.businessName,
        industry: input.industry,
        createdAt: created.createdAt ? Date.parse(created.createdAt) : Date.now(),
      };
      upsertQuoteSummary(summary);
      setSelectedQuote(created);
      setAllQuotes((current) => [created, ...current.filter((item) => item.quoteId !== created.quoteId)]);
      setAllQuotesLoaded(true);
      setNotice("Quote request sent. We’ll keep checking for carrier results.");
      setActiveView("quotes");
      void updateQuote(created.quoteId, true);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your quote.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [updateQuote, upsertQuoteSummary]);

  const findQuote = useCallback(async (quoteId: string) => {
    setError("");
    setNotice("");
    try {
      const quote = await fetchQuote(quoteId);
      setSelectedQuote(quote);
      setAllQuotes((current) => [quote, ...current.filter((item) => item.quoteId !== quote.quoteId)]);
      upsertQuoteSummary({
        quoteId: quote.quoteId,
        status: quote.status,
        businessName: quote.input?.businessName ?? "Business quote",
        industry: quote.input?.industry ?? "—",
        createdAt: quote.createdAt ? Date.parse(quote.createdAt) : Date.now(),
      });
      setActiveView("quotes");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not find that quote.");
    }
  }, [upsertQuoteSummary]);

  const selectQuote = useCallback((quoteId: string) => {
    const fullQuote = allQuotes.find((item) => item.quoteId === quoteId);
    const recentQuote = quotes.find((item) => item.quoteId === quoteId);
    setSelectedQuote(fullQuote ?? (recentQuote ? {
      quoteId: recentQuote.quoteId,
      status: recentQuote.status,
      results: [],
    } : null));
    void updateQuote(quoteId);
  }, [allQuotes, quotes, updateQuote]);

  const selectedSummary = selectedQuote
    ? quotes.find((item) => item.quoteId === selectedQuote.quoteId)
    : undefined;

  return {
    activeView,
    allQuotes,
    allQuotesLoading,
    error,
    loading,
    now,
    notice,
    quotes,
    refreshing,
    selectedQuote,
    selectedSummary,
    stats,
    createQuote,
    dismissMessage: () => { setError(""); setNotice(""); },
    findQuote,
    loadAllQuotes,
    navigate: setActiveView,
    refreshSelectedQuote: () => { if (selectedQuote) void updateQuote(selectedQuote.quoteId); },
    selectQuote,
    closeQuote: () => setSelectedQuote(null),
  };
}
