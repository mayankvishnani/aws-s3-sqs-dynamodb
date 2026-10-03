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
- **Mock carrier adapters:** share a common interface, simulate latency, and can simulate failures.

## Project layout

The Node application is in `quotehub/`.

```text
quotehub/
  src/
    api.ts       # HTTP endpoints
    carriers.ts  # Mock carrier adapters
    clients.ts   # S3, DynamoDB, and SQS clients
    config.ts    # Local endpoint and resource names
    db.ts        # DynamoDB operations
    queue.ts     # SQS send, receive, and delete operations
    s3.ts        # Presigned upload/download URLs
    setup.ts     # Creates the local bucket, table, and queues
    types.ts     # Shared TypeScript types
    worker.ts    # Background quote processor
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

### 3. Optional document upload

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

- SQS standard queues provide at-least-once delivery. A worker may receive the same message again.
- The worker deletes a message only after processing succeeds. Processing failures are logged and leave the message available for retry.
- The setup configures the main queue to send repeatedly failing messages to the DLQ after three receives.
- Successful carrier results are written under stable quote/carrier keys, making repeated writes idempotent.
- If every carrier fails, the worker throws so SQS can retry. The current worker does not consume DLQ messages or update the quote to `FAILED`, so a quote may remain `PROCESSING` after the message reaches the DLQ.
- Carrier failure rates in `src/carriers.ts` are mock settings and can be adjusted temporarily to exercise retry behavior.

## Useful commands

Run from `quotehub/`:

```powershell
npm run setup       # create local AWS resources
npm run typecheck   # check TypeScript
npm run api         # start HTTP API
npm run worker      # start background worker
npx tsx src/try-db.ts
npx tsx src/try-s3.ts
```

The `try-db` and `try-s3` scripts are standalone learning checks; the API/worker flow requires the local AWS resources and both processes to be running.
