import { redactPdf, resolveRedaction } from "./infrai_pdf.js";
import { ArchiveRequestSchema, planRedaction } from "./redaction_policy.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running this script");

const input = ArchiveRequestSchema.parse({
  releaseId: process.env.RELEASE_ID ?? "web-2026-09-13.1",
  documentKind: "release_operation",
  pdf: process.env.DEVTOOLS_PDF_URL,
});

const plan = planRedaction(input);
const submitted = await redactPdf(apiKey, plan, `archive:${plan.releaseId}:${plan.documentKind}`);
const archived = await resolveRedaction(apiKey, submitted);

console.log(JSON.stringify({ releaseId: plan.releaseId, archived }, null, 2));
