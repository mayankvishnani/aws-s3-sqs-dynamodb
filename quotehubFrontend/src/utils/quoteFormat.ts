import type { QuoteStatus } from "../types/quote";

const STORAGE_KEY = "quotehub.recent-quotes";
const statusOrder: QuoteStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

export function readSavedQuotes() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (item): item is import("../types/quote").QuoteSummary =>
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

export function saveRecentQuotes(quotes: import("../types/quote").QuoteSummary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
}

export function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function relativeTime(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
