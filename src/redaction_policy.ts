import { z } from "zod";

export const ArchiveRequestSchema = z.object({
  releaseId: z.string().min(1),
  documentKind: z.enum(["build_event", "release_operation", "developer_diagnostic"]),
  pdf: z.string().url(),
});

export type ArchiveRequest = z.infer<typeof ArchiveRequestSchema>;

const sharedPatterns = [
  "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}",
  "(?:\\d{1,3}\\.){3}\\d{1,3}",
];

const kindPatterns: Record<ArchiveRequest["documentKind"], string[]> = {
  build_event: ["(?:BUILD_USER|COMMIT_AUTHOR)=[^\\s]+"],
  release_operation: ["(?:RELEASE_OWNER|APPROVER)=[^\\s]+"],
  developer_diagnostic: ["(?:USER|USERNAME|HOME)=[^\\s]+"],
};

export function planRedaction(input: ArchiveRequest) {
  return {
    releaseId: input.releaseId,
    documentKind: input.documentKind,
    pdf: input.pdf,
    patterns: [...sharedPatterns, ...kindPatterns[input.documentKind]],
  };
}
