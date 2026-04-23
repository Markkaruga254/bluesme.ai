import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function resolvePythonCandidates(projectRoot: string): string[] {
	const preferred = process.env.BLUESME_PYTHON;
	if (preferred) return [preferred];

	return [
		path.join(projectRoot, "venv", "bin", "python"),
		path.join(projectRoot, ".venv", "bin", "python"),
		path.join(projectRoot, "..", ".venv", "bin", "python"),
		path.join(projectRoot, "..", "..", ".venv", "bin", "python"),
		"python3",
		"python",
	];
}

export async function runFlow(flowName: string, payload: Record<string, unknown>) {
	const projectRoot = process.cwd();
	const pythonCandidates = resolvePythonCandidates(projectRoot);
	const runnerPath = path.join(projectRoot, "scripts", "run_flow.py");

	const env = {
		...process.env,
		BLUESME_TEST_MODE: process.env.BLUESME_TEST_MODE ?? "1",
	};

	let stdout = "";
	let stderr = "";
	let lastError: unknown = null;

	for (const python of pythonCandidates) {
		try {
			const result = await execFileAsync(python, [runnerPath, flowName, JSON.stringify(payload)], {
				cwd: projectRoot,
				env,
				timeout: 120000,
				maxBuffer: 1024 * 1024,
			});
			stdout = result.stdout;
			stderr = result.stderr;
			lastError = null;
			break;
		} catch (error) {
			const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
			if (err.code === "ENOENT") {
				lastError = err;
				continue;
			}
			throw error;
		}
	}

	if (lastError) {
		throw new Error(
			"Could not find a Python interpreter. Set BLUESME_PYTHON to your project venv python path."
		);
	}

	let parsed: { ok?: boolean; output?: string; error?: string; testMode?: boolean };
	try {
		// Extract JSON from output (CrewAI may print logs before the JSON)
		const jsonMatch = stdout.match(/\{[\s\S]*\}(?=\s*$)/);
		const jsonString = jsonMatch ? jsonMatch[0] : stdout.trim();
		parsed = JSON.parse(jsonString);
	} catch {
		throw new Error(stderr.trim() || `Flow runner returned invalid JSON: ${stdout.substring(0, 200)}`);
	}

	if (!parsed.ok) {
		throw new Error(parsed.error || stderr.trim() || "Flow execution failed.");
	}

	return {
		output: parsed.output || "",
		testMode: Boolean(parsed.testMode),
	};
}