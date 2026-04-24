import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const projectRoot = path.join(process.cwd());
  
  // Prefer virtual environment
  const pythonCandidates = [
    path.join(projectRoot, "venv", "bin", "python"),
    path.join(projectRoot, ".venv", "bin", "python"),
    process.env.BLUESME_PYTHON || "python3",
    "python3",
    "python",
  ];
  
  let pythonExe = pythonCandidates[pythonCandidates.length - 1];
  for (const p of pythonCandidates) {
    if (fs.existsSync(p)) {
      pythonExe = p;
      break;
    }
  }

  const scriptPath = path.join(projectRoot, "scripts", "reconciliation_status.py");

  try {
    const { stdout, stderr } = await execAsync(`"${pythonExe}" "${scriptPath}"`, {
      cwd: projectRoot,
      env: { ...process.env, BLUESME_TEST_MODE: process.env.BLUESME_TEST_MODE || "1" }
    });

    const output = stdout.trim();
    const result = JSON.parse(output);

    if (result.ok) {
      return res.status(200).json(result.data);
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error("Reconciliation API Error:", error);
    return res.status(500).json({ error: "Failed to fetch reconciliation status" });
  }
}
