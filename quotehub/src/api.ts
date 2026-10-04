import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { createQuote, getAllQuoteItems, getQuoteItems } from "./db";
import { enqueueQuote } from "./queue";
import { createDownloadUrl, createUploadUrl } from "./s3";

const app = express();
app.use(express.json());

const uploadSchema = z.object({ contentType: z.string().min(1) });
const quoteSchema = z.object({ 
    businessName: z.string().min(1),
    industry: z.string().min(1),
    annualRevenue: z.number().positive(),
    state: z.string().length(2),
    documentKey: z.string().optional(),
});

app.post("/uploads", async (req, res) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.issues });
    }
    res.json(await createUploadUrl(parsed.data.contentType));
})

app.post("/quotes", async (req, res) => {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ errors: parsed.error.issues });
    }
    const { documentKey,...input } = parsed.data;
    const quoteId = randomUUID();
    await createQuote(quoteId, input, documentKey);
    await enqueueQuote({ quoteId });
    res.status(202).json({ quoteId, status: "PENDING" });
})

app.get("/allQuotes", async (_req, res) => {
    const items = await getAllQuoteItems();
    const itemsByQuote = new Map<string, Record<string, any>[]>();

    for (const item of items) {
        if (typeof item.pk !== "string" || !item.pk.startsWith("QUOTE#")) continue;
        const quoteItems = itemsByQuote.get(item.pk) ?? [];
        quoteItems.push(item);
        itemsByQuote.set(item.pk, quoteItems);
    }

    const quotes = [];
    for (const [partitionKey, quoteItems] of itemsByQuote) {
        const meta = quoteItems.find((item) => item.sk === "META");
        if (!meta) continue;

        quotes.push({
            quoteId: partitionKey.slice("QUOTE#".length),
            status: meta.status,
            input: meta.input,
            documentKey: meta.documentKey,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
            results: quoteItems
                .filter((item) => typeof item.sk === "string" && item.sk.startsWith("RESULT#"))
                .map(({ pk: _pk, sk: _sk, ...result }) => result),
        });
    }

    quotes.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    res.json({ quotes });
});

app.get("/quotes/:id", async (req, res) => {
    const items = await getQuoteItems(req.params.id);
    const meta = items.find((item) => item.sk === "META");
    if (!meta) {
        return res.status(404).json({ error: "quote not found" });
    }
    const results = items.filter((item) => item.sk.startsWith("RESULT#"));
    const documentUrl = meta.documentKey ? await createDownloadUrl(meta.documentKey) : undefined;
    res.json({
        quoteId: req.params.id,
        status: meta.status,
        input: meta.input,
        documentKey: meta.documentKey,
        results: results.map(({ pk, sk, ...rest }) => rest),
        documentUrl,
    });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

app.listen(3000, () => console.log("API on http://localhost:3000"));