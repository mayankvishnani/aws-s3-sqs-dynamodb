import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QuoteStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
type CarrierResult = {
  carrier: string;
  premium: number;
  currency: string;
  coverageLimit: number;
};
type QuoteInput = {
  businessName: string;
  industry: string;
  annualRevenue: number;
  state: string;
};
type Quote = {
  quoteId: string;
  status: QuoteStatus;
  input?: QuoteInput;
  documentKey?: string;
  documentUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  results: CarrierResult[];
};
type QuoteSummary = {
  quoteId: string;
  status: QuoteStatus;
  businessName: string;
  industry: string;
  createdAt: number;
};
type UploadResponse = { key: string; url: string };
type ApiError = { error?: string; errors?: { message?: string }[] };

const STORAGE_KEY = "quotehub.recent-quotes";
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
const statusOrder: QuoteStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

function readSavedQuotes(): QuoteSummary[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (item): item is QuoteSummary =>
        typeof item?.quoteId === "string" &&
        typeof item?.businessName === "string" &&
        typeof item?.industry === "string" &&
        statusOrder.includes(item?.status) &&
        typeof item?.createdAt === "number",
    );
  } catch {
    return [];
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, init);
  } catch {
    throw new Error("Could not connect to the QuoteHub API. Check that the backend is running.");
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiError;
      message = body.error ?? body.errors?.[0]?.message ?? message;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function Icon({
  name,
  size = 18,
}: {
  name: "grid" | "file" | "plus" | "arrow" | "shield" | "spark" | "upload" | "clock" | "check" | "refresh" | "external" | "search" | "close" | "briefcase" | "chart" | "chevron";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<typeof name, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="m9 12 2 2 4-4" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14z" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M20 16v4H4v-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
    external: <><path d="M14 3h7v7M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const icon = status === "COMPLETED" ? "check" : status === "FAILED" ? "close" : "clock";
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <Icon name={icon} size={13} />
      {status.toLowerCase()}
    </span>
  );
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function App() {
  const [quotes, setQuotes] = useState<QuoteSummary[]>(readSavedQuotes);
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [allQuotesLoaded, setAllQuotesLoaded] = useState(false);
  const [allQuotesLoading, setAllQuotesLoading] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [state, setState] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState<"overview" | "quotes">("overview");
  const [now, setNow] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const updateQuote = useCallback(async (quoteId: string, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const fresh = await request<Quote>(`/quotes/${encodeURIComponent(quoteId)}`);
      fresh.results = Array.isArray(fresh.results) ? fresh.results : [];
      setSelectedQuote((current) => current?.quoteId === quoteId ? fresh : current);
      setAllQuotes((current) =>
        current.map((item) => item.quoteId === quoteId ? fresh : item),
      );
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
      const response = await request<{ quotes: Quote[] }>("/allQuotes");
      const fetchedQuotes = response.quotes.map((quote) => ({
        ...quote,
        results: Array.isArray(quote.results) ? quote.results : [],
      }));
      setAllQuotes(fetchedQuotes);
      setAllQuotesLoaded(true);
      setQuotes((current) => {
        const recent = fetchedQuotes.map((quote) => ({
          quoteId: quote.quoteId,
          status: quote.status,
          businessName: quote.input?.businessName ?? "Business quote",
          industry: quote.input?.industry ?? "—",
          createdAt: quote.createdAt ? Date.parse(quote.createdAt) : Date.now(),
        }));
        const merged = [...recent, ...current.filter((item) => !recent.some((quote) => quote.quoteId === item.quoteId))];
        return merged.slice(0, 12);
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
      .filter((item) => item.status === "PENDING" || item.status === "PROCESSING")
      .map((item) => item.quoteId)
      .filter((quoteId, index, ids) => ids.indexOf(quoteId) === index);
    if (pendingIds.length === 0) return;
    const timer = window.setInterval(() => {
      pendingIds.forEach((id) => void updateQuote(id, true));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [quotes, allQuotes, updateQuote]);

  const stats = useMemo(() => ({
    total: allQuotesLoaded ? allQuotes.length : quotes.length,
    complete: (allQuotesLoaded ? allQuotes : quotes).filter((quote) => quote.status === "COMPLETED").length,
    pending: (allQuotesLoaded ? allQuotes : quotes).filter((quote) => quote.status === "PENDING" || quote.status === "PROCESSING").length,
  }), [allQuotes, allQuotesLoaded, quotes]);

  const upsertQuoteSummary = (summary: QuoteSummary) => {
    setQuotes((current) => [summary, ...current.filter((item) => item.quoteId !== summary.quoteId)].slice(0, 12));
  };

  const createQuote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      let documentKey: string | undefined;
      if (file) {
        const contentType = file.type || "application/octet-stream";
        const upload = await request<UploadResponse>("/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType }),
        });
        const signed = new URL(upload.url);
        const uploadPath = `/s3${signed.pathname}${signed.search}`;
        const uploaded = await fetch(uploadPath, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!uploaded.ok) {
          throw new Error(`Document upload failed (${uploaded.status}). Check the Floci S3 service and try again.`);
        }
        documentKey = upload.key;
      }

      const input: QuoteInput = {
        businessName: businessName.trim(),
        industry: industry.trim(),
        annualRevenue: Number(annualRevenue),
        state: state.trim().toUpperCase(),
      };
      const created = await request<{ quoteId: string; status: QuoteStatus }>("/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, ...(documentKey ? { documentKey } : {}) }),
      });
      const summary: QuoteSummary = {
        quoteId: created.quoteId,
        status: created.status,
        businessName: input.businessName,
        industry: input.industry,
        createdAt: Date.now(),
      };
      upsertQuoteSummary(summary);
      const quote: Quote = { ...summary, createdAt: new Date(summary.createdAt).toISOString(), input, documentKey, results: [] };
      setSelectedQuote(quote);
      setAllQuotes((current) => [quote, ...current.filter((item) => item.quoteId !== quote.quoteId)]);
      setAllQuotesLoaded(true);
      setBusinessName("");
      setIndustry("");
      setAnnualRevenue("");
      setState("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("Quote request sent. We’ll keep checking for carrier results.");
      setActiveView("quotes");
      void updateQuote(created.quoteId, true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your quote.");
    } finally {
      setLoading(false);
    }
  };

  const findQuote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = searchId.trim();
    if (!id) return;
    setError("");
    setNotice("");
    try {
      const quote = await request<Quote>(`/quotes/${encodeURIComponent(id)}`);
      quote.results = Array.isArray(quote.results) ? quote.results : [];
      setSelectedQuote(quote);
      setAllQuotes((current) => [quote, ...current.filter((item) => item.quoteId !== quote.quoteId)]);
      upsertQuoteSummary({
        quoteId: quote.quoteId,
        status: quote.status,
        businessName: quote.input?.businessName ?? "Business quote",
        industry: quote.input?.industry ?? "—",
        createdAt: Date.now(),
      });
      setActiveView("quotes");
      setSearchId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not find that quote.");
    }
  };

  const selectRecentQuote = async (quoteId: string) => {
    const fullQuote = allQuotes.find((item) => item.quoteId === quoteId);
    const recentQuote = quotes.find((item) => item.quoteId === quoteId);
    setSelectedQuote(fullQuote ?? (recentQuote ? {
      quoteId: recentQuote.quoteId,
      status: recentQuote.status,
      results: [],
    } : null));
    await updateQuote(quoteId);
  };

  const selectedSummary = selectedQuote
    ? quotes.find((item) => item.quoteId === selectedQuote.quoteId)
    : undefined;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="QuoteHub home" onClick={() => setActiveView("overview")}>
          <span className="brand-mark"><Icon name="shield" size={21} /></span>
          <span>quote<span className="brand-accent">hub</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={`nav-item ${activeView === "overview" ? "active" : ""}`} onClick={() => setActiveView("overview")}>
            <Icon name="grid" size={17} /> Overview
          </button>
          <button className={`nav-item ${activeView === "quotes" ? "active" : ""}`} onClick={() => setActiveView("quotes")}>
            <Icon name="file" size={17} /> My quotes
            {stats.total > 0 && <span className="nav-count">{stats.total}</span>}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><Icon name="spark" size={16} /></span>
            <strong>Clear coverage starts here.</strong>
            <p>Compare options from multiple carriers in one place.</p>
            <button onClick={() => { setActiveView("overview"); document.getElementById("quote-form")?.scrollIntoView({ behavior: "smooth" }); }}>
              Start a quote <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">Q</span>
            <span className="profile-name">QuoteHub <small>Business workspace</small></span>
            <span className="profile-dots">···</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{activeView === "overview" ? "Overview" : "My quotes"}</strong></div>
          <div className="topbar-right">
            <span className="secure-indicator"><span className="secure-dot" /> Secure workspace</span>
            <span className="topbar-divider" />
            <span className="date-label">{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(now)}</span>
            <span className="top-avatar">Q</span>
          </div>
        </header>

        <div className="content">
          {(error || notice) && (
            <div className={`alert ${error ? "alert-error" : "alert-success"}`} role={error ? "alert" : "status"}>
              <span>{error || notice}</span>
              <button aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><Icon name="close" size={16} /></button>
            </div>
          )}

          {activeView === "overview" ? (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow"><span className="eyebrow-line" /> BUSINESS COVERAGE, MADE CLEAR</div>
                  <h1>Good coverage.<br /><span>Better peace of mind.</span></h1>
                  <p className="welcome-copy">Tell us a little about your business. We’ll gather options from our carrier network so you can make a confident call.</p>
                  <button className="button-primary welcome-cta" onClick={() => document.getElementById("quote-form")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                    Get your quotes <Icon name="arrow" size={16} />
                  </button>
                </div>
                <div className="hero-visual" aria-hidden="true">
                  <div className="hero-glow" />
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="hero-shield"><Icon name="shield" size={76} /></div>
                  <span className="float-chip chip-top"><span className="chip-dot mint" /> Your business, protected</span>
                  <span className="float-chip chip-bottom"><Icon name="spark" size={14} /> Coverage that fits</span>
                  <span className="hero-star star-one">✳</span>
                  <span className="hero-star star-two">✦</span>
                </div>
              </section>

              <section className="stats-grid" aria-label="Quote summary">
                <div className="stat-card"><span className="stat-icon purple"><Icon name="file" size={17} /></span><span className="stat-label">TOTAL REQUESTS</span><strong>{stats.total}</strong><small>Quotes in your workspace</small></div>
                <div className="stat-card"><span className="stat-icon green"><Icon name="check" size={17} /></span><span className="stat-label">READY TO REVIEW</span><strong>{stats.complete}</strong><small>Carrier options received</small></div>
                <div className="stat-card"><span className="stat-icon amber"><Icon name="clock" size={17} /></span><span className="stat-label">IN PROGRESS</span><strong>{stats.pending}</strong><small>Waiting on carriers</small></div>
                <div className="stat-card stat-tip"><span className="tip-icon"><Icon name="spark" size={17} /></span><span className="stat-label">A LITTLE TIP</span><p>Have a policy document? Attach it to give carriers a fuller picture.</p></div>
              </section>

              <section className="work-grid">
                <div className="panel quote-panel" id="quote-form">
                  <div className="panel-heading">
                    <div><span className="section-kicker">LET’S GET STARTED</span><h2>Tell us about your business</h2><p>A few details help us find the right fit.</p></div>
                    <span className="step-pill">STEP <b>01</b> / 01</span>
                  </div>
                  <form onSubmit={createQuote}>
                    <div className="form-grid">
                      <label className="field field-wide">
                        <span>Business name <i>*</i></span>
                        <div className="input-wrap"><Icon name="briefcase" size={16} /><input required minLength={1} maxLength={120} value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. Northstar Coffee Co." /></div>
                      </label>
                      <label className="field">
                        <span>Industry <i>*</i></span>
                        <select required value={industry} onChange={(event) => setIndustry(event.target.value)}>
                          <option value="" disabled>Select your industry</option>
                          {["Agriculture", "Construction", "Consulting", "Education", "Food & beverage", "Healthcare", "Manufacturing", "Professional services", "Retail", "Technology", "Transportation", "Other"].map((item) => <option key={item} value={item.toLowerCase()}>{item}</option>)}
                        </select>
                      </label>
                      <label className="field">
                        <span>Annual revenue <i>*</i></span>
                        <div className="input-wrap"><span className="input-prefix">$</span><input required type="number" min="1" step="any" value={annualRevenue} onChange={(event) => setAnnualRevenue(event.target.value)} placeholder="500,000" /></div>
                      </label>
                      <label className="field field-short">
                        <span>State <i>*</i></span>
                        <input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={state} onChange={(event) => setState(event.target.value.toUpperCase())} placeholder="NY" />
                      </label>
                      <div className="field field-wide">
                        <span>Supporting document <small className="optional">OPTIONAL</small></span>
                        <button type="button" className={`file-drop ${file ? "has-file" : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); }}>
                          <span className="file-icon"><Icon name={file ? "check" : "upload"} size={17} /></span>
                          <span className="file-copy"><b>{file ? file.name : "Click to upload or drag and drop"}</b><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Attached to your request` : "Any file type · Uploaded securely to your private request"}</small></span>
                          {file && <span className="remove-file" onClick={(event) => { event.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Remove file"><Icon name="close" size={15} /></span>}
                        </button>
                        <input ref={fileInputRef} className="visually-hidden" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                      </div>
                    </div>
                    <div className="form-footer">
                      <span className="privacy-note"><Icon name="shield" size={14} /> Your information stays private and secure.</span>
                      <button className="button-primary submit-button" type="submit" disabled={loading}>
                        {loading ? <><span className="spinner" /> Sending request</> : <>Compare my options <Icon name="arrow" size={15} /></>}
                      </button>
                    </div>
                  </form>
                </div>

                <aside className="side-column">
                  <div className="panel how-panel">
                    <div className="mini-panel-title"><span className="section-kicker">SIMPLE BY DESIGN</span><span className="mini-title-icon"><Icon name="spark" size={15} /></span></div>
                    <h3>Good decisions,<br />without the guesswork.</h3>
                    <div className="process-step"><span className="process-number">01</span><span><b>Share the basics</b><small>Tell us about your business.</small></span></div>
                    <div className="process-line" />
                    <div className="process-step"><span className="process-number">02</span><span><b>We do the legwork</b><small>Carriers prepare your options.</small></span></div>
                    <div className="process-line" />
                    <div className="process-step"><span className="process-number">03</span><span><b>Choose with confidence</b><small>Compare coverage side by side.</small></span></div>
                  </div>
                  <div className="trust-card">
                    <span className="trust-icon"><Icon name="shield" size={20} /></span>
                    <div><b>Built around your business</b><p>Your details help carriers understand what makes your work unique.</p></div>
                    <span className="trust-watermark"><Icon name="shield" size={85} /></span>
                  </div>
                </aside>
              </section>

              <RecentQuotes quotes={quotes.slice(0, 4)} onSelect={selectRecentQuote} onSeeAll={() => setActiveView("quotes")} />
            </>
          ) : (
            <section className="quotes-view">
              <div className="quotes-title-row">
                <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE</div><h1>My quotes<span className="title-period">.</span></h1><p>All your quote requests, together in one place.</p></div>
                <button className="button-primary" onClick={() => setActiveView("overview")}>New quote <Icon name="plus" size={16} /></button>
              </div>
              <form className="search-form" onSubmit={findQuote}>
                <Icon name="search" size={17} /><input value={searchId} onChange={(event) => setSearchId(event.target.value)} placeholder="Paste a quote ID to look it up" aria-label="Quote ID" />
                <button type="submit">Find quote <Icon name="arrow" size={14} /></button>
              </form>
              <div className="quotes-layout">
                <div className="panel all-quotes-panel">
                  <div className="list-heading"><div><span className="section-kicker">QUOTE HISTORY</span><h2>All requests <span>{allQuotes.length}</span></h2></div><span className="auto-refresh"><span /> Auto-updating</span></div>
                  {allQuotesLoading && allQuotes.length === 0 ? <div className="quotes-loading"><span className="spinner small" /> Loading all quotes…</div> : allQuotes.length === 0 ? <EmptyState onCreate={() => setActiveView("overview")} /> : <div className="quote-list">{allQuotes.map((item) => <button className="quote-row" key={item.quoteId} onClick={() => void selectRecentQuote(item.quoteId)}>
                    <span className="business-avatar">{(item.input?.businessName ?? "B").slice(0, 1).toUpperCase()}</span>
                    <span className="quote-main"><b>{item.input?.businessName ?? "Business quote"}</b><small>{item.input?.industry ?? "—"} <span>·</span> {item.quoteId}</small></span>
                    <StatusBadge status={item.status} />
                    <span className="quote-date">{relativeTime(item.createdAt ? Date.parse(item.createdAt) : Date.now(), now)}</span>
                    <Icon name="chevron" size={15} />
                  </button>)}</div>}
                </div>
              </div>
            </section>
          )}
          <footer className="footer"><span>© {new Date().getFullYear()} QuoteHub</span><span><Icon name="shield" size={13} /> Your business deserves good coverage.</span></footer>
        </div>
      </main>
      {selectedQuote && <QuoteModal
        quote={selectedQuote}
        summary={selectedSummary}
        refreshing={refreshing}
        onRefresh={() => void updateQuote(selectedQuote.quoteId)}
        onClose={() => setSelectedQuote(null)}
      />}
    </div>
  );
}

function RecentQuotes({
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

function QuoteDetails({
  quote,
  summary,
  refreshing,
  onRefresh,
}: {
  quote: Quote | null;
  summary?: QuoteSummary;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (!quote) return <div className="panel details-panel details-empty"><span className="details-empty-icon"><Icon name="chart" size={24} /></span><h3>Quote details</h3><p>Select a request to see its current status and carrier options.</p></div>;
  const business = quote.input?.businessName ?? summary?.businessName ?? "Business quote";
  return (
    <div className="panel details-panel">
      <div className="details-header"><div><span className="section-kicker">QUOTE DETAILS</span><button className="icon-button" onClick={onRefresh} aria-label="Refresh quote status"><Icon name="refresh" size={16} /></button></div><StatusBadge status={quote.status} /></div>
      <h3>{business}</h3>
      <p className="details-industry">{quote.input?.industry ?? summary?.industry ?? "—"}{quote.input?.state ? ` · ${quote.input.state}` : ""}</p>
      {quote.input && <div className="details-meta">
        <span><small>ANNUAL REVENUE</small><b>{money(quote.input.annualRevenue)}</b></span>
        <span><small>STATE</small><b>{quote.input.state}</b></span>
      </div>}
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

function QuoteModal({
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="file" size={20} /></span><h3>No quotes yet</h3><p>Your quote requests will appear here after you submit your first one.</p><button className="button-primary" onClick={onCreate}>Create a quote <Icon name="arrow" size={14} /></button></div>;
}

function relativeTime(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default App;
