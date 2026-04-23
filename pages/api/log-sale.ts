import type { NextApiRequest, NextApiResponse } from "next";
import { runFlow } from "../../lib/server/runFlow";
import {
  isQueueMode,
  enqueueJob,
  waitForJob,
  sendError,
} from "../../lib/server/queue";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method Not Allowed");
  }

  const smeAddress = String(req.body?.smeAddress || "").trim();
  const saleMessage = String(req.body?.saleMessage || "").trim();

  if (!smeAddress || !saleMessage) {
    return sendError(res, 400, "smeAddress and saleMessage are required.");
  }

  // ── Queue Mode: push to Celery, return immediately or wait ───────────────
  if (isQueueMode()) {
    try {
      const { job_id } = await enqueueJob("/queue/log-sale", { smeAddress, saleMessage });

      // If the client wants to wait (X-Wait-For-Result: true), poll for result
      const shouldWait = req.headers["x-wait-for-result"] === "true";
      if (shouldWait) {
        const result = await waitForJob(job_id);
        if (result.status === "running") {
          // Still processing — return 202 with job_id for async polling
          return res.status(202).json({
            job_id,
            status: "running",
            message: "Job is still running. Poll /api/job-status?id=" + job_id,
          });
        }
        if (result.status === "failure") {
          return sendError(res, 500, result.error ?? "Job failed");
        }
        // Return in the same shape as the legacy API (backward compatible)
        return res.status(200).json({
          output: result.output ?? "",
          testMode: result.testMode ?? false,
          job_id,
        });
      }

      // Default: return 202 immediately with job_id
      return res.status(202).json({
        job_id,
        status: "queued",
        message: "Sale log queued. Poll /api/job-status?id=" + job_id + " for result.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Queue error";
      return sendError(res, 503, `Queue unavailable: ${message}`);
    }
  }

  // ── Legacy Mode: direct subprocess (existing behaviour) ──────────────────
  try {
    const result = await runFlow("log_sale", { smeAddress, saleMessage });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendError(res, 500, message);
  }
}