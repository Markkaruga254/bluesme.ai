import type { NextApiRequest, NextApiResponse } from "next";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface QueuedJobResponse {
  job_id: string;
  status: "queued" | "running" | "success" | "failure" | "pending";
  output?: string;
  testMode?: boolean;
  error?: string;
}

export interface LegacyResponse {
  output: string;
  testMode: boolean;
}

// ── Mode detection ────────────────────────────────────────────────────────────

/**
 * When QUEUE_MODE=1 → push to Celery queue via the Python bridge.
 * Otherwise → fall back to the existing direct subprocess execution.
 * This preserves 100% backward compatibility.
 */
export function isQueueMode(): boolean {
  return process.env.QUEUE_MODE === "1";
}

const BRIDGE_URL = process.env.QUEUE_BRIDGE_URL ?? "http://localhost:8001";

// ── Queue helpers ─────────────────────────────────────────────────────────────

export async function enqueueJob(
  endpoint: string,
  body: Record<string, unknown>
): Promise<QueuedJobResponse> {
  const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000), // 10s to queue — never blocks long
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Queue bridge unreachable" }));
    throw new Error((err as { error?: string }).error ?? `Queue bridge returned ${res.status}`);
  }

  return res.json() as Promise<QueuedJobResponse>;
}

export async function waitForJob(
  jobId: string,
  maxWaitMs = 120_000,
  pollIntervalMs = 1_500
): Promise<QueuedJobResponse> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${BRIDGE_URL}/queue/status/${jobId}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

    const data = (await res.json()) as {
      status: string;
      ready: boolean;
      result?: Record<string, unknown>;
    };

    if (data.ready) {
      const result = data.result ?? {};
      return {
        job_id: jobId,
        status: data.status as QueuedJobResponse["status"],
        output: (result.output as string) ?? "",
        testMode: Boolean(result.testMode),
        error: (result.error as string) | undefined,
      };
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  // Return job_id so caller can poll later with GET /api/job-status
  return { job_id: jobId, status: "running" };
}

// ── Response helpers ──────────────────────────────────────────────────────────

export function sendQueued(res: NextApiResponse, jobId: string) {
  res.status(202).json({
    job_id: jobId,
    status: "queued",
    message: "Job accepted. Poll GET /api/job-status?id=<job_id> for result.",
  });
}

export function sendError(
  res: NextApiResponse,
  statusCode: number,
  message: string
) {
  res.status(statusCode).json({ error: message });
}
