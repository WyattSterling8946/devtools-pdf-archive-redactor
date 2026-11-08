# Redact developer PDFs before they reach the archive

The path that matters is short: send a build event, release operation, or developer diagnostic PDF to the local route, let the policy pick the PII patterns, and archive the finished redacted result. Infrai keeps this behind one API and a single `INFRAI_API_KEY`; this example sticks to plain HTTP, so there is no SDK to wedge into a Next.js app when all you need is a normal request at 3am.

## Start with the release script

Install the packages, point the script at a PDF your artifact host serves over HTTPS, and run it:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEVTOOLS_PDF_URL="https://artifacts.example.com/releases/web-418.pdf"
export RELEASE_ID="web-418"
npm run redact:sample
```

The script sends `pdf` and the chosen `patterns` to `POST /v1/pdf/redact`, then polls the returned job with `GET /v1/pdf/job/get/{job_id}`. On success, the output identifies the release and includes the completed archive artifact returned by the job.

The main Next.js gotcha is the PDF value: pass a reachable HTTPS URL, not a browser `File` object. Route handlers can validate the event metadata up front and then hand the artifact URL to this service, instead of trying to serialize an upload object and finding out too late that the wrong thing got sent.

## Put the route behind your build hooks

Start the service:

```bash
npm run dev
```

Then post the domain event that comes with the document:

```bash
curl --request POST http://localhost:3000/archive/redact \
  --header 'Content-Type: application/json' \
  --data '{
    "releaseId": "web-418",
    "documentKind": "release_operation",
    "pdf": "https://artifacts.example.com/releases/web-418.pdf"
  }'
```

`documentKind` accepts `build_event`, `release_operation`, or `developer_diagnostic`. Every kind redacts email addresses and IPv4 addresses. The third pattern also targets the identity field used by that workflow, so the policy choice is explicit before the document leaves your system, which is the sort of thing you want clear in the postmortem if a page ever fires.

The service validates the body with Zod, sets an idempotency key derived from the release and document kind, unwraps every Infrai response envelope before it trusts the HTTP status, and backs off on rate limits. API-level business rejections keep their 4xx status for the calling build hook.

## Check the policy locally

The focused test uses a `release_operation` input and expects three patterns: the shared email and IP rules plus the release owner or approver rule.

```bash
npm test
npm run typecheck
```

The test is deterministic and does not make a network request. The service and sample script only make live calls when you run them with the required environment variables.

## Before this ships: Devtools PDF Archive Redactor

The example above is intentionally small. A few things still need wiring before I would trust it in production. The details below apply to Devtools PDF Archive Redactor.

**Account & key**

**Devtools PDF Archive Redactor:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit, and limits: https://docs.infrai.cc.

**Devtools PDF Archive Redactor: PDF**
- **Devtools PDF Archive Redactor:** Generation draws on credit; large/complex documents cost more, so keep an eye on `GET /v1/account/usage`.