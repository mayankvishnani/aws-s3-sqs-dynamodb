# Long-Weekend Plan: Learn AWS S3 + DynamoDB + SQS with TypeScript

**Goal:** by Monday you have a working TypeScript/Node backend on GitHub that you can explain line by line in an interview, and that mirrors what CoverForce's Backend role describes: a unified API in front of several carrier APIs, with async processing.

**Reference project: "QuoteHub"** (a mini version of CoverForce's core idea)

A client asks for an insurance quote. Your API accepts the request instantly, puts it on a queue, and a background worker asks three (mock) insurance carriers for prices and stores the results. The client polls for the answer. A document (for example a business license PDF or an invoice image) can be uploaded straight to S3.

Why this project: every AWS service you need has a natural job in it, and it matches the job description ("designing a strategy to develop a unified commercial insurance API to work with multiple carriers").

| Service | Its job in QuoteHub |
|---|---|
| **S3** | Stores uploaded documents. The browser uploads straight to S3 using a presigned URL, so files never pass through your server. |
| **DynamoDB** | Stores quote requests and each carrier's result. |
| **SQS** | Decouples the API from the slow carrier calls. The API enqueues, the worker processes. |

You already built a reimbursement portal with invoice images, so the S3 part is something you can relate to: it is the same problem with a better storage design.

---

## 0. Honest ground rules

- **Do not claim S3, DynamoDB, SQS or TypeScript on your resume until this repo exists and runs.** After that you can say it truthfully and show the link.
- Everything below is written in **strict TypeScript**. Do not use `any` except in the one error-handling helper that is marked.
- Commit to Git after each day. A commit history that shows steady progress looks real, because it is.
- If you get stuck for more than 30 minutes on one problem, write the error message down and move on to the next task. Come back later or ask me.

---

## 1. Schedule (adjust to your long weekend)

| Day | Focus | Done when |
|---|---|---|
| **Day 1** | Setup, Floci, S3 | You can get a presigned URL, upload a file with `curl`, and see it in the bucket |
| **Day 2** | DynamoDB | You can create a quote and read it back with a single Query |
| **Day 3** | SQS and the worker | `POST /quotes` returns instantly, the worker fills in carrier results later |
| **Day 4** | Failure handling, tests, README, interview prep | You can break the system on purpose and explain what happens |

If you only have three days, merge Day 4 into the end of Day 3 and skip the stretch tasks.

---

## 2. Day 1: Setup and S3

### 2.1 Learn first (30 minutes of reading, no code)

**S3 in plain words**
- A **bucket** is a top-level container with a globally unique name.
- An **object** is a file plus metadata. Its **key** is its full name, such as `uploads/abc123`. S3 has no real folders; slashes in a key are just characters that the console draws as folders.
- You normally never make a bucket public. Instead you hand out a **presigned URL**: a temporary link, signed with your credentials, that allows exactly one action (upload or download) on exactly one key for a limited time.
- Why presigned URLs matter: if the file goes browser → your server → S3, your server pays for the bandwidth and memory. With a presigned URL it goes browser → S3 directly, and your server only signs.

### 2.2 Floci local AWS emulator

Use Floci for every AWS service in this project. Floci is a local AWS emulator that provides S3, DynamoDB, and SQS at `http://localhost:4566`; this plan does not use a real AWS account.

Before coding, install and verify:

- Docker Desktop and the AWS CLI.
- The Floci CLI for Windows: `iwr https://floci.io/install.ps1 | iex` (or install it with Scoop).

Start Floci in PowerShell:

```powershell
floci doctor
floci start --services s3,dynamodb,sqs --persist .\floci-data
floci wait --service dynamodb
floci env --shell powershell | Invoke-Expression
```

The `floci env` command sets the local AWS endpoint, region, and throwaway credentials for the current PowerShell session. Repeat it in every new terminal that runs the AWS CLI. If you use Bash instead, run `eval $(floci env)`.

The equivalent Docker Compose setup is:

```yaml
services:
  floci:
    image: floci/floci:latest
    ports:
      - "4566:4566"
```

Run it with `docker compose up -d`, then set the AWS environment variables with `floci env --shell powershell | Invoke-Expression`. Prefer the CLI flow above because it also gives you `floci wait`, `floci doctor`, and persistence options.

**Local-only rule:** do not add a `USE_LOCALSTACK` switch, real AWS credentials, `aws configure`, or a real AWS deployment step to this project. Every SDK and CLI command must target Floci.

### 2.3 Project setup

```bash
mkdir quotehub && cd quotehub
npm init -y
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
      @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb \
      @aws-sdk/client-sqs express zod
npm i -D typescript tsx @types/node @types/express
npx tsc --init
```

What each package is:
- `@aws-sdk/client-*` are the AWS SDK v3 clients. In v3 every service is a separate package, so you only install what you use.
- `@aws-sdk/s3-request-presigner` creates presigned URLs.
- `@aws-sdk/lib-dynamodb` is a friendlier DynamoDB layer: you pass normal JavaScript objects instead of DynamoDB's `{ S: "text" }` format.
- `express` is the HTTP server. You already know it. `zod` validates incoming JSON.
- `tsx` runs TypeScript directly with no build step while you learn.

Edit `tsconfig.json` so it contains at least:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- `"strict": true` turns on all of TypeScript's safety checks. This is the whole point of using TypeScript, so never turn it off.
- `"module": "CommonJS"` keeps imports simple (no `.js` extensions needed).

Add scripts to `package.json`:

```json
"scripts": {
  "setup": "tsx src/setup.ts",
  "api": "tsx src/api.ts",
  "worker": "tsx src/worker.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
}
```

Folder layout you will end up with:

```
quotehub/
  docker-compose.yml
  src/
    config.ts      # names and endpoints
    clients.ts     # AWS clients, created once
    types.ts       # shared TypeScript types
    setup.ts       # creates bucket, table, queues
    s3.ts          # presigned URLs
    db.ts          # DynamoDB functions
    queue.ts       # SQS functions
    carriers.ts    # fake carrier APIs
    api.ts         # Express server
    worker.ts      # queue consumer
```

### 2.4 `src/config.ts`

```ts
export const config = {
  region: "us-east-1",
  bucket: "quotehub-documents",
  table: "QuoteHub",
  queueName: "quote-requests",
  dlqName: "quote-requests-dlq",
};

// Settings shared by every AWS client. These credentials and the endpoint are Floci-only.
export const awsClientConfig = {
  region: config.region,
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
};
```

Line by line:
- `config` holds every resource name in one place. A typo in a name is a common bug, so you never retype them.
- `endpoint` redirects every SDK request to Floci on your laptop.

### 2.5 `src/clients.ts`

```ts
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { awsClientConfig, isLocal } from "./config";

// forcePathStyle keeps presigned URLs reachable through Floci on localhost.
export const s3 = new S3Client({ ...awsClientConfig, forcePathStyle: true });

export const sqs = new SQSClient(awsClientConfig);

// The raw client speaks DynamoDB's typed format; the DocumentClient wraps it so we use plain objects.
export const rawDdb = new DynamoDBClient(awsClientConfig);
export const ddb = DynamoDBDocumentClient.from(rawDdb, {
  marshallOptions: { removeUndefinedValues: true }, // DynamoDB rejects `undefined`; this drops those fields
});
```

Why create clients once at the top of a file: each client sets up connections and credentials. Creating one per request is slow and wasteful.

### 2.6 `src/types.ts`

```ts
export type QuoteStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface QuoteInput {
  businessName: string;
  industry: string;
  annualRevenue: number;
  state: string;       // two-letter US state code
}

export interface CarrierQuote {
  carrier: string;
  premium: number;
  currency: "USD";
  coverageLimit: number;
}

// The message we put on the queue. It carries only an id, never the full data.
export interface QuoteMessage {
  quoteId: string;
}
```

- A union type like `QuoteStatus` means TypeScript will refuse any status string you misspell.
- The queue message holds only an id on purpose. The data lives in DynamoDB, so the message stays tiny and never goes stale.

### 2.7 `src/setup.ts` (creates the AWS resources)

```ts
import { CreateBucketCommand } from "@aws-sdk/client-s3";
import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { CreateQueueCommand, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { s3, rawDdb, sqs } from "./clients";
import { config } from "./config";

// Run a creation step, but treat "already exists" as success so the script can be run twice.
async function safely(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.log(`created ${label}`);
  } catch (err: any) {                       // the one allowed `any`: AWS errors have a `name` field
    if (["BucketAlreadyOwnedByYou", "ResourceInUseException"].includes(err.name)) {
      console.log(`${label} already exists`);
    } else {
      throw err;                             // anything else is a real problem, so fail loudly
    }
  }
}

async function main(): Promise<void> {
  await safely("bucket", () => s3.send(new CreateBucketCommand({ Bucket: config.bucket })));

  await safely("table", () =>
    rawDdb.send(
      new CreateTableCommand({
        TableName: config.table,
        BillingMode: "PAY_PER_REQUEST",      // on-demand: no capacity planning, you pay per request
        AttributeDefinitions: [              // only key attributes are declared up front
          { AttributeName: "pk", AttributeType: "S" },   // S = string
          { AttributeName: "sk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },      // partition key
          { AttributeName: "sk", KeyType: "RANGE" },     // sort key
        ],
      }),
    ),
  );

  // 1) the dead-letter queue, where messages go after repeated failure
  const dlq = await sqs.send(new CreateQueueCommand({ QueueName: config.dlqName }));
  const dlqAttrs = await sqs.send(
    new GetQueueAttributesCommand({ QueueUrl: dlq.QueueUrl, AttributeNames: ["QueueArn"] }),
  );
  const dlqArn = dlqAttrs.Attributes?.QueueArn;
  if (!dlqArn) throw new Error("could not read DLQ ARN");

  // 2) the main queue, pointed at the DLQ
  await sqs.send(
    new CreateQueueCommand({
      QueueName: config.queueName,
      Attributes: {                                      // SQS attribute values must all be strings
        VisibilityTimeout: "30",                         // seconds a message stays hidden while a worker handles it
        ReceiveMessageWaitTimeSeconds: "20",             // long polling: wait up to 20s for a message
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: dlqArn,
          maxReceiveCount: 3,                            // after 3 failed receives, move to the DLQ
        }),
      },
    }),
  );
  console.log("queues ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Key ideas inside:
- **Partition key (`pk`) and sort key (`sk`):** DynamoDB finds an item by its partition key. The sort key orders items that share one partition key. Together they are the item's unique identity.
- **`PAY_PER_REQUEST`:** nothing to size or tune while you learn.
- **ARN:** Amazon Resource Name, the unique id of an AWS resource. The main queue needs the DLQ's ARN to know where failed messages go.

Run it: `npm run setup`

### 2.8 `src/s3.ts`

```ts
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./clients";
import { config } from "./config";

// Give the client a one-time link to upload a file directly to S3.
export async function createUploadUrl(contentType: string): Promise<{ key: string; url: string }> {
  const key = `uploads/${randomUUID()}`;     // random key, so users cannot overwrite each other's files
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,                // the upload must send this exact Content-Type header
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // link dies after 5 minutes
  return { key, url };
}

// Temporary link to view or download a stored file.
export async function createDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 300 });
}
```

Notes:
- `getSignedUrl` does not call S3. It signs locally with your credentials, so it is fast.
- `Command` objects (`PutObjectCommand`) describe a request. `client.send(command)` actually runs it. This pattern is the same for every AWS service in SDK v3.
- You keep the **key** in your database, not the URL, because URLs expire.

### 2.9 Day 1 tasks and test

1. Run `floci status`, confirm `aws --endpoint-url=http://localhost:4566 s3 ls` works, then run `npm run setup`. Write a tiny `src/try-s3.ts` that calls `createUploadUrl("image/png")` and prints the result.
2. Upload a file with the printed URL:
   ```bash
   curl -X PUT -H "Content-Type: image/png" --upload-file invoice.png "<paste url here>"
   ```
3. Confirm it arrived. With the AWS CLI: `aws --endpoint-url=http://localhost:4566 s3 ls s3://quotehub-documents/uploads/`
4. Change the Content-Type in the curl command and watch the upload fail. This shows that the signature really restricts the request.

**Day 1 checkpoint question to answer in your own words:** why do we upload straight to S3 instead of through our API?

---

## 3. Day 2: DynamoDB

### 3.1 Learn first

**DynamoDB in plain words**
- It is a key-value and document database. There are no joins and no ad-hoc queries. You design the table around the questions you will ask.
- **Get/Query** use the key and are fast and cheap. **Scan** reads the whole table. Avoid Scan in real code.
- **Single-table design:** related items share a partition key and are told apart by the sort key. We use it here.

Our table layout:

| pk | sk | What it holds |
|---|---|---|
| `QUOTE#<id>` | `META` | status, the quote input, timestamps, optional document key |
| `QUOTE#<id>` | `RESULT#Acme Mutual` | one carrier's answer |
| `QUOTE#<id>` | `RESULT#Globex Insurance` | another carrier's answer |

One **Query** on `pk = QUOTE#<id>` returns the metadata and all carrier results together. That is the main benefit of this design.

### 3.2 `src/db.ts`

```ts
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./clients";
import { config } from "./config";
import type { CarrierQuote, QuoteInput, QuoteStatus } from "./types";

const pk = (quoteId: string) => `QUOTE#${quoteId}`;   // one helper so the key format lives in one place

export async function createQuote(
  quoteId: string,
  input: QuoteInput,
  documentKey?: string,
): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: config.table,
      Item: {
        pk: pk(quoteId),
        sk: "META",
        status: "PENDING" satisfies QuoteStatus,
        input,
        documentKey,                                  // may be undefined; removeUndefinedValues drops it
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(pk)", // refuse to overwrite an existing quote
    }),
  );
}

export async function setStatus(quoteId: string, status: QuoteStatus): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: config.table,
      Key: { pk: pk(quoteId), sk: "META" },
      UpdateExpression: "SET #s = :s, updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status" },   // "status" is a DynamoDB reserved word, so we alias it
      ExpressionAttributeValues: { ":s": status, ":u": new Date().toISOString() },
    }),
  );
}

export async function saveCarrierResult(quoteId: string, result: CarrierQuote): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: config.table,
      Item: { pk: pk(quoteId), sk: `RESULT#${result.carrier}`, ...result },
    }),
  );
}

// One query returns the META item and every carrier result for this quote.
export async function getQuoteItems(quoteId: string): Promise<Record<string, any>[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: config.table,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk(quoteId) },
    }),
  );
  return out.Items ?? [];
}
```

Line by line, the parts that confuse people:
- **`ConditionExpression: "attribute_not_exists(pk)"`** makes the Put fail if the item exists. This is how DynamoDB does "insert only", and a good example of a conditional write.
- **`ExpressionAttributeNames`:** DynamoDB reserves words such as `status`. You write `#s` in the expression and map it to the real name. You will hit this error constantly, so remember it.
- **`ExpressionAttributeValues`:** values are never written into the expression string. You write `:s` and supply the value separately. This avoids injection problems and mixed types.
- **`saveCarrierResult` is idempotent:** saving the same carrier twice just overwrites the same key. This matters on Day 3, because SQS can deliver a message more than once.
- **`out.Items ?? []`:** Query returns `undefined` when empty, so we default to an empty list.

### 3.3 Day 2 tasks and test

1. Write `src/try-db.ts` that creates a quote, saves two carrier results, sets the status to `COMPLETED`, then prints `getQuoteItems(id)`.
2. Check the data with the CLI:
   ```bash
   aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name QuoteHub
   ```
   (Scan is fine here, only because the table is tiny and it is for debugging.)
3. Experiment: call `createQuote` twice with the same id and read the `ConditionalCheckFailedException`.
4. Experiment: remove the `#s` alias and read the reserved-word error. Then put it back.

**Day 2 checkpoint question:** why is there one Query instead of three Gets, and what happens to cost and speed as the table grows if you use Scan instead?

---

## 4. Day 3: SQS, carriers, worker, API

### 4.1 Learn first

**SQS in plain words**
- A queue holds messages between a **producer** (our API) and a **consumer** (our worker).
- **Standard queues** deliver messages **at least once**, so a message can arrive twice and order is not guaranteed. Your code must be **idempotent** (doing it twice is harmless). FIFO queues add ordering at a cost.
- **Receive then delete:** a worker receives a message, which hides it for the **visibility timeout**. If the worker finishes, it **deletes** the message. If it crashes or never deletes, the message reappears and another try happens.
- **Dead-letter queue (DLQ):** after `maxReceiveCount` failed receives, SQS moves the message to the DLQ so one bad message does not loop forever.
- **Long polling** (`WaitTimeSeconds`) makes the receive call wait for messages instead of hammering SQS with empty requests.

### 4.2 `src/carriers.ts` (fake carrier APIs)

```ts
import type { CarrierQuote, QuoteInput } from "./types";

export interface Carrier {
  name: string;
  getQuote(input: QuoteInput): Promise<CarrierQuote>;
}

// Build a fake carrier with its own price rate and failure rate.
function mockCarrier(name: string, rate: number, failureRate: number): Carrier {
  return {
    name,
    async getQuote(input) {
      // Real carrier APIs are slow, so wait 300-1000 ms.
      await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700));
      if (Math.random() < failureRate) throw new Error(`${name} API timeout`);
      return {
        carrier: name,
        premium: Math.round(input.annualRevenue * rate),
        currency: "USD",
        coverageLimit: 1_000_000,
      };
    },
  };
}

export const carriers: Carrier[] = [
  mockCarrier("Acme Mutual", 0.004, 0),
  mockCarrier("Globex Insurance", 0.0035, 0.3),   // fails 30% of the time on purpose
  mockCarrier("Initech Specialty", 0.005, 0),
];
```

This is the heart of the job description. The `Carrier` interface is the **adapter pattern**: every carrier hides its own quirks behind one common shape, so the rest of your code never cares which carrier it is talking to. Adding a fourth carrier is one new line. Say this in the interview.

### 4.3 `src/queue.ts`

```ts
import {
  DeleteMessageCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  type Message,
} from "@aws-sdk/client-sqs";
import { sqs } from "./clients";
import { config } from "./config";
import type { QuoteMessage } from "./types";

let cachedUrl: string | undefined;

// SQS operations need the queue's URL, which we look up by name once and remember.
async function getQueueUrl(): Promise<string> {
  if (!cachedUrl) {
    const out = await sqs.send(new GetQueueUrlCommand({ QueueName: config.queueName }));
    if (!out.QueueUrl) throw new Error("queue not found. Did you run `npm run setup`?");
    cachedUrl = out.QueueUrl;
  }
  return cachedUrl;
}

export async function enqueueQuote(message: QuoteMessage): Promise<void> {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: await getQueueUrl(),
      MessageBody: JSON.stringify(message),   // SQS bodies are plain strings, so we serialise to JSON
    }),
  );
}

export async function receiveMessages(): Promise<Message[]> {
  const out = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: await getQueueUrl(),
      MaxNumberOfMessages: 5,                 // take up to 5 at a time
      WaitTimeSeconds: 20,                    // long polling
    }),
  );
  return out.Messages ?? [];
}

export async function deleteMessage(receiptHandle: string): Promise<void> {
  await sqs.send(
    new DeleteMessageCommand({ QueueUrl: await getQueueUrl(), ReceiptHandle: receiptHandle }),
  );
}
```

- **`ReceiptHandle`** is a token for one specific receive of a message. You need it to delete that message.
- Nothing is deleted automatically. This is what makes retries possible.

### 4.4 `src/worker.ts`

```ts
import type { Message } from "@aws-sdk/client-sqs";
import { carriers } from "./carriers";
import { getQuoteItems, saveCarrierResult, setStatus } from "./db";
import { deleteMessage, receiveMessages } from "./queue";
import type { CarrierQuote, QuoteInput, QuoteMessage } from "./types";

async function handle(message: Message): Promise<void> {
  const { quoteId } = JSON.parse(message.Body ?? "{}") as QuoteMessage;

  const items = await getQuoteItems(quoteId);
  const meta = items.find((item) => item.sk === "META");
  if (!meta) throw new Error(`quote ${quoteId} not found`);
  const input = meta.input as QuoteInput;

  await setStatus(quoteId, "PROCESSING");

  // Ask all carriers at the same time. allSettled never throws, it reports each result.
  const settled = await Promise.allSettled(carriers.map((c) => c.getQuote(input)));

  const successes: CarrierQuote[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") successes.push(result.value);
    else console.warn(`${carriers[index].name} failed: ${result.reason}`);
  });

  if (successes.length === 0) {
    // Throwing means: do NOT delete the message. SQS will retry, and later send it to the DLQ.
    throw new Error(`all carriers failed for quote ${quoteId}`);
  }

  await Promise.all(successes.map((quote) => saveCarrierResult(quoteId, quote)));
  await setStatus(quoteId, "COMPLETED");   // partial results are still a useful answer
}

let running = true;
process.on("SIGINT", () => {
  console.log("stopping after the current batch...");
  running = false;                          // finish current work, then exit cleanly
});

async function main(): Promise<void> {
  console.log("worker started");
  while (running) {
    const messages = await receiveMessages();
    for (const message of messages) {
      try {
        await handle(message);
        await deleteMessage(message.ReceiptHandle!);   // only delete after full success
      } catch (err) {
        console.error("handling failed, message will be retried:", err);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Reasoning behind the choices:
- **`Promise.allSettled`** lets the quote succeed even when one carrier is down. That is realistic: real carrier APIs fail, and a good aggregator still returns what it has.
- **Delete only after success** gives at-least-once processing. Because `saveCarrierResult` overwrites the same key, running twice is safe.
- **Known gap (a good Day 4 task):** if a message ends in the DLQ, the quote stays `PROCESSING` forever. Think about how you would mark it `FAILED`.

### 4.5 `src/api.ts`

```ts
import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
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

// Step 1: ask where to upload a document.
app.post("/uploads", async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  res.json(await createUploadUrl(parsed.data.contentType));
});

// Step 2: create a quote request. Returns immediately; the work happens in the worker.
app.post("/quotes", async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });

  const { documentKey, ...input } = parsed.data;     // split the optional key from the quote fields
  const quoteId = randomUUID();
  await createQuote(quoteId, input, documentKey);    // save first...
  await enqueueQuote({ quoteId });                   // ...then queue, so the worker always finds the data
  res.status(202).json({ quoteId, status: "PENDING" }); // 202 = accepted, not finished
});

// Step 3: poll for the result.
app.get("/quotes/:id", async (req, res) => {
  const items = await getQuoteItems(req.params.id);
  const meta = items.find((item) => item.sk === "META");
  if (!meta) return res.status(404).json({ error: "quote not found" });

  const results = items.filter((item) => String(item.sk).startsWith("RESULT#"));
  const documentUrl = meta.documentKey ? await createDownloadUrl(meta.documentKey) : undefined;
  res.json({
    quoteId: req.params.id,
    status: meta.status,
    input: meta.input,
    results: results.map(({ pk, sk, ...rest }) => rest), // hide internal keys
    documentUrl,
  });
});

// Express 5 forwards errors from async handlers here.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

app.listen(3000, () => console.log("API on http://localhost:3000"));
```

Why it is built this way:
- **`202 Accepted`:** the honest status code for "I got it, it is not done yet".
- **Save before enqueue:** if you enqueue first, the worker might run before the data exists.
- **Validation with zod:** bad input is rejected at the door with a clear message.
- **Install note:** `npm i express` installs Express 5 at the time of writing. If you end up on Express 4, async errors will not reach the error handler by themselves, so check `npm ls express`.

### 4.6 Day 3 tasks and test

Open two terminals: `npm run api` and `npm run worker`. Then:

```bash
# 1) ask for an upload URL
curl -s -X POST localhost:3000/uploads -H "Content-Type: application/json" \
  -d '{"contentType":"application/pdf"}'

# 2) upload a file to the returned url (see Day 1), then create a quote with its key
curl -s -X POST localhost:3000/quotes -H "Content-Type: application/json" \
  -d '{"businessName":"Joe Bakery","industry":"food","annualRevenue":500000,"state":"NY","documentKey":"uploads/<key>"}'

# 3) poll a few times
curl -s localhost:3000/quotes/<quoteId>
```

You should see `PENDING`, then `COMPLETED` with two or three carrier results. Run it several times: sometimes Globex will be missing, and that is the point.

**Day 3 checkpoint question:** what happens if the worker crashes after saving results but before deleting the message?

---

## 5. Day 4: Make it robust, then make it yours

### 5.1 Break it on purpose (this is what interviewers love)

1. **Force total failure:** set all failure rates to `1`. Watch the message retry 3 times, then land in the DLQ:
   ```bash
   aws --endpoint-url=http://localhost:4566 sqs receive-message \
     --queue-url http://localhost:4566/000000000000/quote-requests-dlq
   ```
   (The queue URL may differ, so get yours with `aws sqs list-queues` and the same endpoint flag.)
2. **Kill the worker mid-processing** (Ctrl+C twice or `kill -9`) and watch the message come back after the visibility timeout.
3. **Duplicate delivery:** send the same message twice by hand and prove the result is unchanged.
4. **Fix the DLQ gap:** write a small second worker (or extend this one) that reads the DLQ and marks those quotes `FAILED`.

### 5.2 Add tests

- Install `vitest` with `npm i -D vitest`, then write unit tests for the pure parts: the carrier adapters, and the logic that decides `COMPLETED` versus a thrown error. Extract that decision into a small pure function if it is still embedded in the worker.
- Test the DynamoDB functions against Floci. Use a fresh Floci state or unique test resource names so tests do not depend on leftovers from manual runs.
- Run `npm run typecheck` before starting the API and worker, then run `npm test`.
- Put `npm run typecheck` and `npm test` in a GitHub Actions workflow under `.github/workflows/ci.yml`; start Floci in the workflow before integration tests and stop it afterward.

### 5.3.1 Missing checks before calling the project done

- **Prerequisites:** document the required Node.js, Docker Desktop, AWS CLI, and Floci CLI versions, then run `floci doctor`.
- **Readiness:** start Floci and wait for it before `npm run setup`; do not rely on a fixed sleep.
- **Configuration:** verify the SDK, AWS CLI, and presigned URL all use `http://localhost:4566` and `us-east-1`.
- **Happy path:** verify upload, quote creation, asynchronous processing, polling, and carrier results.
- **Failure paths:** verify invalid input returns `400`, a missing quote returns `404`, partial carrier failure still completes, total failure reaches the DLQ, and a worker restart retries the message.
- **Consistency:** test when DynamoDB succeeds but SQS enqueue fails; decide whether to mark the quote `FAILED` or add a recovery mechanism instead of leaving it `PENDING` forever.
- **Repeatability:** run setup twice and confirm it is safe; run tests against clean Floci state or isolated names.
- **Teardown:** stop Floci and remove its persisted `floci-data` directory when a clean reset is needed.

### 5.3 Write the README (this is part of the deliverable)

Include:
- A diagram (even ASCII) of: client → API → DynamoDB + SQS → worker → carriers.
- How to run it in 4 commands.
- A **"Design decisions"** section: presigned URLs, single-table design, at-least-once plus idempotency, DLQ, `allSettled` partial results.
- A **"What I would do next"** section: authentication, FIFO queues or deduplication ids, a real database index for listing quotes by customer, structured logs, retries with backoff, Terraform or CDK.

### 5.4 Stretch goals (only if time remains)

- Add a **GSI** (global secondary index) so you can list all quotes for one business.
- Add **retry with exponential backoff** inside each carrier call.
- Add a **webhook** that your API calls when a quote completes (the job description mentions partner integrations).
- Try a second Floci instance or a persisted state snapshot only after the core flow works.

---

## 6. IAM in two minutes (interview theory only)

IAM controls who can do what in AWS. The rule is **least privilege**: grant only what is needed. For this app:

This policy is an interview exercise, not a setup step. Do not create an AWS account or apply it to real AWS for this project; Floci uses local throwaway credentials.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::quotehub-documents/*" },
    { "Effect": "Allow", "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:us-east-1:<account-id>:table/QuoteHub" },
    { "Effect": "Allow", "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueUrl"],
      "Resource": "arn:aws:sqs:us-east-1:<account-id>:quote-requests" }
  ]
}
```

Be ready to explain why you would not use admin keys in production, and why code running on AWS (Lambda, ECS, EC2) should use a **role**, not stored access keys. Never commit access keys to Git.

---

## 7. Interview cheat sheet

Practise answering these out loud, in your own words:

1. Why upload with a presigned URL instead of through the API?
2. Why does the API return `202` and not `200`?
3. What does "at-least-once delivery" mean, and how does your code cope?
4. What is a visibility timeout? What breaks if it is shorter than your processing time?
5. What is a DLQ and what would you monitor on it?
6. Why single-table design? What is the downside? (Harder to read and change later, and you must know your access patterns up front.)
7. Query vs Scan?
8. How would you add a fourth carrier? (One new adapter.)
9. One carrier is down. What does the user see? (Partial results.)
10. What would you change before real production use?

When you describe the project, speak about what you built and what you learned. Say "I built this to learn the AWS stack", not "I have years of AWS production experience". Being honest here is also what makes you sound credible.

---

## 8. Floci reset and cleanup

Use these commands when you need to stop the local environment or reproduce a run from empty state:

```powershell
floci stop
Remove-Item -Recurse -Force .\floci-data
floci start --services s3,dynamodb,sqs --persist .\floci-data
floci wait --service dynamodb
floci env --shell powershell | Invoke-Expression
npm run setup
```

Do not run `aws configure` and do not point this repository at a real AWS account. The only AWS endpoint for the project is Floci at `http://localhost:4566`.

---

## 9. After the weekend

1. Push the repo to GitHub with the README.
2. Come back to this chat with the repo link, your answers to the remaining questions (API design experience and the "built from scratch" story), and the reimbursement-portal details. Then I will build the CoverForce resume with real, verifiable bullets for S3, DynamoDB, SQS and TypeScript.
3. Apply to the role with the repo link in the application.

Good luck. Keep the scope small, get the whole flow working before polishing anything, and write down the bugs you hit, because they make the best interview stories.
