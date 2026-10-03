import { randomUUID } from "node:crypto";
import { createQuote, getQuoteItems, saveCarrierResult, setStatus } from "./db";
import type { CarrierQuote, QuoteInput } from "./types";

async function main(): Promise<void> {
  const quoteId = randomUUID();
  const input: QuoteInput = {
    businessName: "Acme Manufacturing",
    industry: "Manufacturing",
    annualRevenue: 2_500_000,
    state: "CA",
  };
  const carrierResults: CarrierQuote[] = [
    {
      carrier: "Acme Mutual",
      premium: 12_500,
      currency: "USD",
      coverageLimit: 1_000_000,
    },
    {
      carrier: "Globex Insurance",
      premium: 14_200,
      currency: "USD",
      coverageLimit: 1_000_000,
    },
  ];

  await createQuote(quoteId, input);
  for (const result of carrierResults) {
    await saveCarrierResult(quoteId, result);
  }
  await setStatus(quoteId, "COMPLETED");

  const items = await getQuoteItems(quoteId);
  console.log(JSON.stringify({ quoteId, items }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
