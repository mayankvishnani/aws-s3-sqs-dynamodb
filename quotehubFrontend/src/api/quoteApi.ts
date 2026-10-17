import type { Quote, QuoteInput, QuoteStatus } from "../types/quote";

type ApiError = { error?: string; errors?: { message?: string }[] };
type UploadResponse = { key: string; url: string };

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

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

export async function fetchQuote(quoteId: string): Promise<Quote> {
  const quote = await request<Quote>(`/quotes/${encodeURIComponent(quoteId)}`);
  return { ...quote, results: Array.isArray(quote.results) ? quote.results : [] };
}

export async function fetchAllQuotes(): Promise<Quote[]> {
  const response = await request<{ quotes: Quote[] }>("/allQuotes");
  return response.quotes.map((quote) => ({
    ...quote,
    results: Array.isArray(quote.results) ? quote.results : [],
  }));
}

export async function submitQuote(input: QuoteInput, file?: File): Promise<Quote> {
  let documentKey: string | undefined;
  if (file) {
    const contentType = file.type || "application/octet-stream";
    const upload = await request<UploadResponse>("/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType }),
    });
    const signed = new URL(upload.url);
    const uploaded = await fetch(`/s3${signed.pathname}${signed.search}`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!uploaded.ok) {
      throw new Error(`Document upload failed (${uploaded.status}). Check the Floci S3 service and try again.`);
    }

    documentKey = upload.key;
  }

  const created = await request<{ quoteId: string; status: QuoteStatus }>("/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, ...(documentKey ? { documentKey } : {}) }),
  });

  return {
    ...created,
    input,
    ...(documentKey ? { documentKey } : {}),
    createdAt: new Date().toISOString(),
    results: [],
  };
}

export async function updateQuote(quoteId: string, input: QuoteInput): Promise<Quote> {
  return request<Quote>(`/quotes/${encodeURIComponent(quoteId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
