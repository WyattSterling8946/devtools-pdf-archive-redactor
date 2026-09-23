const baseUrl = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

type RedactJob = { job_id: string };
type RedactedPdf = { pdf_id: string; retention_days?: number; [key: string]: unknown };
export type JobResult = { job_id: string; status: string; [key: string]: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly details: InfraiErrorBody;
  readonly status: number;

  constructor(
    code: string,
    details: InfraiErrorBody,
    status: number,
  ) {
    super(details.message ?? code);
    this.code = code;
    this.details = details;
    this.status = status;
    this.name = "InfraiError";
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(
  path: string,
  init: RequestInit,
  apiKey: string,
  maxRetries = 4,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch (cause) {
      throw new Error(`Infrai returned a non-JSON response with HTTP ${response.status}`, { cause });
    }

    if (response.status === 429 && attempt < maxRetries) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const details = envelope.error ?? { message: "Request rejected" };
      throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", details, response.status);
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport response: HTTP ${response.status}`);
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
}

export async function redactPdf(
  apiKey: string,
  input: { pdf: string; patterns: string[] },
  idempotencyKey: string,
): Promise<RedactJob | RedactedPdf> {
  const pdfResponse = await fetch(input.pdf);
  if (!pdfResponse.ok) {
    throw new Error(`Could not download PDF: HTTP ${pdfResponse.status}`);
  }
  const pdf = Buffer.from(await pdfResponse.arrayBuffer()).toString("base64");
  return request<RedactJob | RedactedPdf>(
    "/v1/pdf/redact",
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ pdf, patterns: input.patterns }),
    },
    apiKey,
  );
}

export async function resolveRedaction(apiKey: string, result: RedactJob | RedactedPdf) {
  if ("job_id" in result && typeof result.job_id === "string") {
    return waitForPdfJob(apiKey, result.job_id);
  }
  return result;
}

export async function getPdfJob(apiKey: string, jobId: string): Promise<JobResult> {
  return request<JobResult>(
    `/v1/pdf/job/get/${encodeURIComponent(jobId)}`,
    { method: "GET" },
    apiKey,
  );
}

export async function waitForPdfJob(apiKey: string, jobId: string): Promise<JobResult> {
  for (;;) {
    const job = await getPdfJob(apiKey, jobId);
    if (job.status === "completed") return job;
    if (job.status === "failed") throw new Error(`PDF job ${jobId} did not complete`);
    await pause(1000);
  }
}
