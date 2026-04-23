import { useState, useCallback } from "react";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<TArgs, TResult>(
  apiFn: (args: TArgs) => Promise<TResult>
): ApiState<TResult> & {
  execute: (args: TArgs) => Promise<TResult | null>;
  reset: () => void;
} {
  const [state, setState] = useState<ApiState<TResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await apiFn(args);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setState({ data: null, loading: false, error: msg });
        return null;
      }
    },
    [apiFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
