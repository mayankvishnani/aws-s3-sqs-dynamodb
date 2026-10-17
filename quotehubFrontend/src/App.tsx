import { useQuoteHub } from "./hooks/useQuoteHub";
import { Footer } from "./components/layout/Footer";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { OverviewPage } from "./components/overview/OverviewPage";
import { QuoteModal } from "./components/quotes/QuoteModal";
import { QuotesPage } from "./components/quotes/QuotesPage";
import { AlertMessage } from "./components/ui/AlertMessage";
import "./styles.css";

function App() {
  const quoteHub = useQuoteHub();
  const showOverview = () => quoteHub.navigate("overview");
  const showQuotes = () => quoteHub.navigate("quotes");

  return (
    <div className="app-shell">
      <Sidebar
        activeView={quoteHub.activeView}
        quoteCount={quoteHub.stats.total}
        onNavigate={quoteHub.navigate}
      />
      <main className="main-area">
        <TopBar
          pageTitle={quoteHub.activeView === "overview" ? "Overview" : "My quotes"}
          now={quoteHub.now}
        />
        <div className="content">
          <AlertMessage
            error={quoteHub.error}
            notice={quoteHub.notice}
            onDismiss={quoteHub.dismissMessage}
          />
          {quoteHub.activeView === "overview" ? (
            <OverviewPage
              stats={quoteHub.stats}
              quotes={quoteHub.quotes}
              loading={quoteHub.loading}
              onSubmitQuote={quoteHub.createQuote}
              onSelectQuote={quoteHub.selectQuote}
              onSeeAllQuotes={showQuotes}
            />
          ) : (
            <QuotesPage
              quotes={quoteHub.allQuotes}
              now={quoteHub.now}
              loading={quoteHub.allQuotesLoading}
              onFindQuote={quoteHub.findQuote}
              onSelectQuote={quoteHub.selectQuote}
              onCreateQuote={showOverview}
            />
          )}
          <Footer />
        </div>
      </main>
      {quoteHub.selectedQuote && (
        <QuoteModal
          quote={quoteHub.selectedQuote}
          summary={quoteHub.selectedSummary}
          refreshing={quoteHub.refreshing}
          onRefresh={quoteHub.refreshSelectedQuote}
          updating={quoteHub.updatingQuote}
          onUpdateQuote={quoteHub.editQuote}
          onClose={quoteHub.closeQuote}
        />
      )}
    </div>
  );
}

export default App;
