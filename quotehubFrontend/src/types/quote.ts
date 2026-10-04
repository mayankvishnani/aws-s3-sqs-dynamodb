export type QuoteStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type CarrierResult = {
  carrier: string;
  premium: number;
  currency: string;
  coverageLimit: number;
};

export type QuoteInput = {
  businessName: string;
  industry: string;
  annualRevenue: number;
  state: string;
};

export type Quote = {
  quoteId: string;
  status: QuoteStatus;
  input?: QuoteInput;
  documentKey?: string;
  documentUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  results: CarrierResult[];
};

export type QuoteSummary = {
  quoteId: string;
  status: QuoteStatus;
  businessName: string;
  industry: string;
  createdAt: number;
};

export type QuoteStats = {
  total: number;
  complete: number;
  pending: number;
};

export type QuoteView = "overview" | "quotes";
