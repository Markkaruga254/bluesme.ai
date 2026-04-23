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
  const isWeekEnd = Boolean(req.body?.isWeekEnd || false);

  if (!smeAddress) {
    return sendError(res, 400, "smeAddress is required.");
  }

  // ── Queue Mode ────────────────────────────────────────────────────────────
  if (isQueueMode()) {
    try {
      const { job_id } = await enqueueJob("/queue/run-insights", { smeAddress, isWeekEnd });

      const shouldWait = req.headers["x-wait-for-result"] === "true";
      if (shouldWait) {
        const result = await waitForJob(job_id);
        if (result.status === "running") {
          return res.status(202).json({
            job_id,
            status: "running",
            message: "Poll /api/job-status?id=" + job_id,
          });
        }
        if (result.status === "failure") {
          return sendError(res, 500, result.error ?? "Insights job failed");
        }
        return res.status(200).json({
          output: result.output ?? "",
          testMode: result.testMode ?? false,
          job_id,
        });
      }

      return res.status(202).json({
        job_id,
        status: "queued",
        message: "Insights job queued. Poll /api/job-status?id=" + job_id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Queue error";
      return sendError(res, 503, `Queue unavailable: ${message}`);
    }
  }

  // ── Legacy Mode ───────────────────────────────────────────────────────────
  try {
    const result = await runFlow("run_insights", { smeAddress, isWeekEnd });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendError(res, 500, message);
  }
}