import type { NextApiRequest, NextApiResponse } from "next";
import { sendError } from "../../lib/server/queue";

const BRIDGE_URL = process.env.QUEUE_BRIDGE_URL ?? "http://localhost:8001";

/**
 * GET /api/job-status?id=<celery_task_id>
 *
 * Returns the current status and result of a queued job.
 * Clients should poll this endpoint after receiving a 202 from any POST endpoint.
 *
 * Response shape (queue mode):
 *   { job_id, status, ready, result: { output, testMode, ... } }
 *
 * Fallback (non-queue mode):
 *   { error: "Queue mode not enabled" }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method Not Allowed");
  }

  const jobId = String(req.query.id ?? "").trim();
  if (!jobId) {
    return sendError(res, 400, "Missing query parameter: id");
  }

  if (process.env.QUEUE_MODE !== "1") {
    return sendError(
      res,
      503,
      "Queue mode is not enabled. Set QUEUE_MODE=1 to use async job tracking."
    );
  }

  try {
    const upstream = await fetch(`${BRIDGE_URL}/queue/status/${jobId}`, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!upstream.ok) {
      return sendError(res, upstream.status, "Failed to retrieve job status from queue bridge");
    }

    const data = await upstream.json();

    // Normalize to a clean public-facing shape
    const result = data.result ?? {};
    return res.status(200).json({
      job_id: jobId,
      status: data.status,
      ready: data.ready,
      successful: data.successful,
      output: (result.output as string) ?? null,
      testMode: Boolean(result.testMode),
      error: (result.error as string) ?? null,
      meta: {
        transaction_id: result.transaction_id ?? null,
        insight_id: result.insight_id ?? null,
        proof_id: result.proof_id ?? null,
        tx_hash: result.tx_hash ?? null,
        amount: result.amount ?? null,
        net_revenue: result.net_revenue ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendError(res, 503, `Queue bridge unreachable: ${message}`);
  }
}
