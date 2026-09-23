import { createServer } from "node:http";
import { InfraiError, redactPdf, resolveRedaction } from "./infrai_pdf.js";
import { ArchiveRequestSchema, planRedaction } from "./redaction_policy.js";

const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/archive/redact") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = ArchiveRequestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      send(response, 400, { error: "Invalid archive request", issues: parsed.error.issues });
      return;
    }

    const plan = planRedaction(parsed.data);
    const submitted = await redactPdf(apiKey, plan, `archive:${plan.releaseId}:${plan.documentKind}`);
    const result = await resolveRedaction(apiKey, submitted);
    send(response, 200, {
      releaseId: plan.releaseId,
      documentKind: plan.documentKind,
      redactionCount: plan.patterns.length,
      archiveArtifact: result,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be JSON" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    send(response, 502, { error: error instanceof Error ? error.message : "Archive request failed" });
  }
});

server.listen(port, () => console.log(`Archive redaction service listening on http://localhost:${port}`));
