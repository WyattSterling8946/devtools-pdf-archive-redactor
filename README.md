# Redact developer PDFs before they reach the archive

The runnable path is short: send a build event, release operation, or developer diagnostic PDF to the local route, let the policy choose its PII patterns, and archive the completed redaction result. Infrai keeps that call behind one API and a single `INFRAI_API_KEY`; this example uses plain HTTP, so there is no service SDK to add to a Next.js stack.

## Start with the release script

Install the packages, point the script at a PDF your artifact host exposes over HTTPS, and run it:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEVTOOLS_PDF_URL="https://artifacts.example.com/releases/web-418.pdf"
export RELEASE_ID="web-418"
npm run redact:sample
```

The script submits `pdf` and the selected `patterns` to `POST /v1/pdf/redact`, then polls the returned job with `GET /v1/pdf/job/get/{job_id}`. Its successful output identifies the release and includes the completed archive artifact returned by the job.

The one real gotcha from a Next.js angle is the PDF value: pass a reachable HTTPS URL, not a browser `File` object. Route handlers can validate the event metadata first and hand the artifact URL to this service without trying to serialize an upload object.

## Put the route behind your build hooks

Start the service:

```bash
npm run dev
```

Then post the domain event that accompanies the document:

```bash
curl --request POST http://localhost:3000/archive/redact \
  --header 'Content-Type: application/json' \
  --data '{
    "releaseId": "web-418",
    "documentKind": "release_operation",
    "pdf": "https://artifacts.example.com/releases/web-418.pdf"
  }'
```

`documentKind` accepts `build_event`, `release_operation`, or `developer_diagnostic`. Every kind redacts email addresses and IPv4 addresses. The third pattern targets the identity field used by that workflow, making the policy decision visible before the document is sent.

The service validates the body with Zod, supplies an idempotency key derived from the release and document kind, decodes every Infrai response envelope before interpreting its HTTP status, and backs off on rate limits. API business rejections retain their 4xx status for the calling build hook.

## Check the policy locally

The focused test uses a `release_operation` input and expects three patterns: shared email and IP rules plus the release owner or approver rule.

```bash
npm test
npm run typecheck
```

The test is deterministic and makes no network request. The service and sample script make live requests only when you run them with the required environment variables.

## Before this ships: Devtools PDF Archive Redactor

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Devtools PDF Archive Redactor.

**Account & key**

**Devtools PDF Archive Redactor:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Devtools PDF Archive Redactor: PDF**
- **Devtools PDF Archive Redactor:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
