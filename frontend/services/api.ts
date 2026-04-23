// Centralized API service — all backend calls go through here.
// DO NOT modify backend logic or API contracts.

export interface FlowResponse {
  output: string;
  testMode: boolean;
}

export interface LogSalePayload {
  smeAddress: string;
  saleMessage: string;
}

export interface RunInsightsPayload {
  smeAddress: string;
  isWeekEnd: boolean;
}

export interface GenerateProofPayload {
  smeAddress: string;
  smeName: string;
  smeCategory: string;
  days: 30 | 60 | 90;
}

async function postWithRetry(
  url: string,
  body: Record<string, unknown>,
  retries = 2
): Promise<FlowResponse> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (json as { error?: string }).error;
        throw new Error(msg || `Request failed with status ${res.status}`);
      }

      return json as FlowResponse;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export const api = {
  logSale: (payload: LogSalePayload) =>
    postWithRetry("/api/log-sale", payload as Record<string, unknown>),

  runInsights: (payload: RunInsightsPayload) =>
    postWithRetry("/api/run-insights", payload as Record<string, unknown>),

  generateProof: (payload: GenerateProofPayload) =>
    postWithRetry("/api/generate-proof", payload as Record<string, unknown>),
};
