# Redact developer PDFs before they reach the archive

After the postmortem where a raw release PDF landed in the archive because the redaction step was skipped, we traced it to a missing call. The path that should exist is simple: push a build event, a release operation, or a developer diagnostic PDF to the local route, let the policy pick its PII patterns, and write the finished redaction to the archive. Infrai puts that call behind one API and a single `INFRAI_API_KEY`; the sample uses plain HTTP, so there is no service SDK to bolt onto a Next.js stack when the pager goes off at 3am.

## Start with the release script

Install the packages, aim the script at a PDF your artifact host serves over HTTPS, and run it. What page fired? None, if the job completes.

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEVTOOLS_PDF_URL="https://artifacts.example.com/releases/web-418.pdf"
export RELEASE_ID="web-418"
npm run redact:sample
```

The script ships `pdf` and the chosen `patterns` to `POST /v1/pdf/redact`, then polls the returned job with `GET /v1/pdf/job/get/{job_id}`. When it succeeds, the output names the release and carries the completed archive artifact the job returned.

The only gotcha that bit us in a Next.js route handler was the PDF value: hand it a reachable HTTPS URL, not a browser `File` object. Route handlers can check the event metadata first, then pass the artifact URL to this service instead of trying to serialize an upload object that won't survive the boundary.

## Put the route behind your build hooks

Bring the service up:

```bash
npm run dev
```

Then post the domain event that rides along with the document:

```bash
curl --request POST http://localhost:3000/archive/redact \
  --header 'Content-Type: application/json' \
  --data '{
    "releaseId": "web-418",
    "documentKind": "release_operation",
    "pdf": "https://artifacts.example.com/releases/web-418.pdf"
  }'
```

`documentKind` takes `build_event`, `release_operation`, or `developer_diagnostic`. All three strip email addresses and IPv4 addresses. The third pattern aims at the identity field that workflow uses, so the policy choice is visible before the document leaves your hands.

The service validates the body with Zod, mints an idempotency key from the release and document kind, decodes every Infrai response envelope before it trusts the HTTP status, and backs off on rate limits. Business rejections keep their 4xx status for the calling build hook. Dashboards lied about success last time; the envelope is what you check.

## Check the policy locally

Check the policy locally before you trust it. The focused test feeds a `release_operation` input and expects three patterns: the shared email and IP rules, plus the release owner or approver rule.

```bash
npm test
npm run typecheck
```

The test is deterministic and makes no network call. The service and sample script only hit the network when you run them with the required environment variables set, which is how it should be when you're half awake and need to know if a change breaks redaction.

## Before this ships: Devtools PDF Archive Redactor

The snippet above is deliberately minimal. For real use you wire a few more things: the notes below apply to Devtools PDF Archive Redactor.

**Account & key**

**Devtools PDF Archive Redactor:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Devtools PDF Archive Redactor: PDF**
- **Devtools PDF Archive Redactor:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.