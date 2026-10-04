import type { Message } from "@aws-sdk/client-sqs";
import { carriers } from "../services/carriers/mock-carriers";
import { getQuoteItems, saveCarrierResult, setStatus } from "../infrastructure/aws/dynamodb/quote-repository";
import { deleteMessage, receiveMessages } from "../infrastructure/aws/sqs/quote-queue";
import type { CarrierQuote, QuoteInput, QuoteMessage } from "../shared/types";

async  function handle(message: Message): Promise<void> {
    const { quoteId } = JSON.parse(message.Body ?? "{}") as QuoteMessage;
    const items = await getQuoteItems(quoteId);
    const meta = items.find((item) => item.sk === "META");
    if (!meta) throw new Error(`quote ${quoteId} not found`);
    const input = meta.input as QuoteInput;

    await setStatus(quoteId, "PROCESSING");

    const settled = await Promise.allSettled(
        carriers.map((carrier) => carrier.getQuote(input))
    );

    const success: CarrierQuote[] = [];
    settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
            success.push(result.value);
        } else {
            console.error(`carrier ${carriers[index]?.name ?? "unknown"} failed:`, result.reason);
        }
    })

    if(success.length === 0) {
        throw new Error(`all carriers failed for quote ${quoteId}`);
    }

    await Promise.all(success.map((quote) => saveCarrierResult(quoteId, quote)));
    await setStatus(quoteId, "COMPLETED");
}

let running = true;
process.on("SIGINT", () => {
  console.log("stopping after the current batch...");
  running = false;
});

async function main(): Promise<void> {
    console.log("worker started");
    while(running) {
        const messages = await receiveMessages();
        for (const message of messages) {
            try {
                await handle(message);
                await deleteMessage(message.ReceiptHandle!);
            } catch (err) {
                console.error("Handling failed message will be retried:", err);
            }
        }
    }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});