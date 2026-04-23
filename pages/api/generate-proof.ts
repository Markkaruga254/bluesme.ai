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
  const smeName = String(req.body?.smeName || "").trim();
  const smeCategory = String(req.body?.smeCategory || "").trim();
  const days = Number(req.body?.days || 90);

  if (!smeAddress || !smeName || !smeCategory) {
    return sendError(res, 400, "smeAddress, smeName, and smeCategory are required.");
  }

  if (![30, 60, 90].includes(days)) {
    return sendError(res, 400, "days must be 30, 60, or 90.");
  }

  // ── Queue Mode ────────────────────────────────────────────────────────────
  if (isQueueMode()) {
    try {
      const { job_id } = await enqueueJob("/queue/generate-proof", {
        smeAddress,
        smeName,
        smeCategory,
        days,
      });

      const shouldWait = req.headers["x-wait-for-result"] === "true";
      if (shouldWait) {
        const result = await waitForJob(job_id, 150_000); // proofs take up to 150s
        if (result.status === "running") {
          return res.status(202).json({
            job_id,
            status: "running",
            message: "Poll /api/job-status?id=" + job_id,
          });
        }
        if (result.status === "failure") {
          return sendError(res, 500, result.error ?? "Proof job failed");
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
        message: "Proof generation queued. Poll /api/job-status?id=" + job_id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Queue error";
      return sendError(res, 503, `Queue unavailable: ${message}`);
    }
  }

  // ── Legacy Mode ───────────────────────────────────────────────────────────
  try {
    const result = await runFlow("generate_proof", {
      smeAddress,
      smeName,
      smeCategory,
      days,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return sendError(res, 500, message);
  }
}