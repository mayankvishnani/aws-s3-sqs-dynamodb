import { randomUUID } from "node:crypto";
import express from "express";
import { input, z } from "zod";
import { createQuote, getQuoteItems } from "./db";
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