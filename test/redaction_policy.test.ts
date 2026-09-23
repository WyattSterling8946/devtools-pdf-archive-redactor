import assert from "node:assert/strict";
import test from "node:test";
import { ArchiveRequestSchema, planRedaction } from "../src/redaction_policy.js";

test("release operations redact shared PII and approval identity", () => {
  const request = ArchiveRequestSchema.parse({
    releaseId: "storefront-418",
    documentKind: "release_operation",
    pdf: "https://artifacts.example.com/releases/418.pdf",
  });

  const plan = planRedaction(request);

  assert.equal(plan.releaseId, "storefront-418");
  assert.equal(plan.patterns.length, 3);
  assert.match(plan.patterns[0], /A-Z0-9/);
  assert.match(plan.patterns[2], /RELEASE_OWNER/);
});

test("an invalid PDF location is rejected at the service boundary", () => {
  const result = ArchiveRequestSchema.safeParse({
    releaseId: "storefront-419",
    documentKind: "build_event",
    pdf: "local-build.pdf",
  });

  assert.equal(result.success, false);
});
