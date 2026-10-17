# QuoteHub frontend

A dark, responsive React dashboard for the QuoteHub quote API.

## Project structure

- `src/App.tsx` composes the application shell and the current page.
- `src/hooks/useQuoteHub.ts` owns quote state, API workflows, and background polling.
- `src/api/quoteApi.ts` contains typed API requests and document upload logic.
- `src/components/layout/` contains the sidebar, top bar, and footer.
- `src/components/overview/` contains dashboard sections and the quote request form.
- `src/components/quotes/` contains quote history, details, and the selected-quote modal.
- `src/components/ui/` contains shared icons, status badges, and alerts.
- Components keep their stylesheets alongside their TSX files; `src/styles.css` defines shared tokens and app-wide foundations.

## Run locally

Start Floci and create its S3/DynamoDB/SQS resources as described in the repository's [README](../README.md). Then run the backend API from `quotehub/`:

```powershell
npm run api
```

In another PowerShell terminal:

```powershell
Set-Location .\quotehubFrontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to the API on port 3000 and `/s3` uploads to Floci on port 4566. The quote worker must also be running for carrier results to appear.

## API coverage

- `POST /uploads`: requests a presigned S3 URL when a supporting document is attached.
- `PUT` to the presigned URL: uploads the document through Vite's local S3 proxy.
- `POST /quotes`: submits the business details and optional uploaded document key.
- `PATCH /quotes/:id`: updates a completed or failed quote. Updating clears its old carrier results and queues a fresh comparison; an attached document is retained.
- `GET /quotes/:id`: loads quote status, carrier results, and an optional document download URL. In-progress requests are polled automatically.
- `GET /allQuotes`: loads every quote and its carrier results for the quote history. Selecting a quote opens its detail modal.

The browser keeps the latest 12 viewed quote IDs in local storage for the overview's recent requests; the My quotes page always loads the full list from the API. Use the quote ID search to retrieve a quote directly.

Completed and failed quotes can be edited from their detail modal. Quotes that are pending or processing cannot be edited while carrier work is active. The API currently has no authentication or user identity, so edits are not role-restricted; add server-side authentication and authorization before exposing this API to multiple users.

For a non-Vite deployment, configure a same-origin reverse proxy for `/api` and `/s3`, or set `VITE_API_BASE_URL` to the API origin and configure S3 bucket CORS for the frontend origin.
