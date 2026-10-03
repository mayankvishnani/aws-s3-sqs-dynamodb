export type QuoteStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface QuoteInput {
    businessName: string;
    industry: string;
    annualRevenue: number;
    state: string;
}

export interface CarrierQuote {
    carrier: string;
    premium: number;
    currency: "USD";
    coverageLimit: number;
}

export interface QuoteMessage{
    quoteId: string;
}