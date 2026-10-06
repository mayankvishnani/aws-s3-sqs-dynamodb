# QuoteHub

QuoteHub is a TypeScript/Node.js learning project that demonstrates an asynchronous insurance-quote workflow using S3, DynamoDB, and SQS. AWS services are accessed through the local Floci emulator; the project is configured for local development, not deployment to AWS.

## What the application does

- Creates temporary S3 presigned URLs so clients can upload and download documents directly.
- Accepts a quote request and stores its input in DynamoDB.
- Enqueues the quote ID in SQS so the API does not wait for carrier processing.
- Runs a separate worker that asks mock carriers for quotes and stores successful results.
- Lets clients poll for quote status and results.

## Technology and concepts

- **Express and Zod:** HTTP API routes and request validation.
- **AWS SDK for JavaScript v3:** service clients configured to use Floci at `http://localhost:4566`.
- **S3 presigned URLs:** grant temporary access to a specific upload or download without proxying file bytes through the API.
- **DynamoDB single-table layout:** `QUOTE#<id>` is the partition key; `META` stores the quote and `RESULT#<carrier>` stores each carrier result. One Query returns the quote and its results.
- **SQS standard queue:** separates API acceptance from background processing. Standard queues may deliver a message more than once, so carrier results use stable keys and can be overwritten safely.
- **Dead-letter queue:** receives messages after repeated processing failures according to the queue redrive policy.
- **Carrier adapters:** share a common interface but have carrier-specific latency, quote values, timeouts, and retry policies. The current adapters are mocks; their differences demonstrate how independently integrated carrier APIs can fit the same worker.

## Project layout

The repository separates the user interface from the backend:

```text
aws/
  README.md
  quotehub/          # Node.js API, worker, and AWS integrations
  quotehubFrontend/  # React/Vite web application
```

The backend is further organized by responsibility:

```text
quotehub/
  src/
    api/
      server.ts  # Express routes and API server
    config/
      index.ts   # Local endpoint and AWS resource names
    infrastructure/
      aws/
        clients.ts
        dynamodb/
          quote-repository.ts
        s3/
          document-storage.ts
        sqs/
          quote-queue.ts
        setup.ts # Creates local AWS resources
    scripts/
      try-db.ts
      try-s3.ts
    services/
      carriers/
        mock-carriers.ts
    shared/
      types.ts
    workers/
      quote-worker.ts
```

## Prerequisites

- Node.js and npm
- Docker Desktop
- Floci CLI
- AWS CLI

## Run locally on Windows

Open PowerShell in the repository and start Floci:

```powershell
floci doctor
floci start --services s3,dynamodb,sqs --persist .\floci-data
floci wait --service dynamodb
Invoke-Expression (floci env --shell powershell | Out-String)
```

Install dependencies and create the local AWS resources:

```powershell
Set-Location .\quotehub
npm install
npm run setup
npm run typecheck
```

`npm run setup` creates the `quotehub-documents` bucket, the `QuoteHub` DynamoDB table, and the `quote-requests` queue with its `quote-requests-dlq` dead-letter queue. Run the setup command again if needed; existing bucket/table resources are handled by the setup script.

Start the API and worker in **separate PowerShell terminals**. In each terminal, load the Floci environment before starting the app:

```powershell
Invoke-Expression (floci env --shell powershell | Out-String)
Set-Location C:\path\to\aws\quotehub
npm run api
```

In the second terminal:

```powershell
Invoke-Expression (floci env --shell powershell | Out-String)
Set-Location C:\path\to\aws\quotehub
npm run worker
```

The API listens at `http://localhost:3000`.

## Run the frontend

Start the API and worker as described above, then open a third PowerShell terminal:

```powershell
Set-Location .\quotehubFrontend
npm install
npm run dev
```

Open `http://localhost:5173`. The React dashboard proxies API calls to `localhost:3000` and document uploads to Floci on `localhost:4566`. See [quotehubFrontend/README.md](quotehubFrontend/README.md) for frontend API coverage and deployment notes.

## API walkthrough

### 1. Create a quote

In PowerShell, send JSON through standard input to avoid shell quote-escaping problems:

```powershell
$body = @'
{"businessName":"Joe Bakery","industry":"food","annualRevenue":500000,"state":"NY"}
'@

$created = $body | curl.exe -sS -X POST "http://localhost:3000/quotes" `
  -H "Content-Type: application/json" `
  --data-binary "@-" |
  ConvertFrom-Json

$created | ConvertTo-Json
$quoteId = $created.quoteId
```

The endpoint returns HTTP `202 Accepted` with a quote ID and `PENDING` status. The worker processes the quote asynchronously.

Required fields:

| Field | Requirement |
|---|---|
| `businessName` | Non-empty string |
| `industry` | Non-empty string |
| `annualRevenue` | Positive number |
| `state` | Two-character string |
| `documentKey` | Optional S3 object key |

### 2. Poll for the quote

```powershell
curl.exe -i "http://localhost:3000/quotes/$quoteId"
```

Repeat the request to observe the status and carrier results. A quote with at least one successful carrier response is marked `COMPLETED`; individual carrier failures are logged while successful results can still be returned.

### 3. List all quotes

```powershell
curl.exe -i "http://localhost:3000/allQuotes"
```

The endpoint returns `{ "quotes": [...] }` with each quote's business input, status, and carrier results. The React frontend uses it to populate the full quote history and opens a detail modal when a quote is selected.

### 4. Optional document upload

Request an upload URL:

```powershell
$uploadBody = @'
{"contentType":"application/pdf"}
'@

$upload = $uploadBody | curl.exe -sS -X POST "http://localhost:3000/uploads" `
  -H "Content-Type: application/json" `
  --data-binary "@-" |
  ConvertFrom-Json

$upload | ConvertTo-Json
```

Use the returned URL to upload a file, supplying the same content type:

```powershell
curl.exe -X PUT -H "Content-Type: application/pdf" `
  --upload-file "C:\path\to\document.pdf" `
  "$($upload.url)"
```

Include `$upload.key` as `documentKey` when creating a quote. The quote response will include a temporary `documentUrl` when one is attached.

## Failure and delivery behavior

- Each carrier request has its own deadline, maximum attempt count, and exponential-backoff delay. Retryable carrier errors and timeouts are retried independently; a non-retryable error stops attempts for that carrier. Carrier attempts run concurrently, so a slow carrier does not block successful carrier results beyond its own configured timeout and retries.
- `maxAttempts` includes the initial request. After a retryable failure, the wait is `retryDelayMs * 2^(attempt - 1)`, so the configured retry delay grows exponentially.

| Mock carrier | Timeout | Maximum attempts | Initial retry delay | Mock profile |
|---|---:|---:|---:|---|
| Acme Mutual | 700 ms | 2 | 100 ms | Fast, relatively reliable; $1M coverage |
| Globex Corporation | 650 ms | 3 | 150 ms | Higher transient/permanent failure rates; $750K coverage |
| Initech Speciality | 900 ms | 2 | 200 ms | Slower response and larger coverage; $1.5M coverage |

- Carrier adapters receive an `AbortSignal`. Real HTTP adapters should pass it to `fetch` (or the HTTP client's equivalent) and map transient network/service errors to `CarrierRequestError` with `retryable: true`; permanent validation or business-rule errors should be non-retryable. The request wrapper still enforces its deadline if an adapter ignores cancellation, but ignoring the signal can leave its underlying operation running.
- The carrier timeout/retry policy is separate from SQS redelivery: per-carrier retries happen inside one worker attempt, while SQS redelivers the whole quote message only when processing fails (for example, when every carrier fails).
- SQS standard queues provide at-least-once delivery. A worker may receive the same message again.
- The worker deletes a message only after processing succeeds. Processing failures are logged and leave the message available for retry.
- The setup configures the main queue to send repeatedly failing messages to the DLQ after three receives.
- Successful carrier results are written under stable quote/carrier keys, making repeated writes idempotent.
- If every carrier fails, the worker throws so SQS can retry. The current worker does not consume DLQ messages or update the quote to `FAILED`, so a quote may remain `PROCESSING` after the message reaches the DLQ.
- Carrier behavior and policy values in `quotehub/src/services/carriers/mock-carriers.ts` are mock settings. Adjust latency, failure rates, timeout, or attempts there to exercise the different outcomes; a permanent mock failure is not retried.

## Useful commands

Run from `quotehub/`:

```powershell
npm run setup       # create local AWS resources
npm run typecheck   # check TypeScript
npm run api         # start HTTP API
npm run worker      # start background worker
npx tsx src/scripts/try-db.ts
npx tsx src/scripts/try-s3.ts
```

The `try-db` and `try-s3` scripts are standalone learning checks; the API/worker flow requires the local AWS resources and both processes to be running.
